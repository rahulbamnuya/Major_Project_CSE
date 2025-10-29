import os
import logging
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Optional
from dotenv import load_dotenv
import openrouteservice
from openrouteservice.exceptions import ApiError
from fastapi.encoders import jsonable_encoder

# Import the refactored solver functions
from vrp_solver import get_distance_matrix, solve_cvrp_without_restrictions, compute_route_geometries

# --- NEW: Configure structured logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)

# --- CHANGED: Load environment variables securely ---
load_dotenv()
ORS_API_KEY = os.getenv("ORS_API_KEY")

app = FastAPI(title="VRP Solver API")

# --- BEST PRACTICE: For production, specify your frontend's actual origin ---
# Example: allow_origins=["http://localhost:3000", "https://your-app-domain.com"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # OK for local development
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Models for Request Body (No changes needed) ---
class Location(BaseModel):
    name: str
    latitude: float
    longitude: float

class Vehicle(BaseModel):
    id: str
    capacity: int
    fuel_cost_per_km: Optional[float] = None
    driver_cost_per_km: Optional[float] = None
    type: Optional[str] = None

class OptimizeRequest(BaseModel):
    locations: List[Location] = Field(..., min_items=2, description="List of locations. The first one MUST be the depot.")
    vehicles: List[Vehicle] = Field(..., min_items=1)
    demands: List[int]
    include_geometry: Optional[bool] = True
    time_limit_seconds: Optional[int] = 15

# --- API Endpoints ---
@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/optimize")
def optimize(req: OptimizeRequest):
    # 1. --- Initial Validation ---
    if not ORS_API_KEY:
        logging.error("ORS_API_KEY not found in environment variables.")
        raise HTTPException(status_code=500, detail="Server configuration error: ORS_API_KEY not set.")
    
    if len(req.demands) != len(req.locations):
        raise HTTPException(status_code=400, detail="The number of demands must match the number of locations.")
    
    if req.demands[0] != 0:
        raise HTTPException(status_code=400, detail="The demand for the first location (depot) must be 0.")

    # --- NEW: Detailed logging of the received request ---
    logging.info("--- VRP Optimization Request Received ---")
    try:
        vehicle_capacities = [v.capacity for v in req.vehicles]
        logging.info(f"Locations: {len(req.locations)}")
        logging.info(f"Vehicles: {len(req.vehicles)}")
        logging.info(f"Demands: {req.demands}")
        logging.info(f"Vehicle Capacities: {vehicle_capacities}")
        logging.info(f"Total Demand: {sum(req.demands)}")
        logging.info(f"Total Capacity: {sum(vehicle_capacities)}")
    except Exception as e:
        logging.error(f"Error during logging input data: {e}")
    logging.info("---------------------------------------")

    # 2. --- Pre-Solve Infeasibility Check ---
    if req.vehicles:
        max_vehicle_capacity = max(v.capacity for v in req.vehicles)
        for i, demand in enumerate(req.demands):
            if demand > max_vehicle_capacity:
                location_name = req.locations[i].name
                error_detail = f"Problem is infeasible. Demand for location '{location_name}' ({demand}) exceeds the largest vehicle capacity ({max_vehicle_capacity})."
                logging.warning(error_detail)
                raise HTTPException(status_code=400, detail=error_detail)

    # 3. --- External API Calls and Solving ---
    try:
        client = openrouteservice.Client(key=ORS_API_KEY)

        locations_coords = [(loc.latitude, loc.longitude) for loc in req.locations]
        location_names = [loc.name for loc in req.locations]
        vehicles_dict = jsonable_encoder(req.vehicles)

        logging.info("Fetching distance matrix from OpenRouteService...")
        distance_matrix = get_distance_matrix( locations_coords)
        if distance_matrix is None:
            raise HTTPException(status_code=503, detail="Failed to build distance matrix from ORS. The service may be unavailable.")
        
        logging.info("Distance matrix successfully built. Solving VRP...")
        optimized = solve_cvrp_without_restrictions(
            distance_matrix,
            vehicles_dict,
            req.demands,
            location_names,
            time_limit_seconds=req.time_limit_seconds
        )
        if not optimized:
            # CHANGED: More descriptive error message
            error_detail = "No solution found. The problem may be overly constrained (e.g., demands cannot be partitioned into vehicle capacities) or the solver timed out."
            logging.warning(error_detail)
            raise HTTPException(status_code=500, detail=error_detail)
        
        logging.info(f"Solution found for {len(optimized)} vehicle(s).")

        if req.include_geometry:
            logging.info("Computing route geometries...")
            optimized = compute_route_geometries(client, locations_coords, optimized)

    # --- NEW: Specific error handling for the ORS API ---
    except ApiError as e:
        logging.error(f"OpenRouteService API Error: {e}")
        raise HTTPException(status_code=503, detail=f"Error communicating with OpenRouteService API. Please check the API key and service status. Details: {e}")
    except Exception as e:
        logging.error(f"An unexpected error occurred during optimization: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected server error occurred: {e}")

    # 4. --- Return the successful result ---
    logging.info("Optimization complete. Returning result.")
    return jsonable_encoder({
        "result": optimized,
        "summary": {
            "vehicles_used": len(optimized),
            "total_distance_km": round(sum(v.get("Distance (km)", 0) for v in optimized), 2),
            "total_load": sum(v.get("Load Carried", 0) for v in optimized)
        }
    })