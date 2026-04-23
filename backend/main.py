# main.py

import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from typing import List, Optional
from dotenv import load_dotenv
import openrouteservice
from fastapi.encoders import jsonable_encoder

from vrp_solver import (
    get_distance_matrix,
    solve_cvrp_without_restrictions,
    solve_cvrp_with_time_windows,
    compute_route_geometries
)
from geocoder import GeoIntelligence

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
load_dotenv()
ORS_API_KEY = os.getenv("ORS_API_KEY")
app = FastAPI(title="VRP Solver API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
geo_intel = GeoIntelligence()

class Location(BaseModel):
    name: str; latitude: float; longitude: float
    serviceTime: Optional[int] = Field(0, description="User-override for service time in minutes. If 0, it will be calculated based on demand.")
    timeWindowStart: Optional[int] = Field(None)
    timeWindowEnd: Optional[int] = Field(None)
    road_type: Optional[str] = Field("STANDARD", description="Road type: WIDE, STANDARD, NARROW")
class Vehicle(BaseModel):
    id: str; capacity: int
    average_speed: Optional[float] = None
class OptimizeRequest(BaseModel):
    locations: List[Location]
    vehicles: List[Vehicle]
    demands: List[int]
    useTimeWindows: Optional[bool] = False
    include_geometry: Optional[bool] = True
    time_limit_seconds: Optional[int] = 30
    traffic_factor: Optional[float] = 1.25
    avg_speed_kmh: Optional[int] = 25
    strategy: Optional[str] = "hybrid"
    small_threshold: Optional[int] = 1000
    medium_threshold: Optional[int] = 4000
    @validator("useTimeWindows", pre=True)
    def parse_use_time_windows(cls, v):
        if isinstance(v, bool): return v
        if isinstance(v, str): return v.lower() == "true"
        return bool(v)
@app.get("/")
def root():
    return {"message": "VRP Solver API is running!"}

@app.get("/health")
def health(): return {"status": "ok"}

@app.post("/geocode")
def bulk_geocode(coords: List[dict]):
    """
    Expects [{"lat": 22.123, "lon": 75.123}, ...] 
    Returns [{"lat": 22.123, "lon": 75.123, "road_type": "NARROW"}, ...]
    """
    results = []
    for c in coords:
        rt = geo_intel.get_road_metadata(c['lat'], c['lon'])
        results.append({
            "lat": c['lat'],
            "lon": c['lon'],
            "road_type": rt.upper()
        })
    return results

@app.post("/optimize")
def optimize(req: OptimizeRequest):
    logging.info(f"--- VRP Request Received (Time Windows: {req.useTimeWindows}) ---")
    try:
        locations_coords = [(loc.latitude, loc.longitude) for loc in req.locations]
        vehicles_dict = jsonable_encoder(req.vehicles)
        distance_matrix = get_distance_matrix(locations_coords)

        # ==================== DYNAMIC SERVICE TIME CALCULATION ====================
        BASE_SERVICE_TIME_MINUTES = 3  # Fixed time for parking, paperwork, etc.
        UNITS_PER_MINUTE_OF_UNLOADING = 10  # e.g., 100 units = 10 minutes
        REALISTIC_AVG_SPEED_KMH = 40

        service_times_seconds = []
        logging.info("Calculating service times based on demand...")
        for i, loc in enumerate(req.locations):
            # If the user provided a specific service time, use it.
            if loc.serviceTime and loc.serviceTime > 0:
                total_minutes = loc.serviceTime
                logging.info(f"  - Location '{loc.name}': Using user-provided service time of {total_minutes} min.")
            else:
                # Depot (index 0) has zero service time.
                if i == 0:
                    total_minutes = 0
                else:
                    # Calculate service time dynamically based on demand.
                    demand = req.demands[i]
                    demand_based_minutes = demand / UNITS_PER_MINUTE_OF_UNLOADING
                    total_minutes = BASE_SERVICE_TIME_MINUTES + demand_based_minutes
                    logging.info(f"  - Location '{loc.name}' (Demand: {demand}): Calculated service time is {total_minutes:.2f} min.")
            
            service_times_seconds.append(int(total_minutes * 60))
        # ========================================================================

        # Use the average speed from the request (configurable from frontend)
        avg_speed_kmh = req.avg_speed_kmh

        try:
            if req.useTimeWindows:
                logging.info("Solving VRP with Time Window constraints.")
                depot_tw = (req.locations[0].timeWindowStart or 360, req.locations[0].timeWindowEnd or 1080)
                time_windows_seconds = [((loc.timeWindowStart or depot_tw[0]) * 60, (loc.timeWindowEnd or depot_tw[1]) * 60) for loc in req.locations]
                
                road_types = [loc.road_type for loc in req.locations]
                
                optimized = solve_cvrp_with_time_windows(
                    distance_matrix=distance_matrix, vehicles=vehicles_dict, demands=req.demands,
                    time_windows_seconds=time_windows_seconds, service_times_seconds=service_times_seconds,
                    road_types=road_types,
                    avg_speed_kmh=avg_speed_kmh, time_limit_seconds=req.time_limit_seconds, traffic_factor=req.traffic_factor,
                    strategy=req.strategy,
                    small_threshold=req.small_threshold,
                    medium_threshold=req.medium_threshold
                )
            else:
                logging.info("Solving basic VRP without Time Window constraints.")
                optimized = solve_cvrp_without_restrictions(
                    distance_matrix=distance_matrix, vehicles=vehicles_dict, demands=req.demands,
                    service_times_seconds=service_times_seconds,
                    road_types=[loc.road_type for loc in req.locations],
                    avg_speed_kmh=avg_speed_kmh, time_limit_seconds=req.time_limit_seconds, traffic_factor=req.traffic_factor,
                    small_threshold=req.small_threshold,
                    medium_threshold=req.medium_threshold
                )
        except Exception as e:
            logging.error(f"❌ VRP Solver Crash: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Advanced Solver Error: {str(e)}")

        if not optimized or not optimized.get('active_routes'):
             # If completely empty, we still have dropped nodes info
             if optimized and optimized.get('dropped_nodes'):
                  logging.warning(f"Solver returned 0 routes, all {len(optimized['dropped_nodes'])} nodes dropped.")
             else:
                  raise HTTPException(status_code=422, detail="Solver could not find any feasible routes.")

        active_routes = optimized['active_routes']
        dropped_nodes = optimized.get('dropped_nodes', [])

        if req.include_geometry and ORS_API_KEY:
            client = openrouteservice.Client(key=ORS_API_KEY)
            active_routes = compute_route_geometries(client, locations_coords, active_routes)

    except Exception as e:
        logging.error(f"An unexpected error during optimization: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

    return jsonable_encoder({
        "result": active_routes,
        "dropped_nodes": dropped_nodes,
        "summary": { 
            "vehicles_used": len(active_routes), 
            "total_distance_km": round(sum(v.get("Distance (km)", 0) for v in active_routes), 2),
            "unassigned_stops": len(dropped_nodes)
        }
    })