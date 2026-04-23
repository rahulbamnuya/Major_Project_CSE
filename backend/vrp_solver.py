# vrp_solver.py

import logging
import math
from typing import List, Dict, Any, Tuple
from math import radians, sin, cos, sqrt, atan2
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
import openrouteservice
from geocoder import GeoIntelligence

# (compute_route_geometries and get_distance_matrix functions remain unchanged and are correct)
def compute_route_geometries(
    client: openrouteservice.Client,
    locations: List[Tuple[float, float]],
    optimized_data: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    for vehicle_route in optimized_data:
        path_indices = vehicle_route.get("Route Indices", [])
        if len(path_indices) < 2:
            vehicle_route["Route Geometry"] = []
            continue
        try:
            route_coords = [(locations[idx][1], locations[idx][0]) for idx in path_indices]
            route_response = client.directions(coordinates=route_coords, profile='driving-car', format='geojson')
            geometry = route_response['features'][0]['geometry']['coordinates']
            vehicle_route["Route Geometry"] = [[c[1], c[0]] for c in geometry]
        except Exception as e:
            logging.warning(f"ORS API failed for route: {e}. Falling back to straight-line coordinates.")
            vehicle_route["Route Geometry"] = [[locations[idx][0], locations[idx][1]] for idx in path_indices]
    return optimized_data

def get_distance_matrix(locations: List[Tuple[float, float]]) -> Dict[int, Dict[int, int]]:
    def _haversine_distance(lat1, lon1, lat2, lon2):
        R = 6371000
        rads = map(radians, [lat1, lon1, lat2, lon2])
        rad_lat1, rad_lon1, rad_lat2, rad_lon2 = rads
        dlon, dlat = rad_lon2 - rad_lon1, rad_lat2 - rad_lat1
        a = sin(dlat / 2)**2 + cos(rad_lat1) * cos(rad_lat2) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        return int(R * c)
    num_locations = len(locations)
    return {i: {j: _haversine_distance(locations[i][0], locations[i][1], locations[j][0], locations[j][1]) for j in range(num_locations)} for i in range(num_locations)}

# (solve_cvrp_without_restrictions is now fully correct)
def solve_cvrp_without_restrictions(
    distance_matrix: Dict[int, Dict[int, int]],
    vehicles: List[Dict[str, Any]],
    demands: List[int],
    service_times_seconds: List[int],
    road_types: List[str] = None,
    avg_speed_kmh: int = 40,
    time_limit_seconds: int = 30,
    traffic_factor: float = 1.25,
    small_threshold: int = 1000,
    medium_threshold: int = 4000
) -> List[Dict[str, Any]]:
    n_locations, depot_index = len(distance_matrix), 0
    
    # === DYNAMIC MULTI-TRIP EXPANSION ===
    total_capacity_single = sum(v["capacity"] for v in vehicles)
    total_demand = sum(demands)
    # Calculate needed trips with a safety buffer, but cap at 5 to keep search space manageable
    needed_trips = math.ceil(total_demand / (total_capacity_single if total_capacity_single > 0 else 1))
    MAX_TRIPS = max(2, min(5, needed_trips))
    
    expanded_vehicles = []
    for v in vehicles:
        for t in range(1, MAX_TRIPS + 1):
            cloned_v = v.copy()
            cloned_v["id"] = f"{v['id']}_Trip{t}"
            expanded_vehicles.append(cloned_v)
            
    n_vehicles = len(expanded_vehicles)
    manager = pywrapcp.RoutingIndexManager(n_locations, n_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)
    def distance_callback(from_idx, to_idx): return distance_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]
    transit_callback_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_idx)
    def demand_callback(from_idx): return demands[manager.IndexToNode(from_idx)]
    demand_callback_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_idx, 0, [v["capacity"] for v in expanded_vehicles], True, "Capacity")
    # --- HETEROGENEOUS FLEET SPEED CALCULATIONS ---
    time_callbacks = []
    
    def create_time_callback(v_speed_m_s):
        def _time_callback(from_idx, to_idx):
            from_node = manager.IndexToNode(from_idx)
            to_node = manager.IndexToNode(to_idx)
            dist = distance_matrix[from_node][to_node]
            if dist > 0:
                travel_time = int(((dist / v_speed_m_s) * traffic_factor) + 0.5)
                if travel_time == 0: travel_time = 1
            else:
                travel_time = 0
                
            service_time = service_times_seconds[from_node]
            return travel_time + service_time
        return _time_callback

    for v_idx, v in enumerate(expanded_vehicles):
        v_speed_kmh = v.get("average_speed") or avg_speed_kmh
        v_speed_m_s = (v_speed_kmh * 1000) / 3600
        
        callback = create_time_callback(v_speed_m_s)
        callback_idx = routing.RegisterTransitCallback(callback)
        time_callbacks.append(callback_idx)

    # Register Time Dimension supporting individual transit times
    routing.AddDimensionWithVehicleTransits(
        time_callbacks,
        30 * 3600,
        [24 * 3600] * n_vehicles,
        False,
        "Time"
    )
    time_dimension = routing.GetDimensionOrDie("Time")
    depot_start_seconds = 6 * 3600
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        time_dimension.CumulVar(index).SetMin(depot_start_seconds)

    # === MULTI-TRIP SEQUENTIAL CONSTRAINT ===
    # Force Trip N+1 to start after Trip N returns to depot
    for v_idx in range(n_vehicles):
        if v_idx % MAX_TRIPS > 0:
            previous_v_idx = v_idx - 1
            # Buffer: 15 minutes reload time (900 seconds)
            reload_buffer = 900 
            routing.solver().Add(
                time_dimension.CumulVar(routing.Start(v_idx)) >= 
                time_dimension.CumulVar(routing.End(previous_v_idx)) + reload_buffer
            )

    # === GEO-INTELLIGENCE RESTRICTION SETUP ===
    narrow_nodes, standard_nodes = [], []
    if road_types:
        for idx in range(n_locations):
            if idx == 0: continue
            rt = (road_types[idx] or "STANDARD").upper()
            if rt in ['NARROW', 'ALLEY', 'RESIDENTIAL']: narrow_nodes.append(idx)
            elif rt == 'STANDARD': standard_nodes.append(idx)

    # Categorize expanded fleet
    for v in expanded_vehicles:
        if v.get("vehicle_type"): v["type"] = v.get("vehicle_type")
        else:
            if v["capacity"] <= small_threshold: v["type"] = "SMALL"
            elif v["capacity"] <= medium_threshold: v["type"] = "MEDIUM"
            else: v["type"] = "LARGE"

    # ENFORCE GEOGRAPHIC RESTRICTIONS
    if narrow_nodes:
        allowed_small = [i for i, v in enumerate(expanded_vehicles) if v.get("type") == "SMALL"]
        if not allowed_small: # Fallback
            allowed_small = [i for i, v in enumerate(expanded_vehicles) if v.get("type") in ["SMALL", "MEDIUM"]]
        for n_idx in narrow_nodes:
            routing.VehicleVar(manager.NodeToIndex(n_idx)).SetValues(allowed_small)
            
    if standard_nodes:
        allowed_std = [i for i, v in enumerate(expanded_vehicles) if v.get("type") in ["SMALL", "MEDIUM"]]
        for s_idx in standard_nodes:
            routing.VehicleVar(manager.NodeToIndex(s_idx)).SetValues(allowed_std)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.time_limit.seconds = time_limit_seconds
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    solution = routing.SolveWithParameters(search_params)
    if not solution: return None
    results = []
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        if routing.IsEnd(solution.Value(routing.NextVar(index))): continue
        path, arrival_times, route_load = [], [], 0
        while not routing.IsEnd(index):
            node_idx = manager.IndexToNode(index)
            path.append(node_idx)
            arrival_times.append(solution.Value(time_dimension.CumulVar(index)))
            route_load += demands[node_idx]
            index = solution.Value(routing.NextVar(index))
        path.append(manager.IndexToNode(index))
        arrival_times.append(solution.Value(time_dimension.CumulVar(index)))
        if len(path) > 2:
            route_dist_meters = sum(distance_matrix[path[i]][path[i+1]] for i in range(len(path)-1))
            duration_seconds = arrival_times[-1] - arrival_times[0]
            results.append({
                "Vehicle ID": expanded_vehicles[v_id]["id"], "Route Indices": path, "Load Carried": route_load,
                "Distance (km)": round(route_dist_meters / 1000, 2), "Duration (seconds)": duration_seconds,
                "Arrival Times (seconds)": arrival_times, "Service Times (seconds)": [service_times_seconds[n] for n in path]
            })

    # Record dropped nodes
    dropped_nodes = []
    for i in range(1, n_locations):
        index = manager.NodeToIndex(i)
        if solution.Value(routing.NextVar(index)) == index:
            dropped_nodes.append({"index": i, "reason": "No feasible route found"})

    return {
        "active_routes": results,
        "dropped_nodes": dropped_nodes
    }

# --------------------- VRP Solver with Time Windows (NOW FULLY CORRECTED) ---------------------
def solve_cvrp_with_time_windows(
    distance_matrix: Dict[int, Dict[int, int]],
    vehicles: List[Dict[str, Any]],
    demands: List[int],
    time_windows_seconds: List[Tuple[int, int]],
    service_times_seconds: List[int],
    road_types: List[str] = None,
    avg_speed_kmh: int = 40,
    time_limit_seconds: int = 30,
    traffic_factor: float = 1.25,
    strategy: str = "hybrid",
    small_threshold: int = 1000,
    medium_threshold: int = 4000
) -> List[Dict[str, Any]]:
    n_locations, n_vehicles, depot_index = len(distance_matrix), len(vehicles), 0
    speed_m_per_s = avg_speed_kmh * 1000 / 3600
    
    # === GEO-INTELLIGENCE RESTRICTION SETUP ===
    narrow_nodes = []
    standard_nodes = []
    
    if road_types:
        logging.info("Applying frontend-provided road type restrictions...")
        for idx in range(n_locations):
            # Fast-skip depot (it's a highway/depot)
            if idx == 0: continue
            
            road_type = (road_types[idx] or "STANDARD").upper()
            if road_type in ['NARROW', 'ALLEY', 'RESIDENTIAL', 'PEDESTRIAN', 'BRIDGE_RESTRICTED']:
                narrow_nodes.append(idx)
            elif road_type == 'STANDARD':
                standard_nodes.append(idx)
                
        logging.info(f"Found {len(narrow_nodes)} NARROW and {len(standard_nodes)} STANDARD restricted nodes.")
            
    # === DYNAMIC MULTI-TRIP EXPANSION ===
    # Calculate needed trips with a safety buffer, capped at 10 to handle extreme demand/fleet gaps
    total_capacity_single = sum(v["capacity"] for v in vehicles)
    total_demand = sum(demands)
    needed_trips = math.ceil(total_demand / (total_capacity_single if total_capacity_single > 0 else 1))
    MAX_TRIPS = max(2, min(10, needed_trips + 1))
    
    logging.info(f"🚀 Expansion: Requesting {total_demand}kg with {total_capacity_single}kg fleet. Multi-trip budget: {MAX_TRIPS} trips/veh.")

    expanded_vehicles = []
    for v in vehicles:
        for t in range(1, MAX_TRIPS + 1):
            cloned_v = v.copy()
            # Trip Branding: Correctly label the vehicle in the output
            trip_label = f" (Trip {t})" if t > 1 else ""
            cloned_v["id"] = f"{v['id']}_T{t}"
            cloned_v["name_with_trip"] = f"{v.get('name', 'Vehicle')}{trip_label}"
            cloned_v["trip_index"] = t
            expanded_vehicles.append(cloned_v)
            
    # Assign categories to expanded vehicles based on explicit DB fields, fallback to capacity
    for v in expanded_vehicles:
        if v.get("vehicle_type"):
            v["type"] = v.get("vehicle_type")
        else:
            if v["capacity"] <= small_threshold: v["type"] = "SMALL"
            elif v["capacity"] <= medium_threshold: v["type"] = "MEDIUM"
            else: v["type"] = "LARGE"
    
    logging.info(f"Fleet thresholds — SMALL: ≤{small_threshold}kg, MEDIUM: ≤{medium_threshold}kg, LARGE: >{medium_threshold}kg")

    n_vehicles = len(expanded_vehicles)
    manager = pywrapcp.RoutingIndexManager(n_locations, n_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # === TIERED FIXED COSTS ===
    # Encourage the solver to use ALL physical vehicles for Trip 1 before using Trip 2.
    # We set a massive penalty for activating a second trip if a first trip slot is available.
    for i, v in enumerate(expanded_vehicles):
        if v["trip_index"] == 1:
            routing.SetFixedCostOfVehicle(10, i)
        else:
            routing.SetFixedCostOfVehicle(500000, i) # Massive penalty for Trip 2+ usage

    # --- HETEROGENEOUS FLEET SPEED CALCULATIONS ---
    time_callbacks = []
    
    def create_time_callback(v_speed_m_s):
        def _time_callback(from_idx, to_idx):
            from_node, to_node = manager.IndexToNode(from_idx), manager.IndexToNode(to_idx)
            dist = distance_matrix[from_node][to_node]
            if dist > 0:
                travel_time = int(((dist / v_speed_m_s) * traffic_factor) + 0.5)
                if travel_time == 0: travel_time = 1
            else:
                travel_time = 0
            
            service_time = service_times_seconds[from_node]
            return travel_time + service_time
        return _time_callback

    for v_idx, v in enumerate(expanded_vehicles):
        # Extract vehicle-specific speed or fallback
        v_speed_kmh = v.get("average_speed") or avg_speed_kmh
        v_speed_m_s = (v_speed_kmh * 1000) / 3600
        
        callback = create_time_callback(v_speed_m_s)
        callback_idx = routing.RegisterTransitCallback(callback)
        time_callbacks.append(callback_idx)
        
        # We also assign the cost of the vehicle path dynamically based on its time transit
        routing.SetArcCostEvaluatorOfVehicle(callback_idx, v_idx)

    # Register Time Dimension supporting individual transit times
    routing.AddDimensionWithVehicleTransits(
        time_callbacks,
        int(30 * 3600),  # Max slack time
        int(24 * 3600),  # Max total time
        False, 
        "Time"
    )
    time_dimension = routing.GetDimensionOrDie("Time")
    
    # This loop sets the specific time windows for customers.
    for loc_idx, (start_s, end_s) in enumerate(time_windows_seconds):
        index = manager.NodeToIndex(loc_idx)
        # Force the earliest arrival
        time_dimension.CumulVar(index).SetMin(start_s)
        
        # Soft upper bound: Penalty for being late (ensures node is NOT dropped)
        # We set this lower than the Drop Penalty so the solver prefers being late over dropping.
        late_penalty = 1000000 
        time_dimension.SetCumulVarSoftUpperBound(index, end_s, late_penalty)

    # ========================== THE FINAL, CRITICAL FIX ==========================
    # Force the actual start time to be no earlier than 6 AM for FIRST trips.
    depot_start_seconds = 6 * 3600 # 6 AM
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        if v_id % MAX_TRIPS == 0:
            time_dimension.CumulVar(index).SetMin(depot_start_seconds)
        else:
            time_dimension.CumulVar(index).SetMin(0)
    # ===========================================================================
    
    # === MULTI-TRIP SEQUENTIAL CONSTRAINT ===
    for v_idx in range(n_vehicles):
        if v_idx % MAX_TRIPS > 0:
            previous_v_idx = v_idx - 1
            # Buffer: 5 minutes reload time (300 seconds)
            reload_buffer = 300 
            routing.solver().Add(
                time_dimension.CumulVar(routing.Start(v_idx)) >= 
                time_dimension.CumulVar(routing.End(previous_v_idx)) + reload_buffer
            )

    # ========================== DROP NODES FAIL-SAFE ==========================
    # We use a massive penalty to ensure nodes are ONLY dropped if physically impossible.
    drop_penalty = 5000000 
    for node in range(1, n_locations):
        routing.AddDisjunction([manager.NodeToIndex(node)], drop_penalty)

    # ENFORCE GEOGRAPHIC RESTRICTIONS (3-TIER HIERARCHY)
    if narrow_nodes:
        allowed_small_vehicles = [i for i, v in enumerate(expanded_vehicles) if v.get("type") == "SMALL"]
        
        # FAIL-SAFE: If no small vehicles exist, allow MEDIUM vehicles as a fallback 
        if not allowed_small_vehicles:
            logging.warning("⚠️ Narrow roads detected but NO SMALL VEHICLES in fleet. Allowing MEDIUM fallback.")
            allowed_small_vehicles = [i for i, v in enumerate(expanded_vehicles) if v.get("type") in ["SMALL", "MEDIUM"]]

        for n_idx in narrow_nodes:
            index = manager.NodeToIndex(n_idx)
            if allowed_small_vehicles:
                routing.VehicleVar(index).SetValues(allowed_small_vehicles)
            else:
                 logging.error(f"❌ No compatible vehicles (Small/Medium) for NARROW node {n_idx}")

    if standard_nodes:
        allowed_std_vehicles = [i for i, v in enumerate(expanded_vehicles) if v.get("type") in ["SMALL", "MEDIUM"]]
        for s_idx in standard_nodes:
            index = manager.NodeToIndex(s_idx)
            if allowed_std_vehicles:
                routing.VehicleVar(index).SetValues(allowed_std_vehicles)
            else:
                 logging.error(f"❌ No compatible vehicles for STANDARD node {s_idx}")

    def demand_callback(from_idx): return demands[manager.IndexToNode(from_idx)]
    demand_callback_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_idx, 0, [v["capacity"] for v in expanded_vehicles], True, "Capacity")

    # Global span optimization ensures the solver balances the load across all active vehicles.
    time_dimension.SetGlobalSpanCostCoefficient(100)

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.SAVINGS
    
    if strategy == "hybrid":
        search_params.time_limit.seconds = time_limit_seconds
        search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    else:
        search_params.time_limit.seconds = 2
        search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.AUTOMATIC

    solution = routing.SolveWithParameters(search_params)
    
    # [STRATEGY FALLBACK] If SAVINGS (Clarke-Wright) failed to find ANY initial solution
    # (common if constraints are very tight), retry with a more permissive strategy.
    if not solution:
        logging.warning("⚠️ Clarke-Wright (SAVINGS) failed to find initial solution. Retrying with Path Cheapest Arc...")
        search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        solution = routing.SolveWithParameters(search_params)

    if not solution: return None
    results = []
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        if routing.IsEnd(solution.Value(routing.NextVar(index))): continue
        path, arrival_times, route_load = [], [], 0
        while not routing.IsEnd(index):
            node_idx = manager.IndexToNode(index)
            path.append(node_idx)
            arrival_times.append(solution.Value(time_dimension.CumulVar(index)))
            route_load += demands[node_idx]
            index = solution.Value(routing.NextVar(index))
        path.append(manager.IndexToNode(index))
        arrival_times.append(solution.Value(time_dimension.CumulVar(index)))
        if len(path) > 2:
            route_dist_meters = sum(distance_matrix[path[i]][path[i+1]] for i in range(len(path)-1))
            duration_seconds = arrival_times[-1] - arrival_times[0]
            results.append({
                "Vehicle ID": expanded_vehicles[v_id]["id"], 
                "Vehicle Name": expanded_vehicles[v_id].get("name_with_trip", "Vehicle"),
                "Route Indices": path, "Load Carried": route_load,
                "Distance (km)": round(route_dist_meters / 1000, 2), "Duration (seconds)": duration_seconds,
                "Arrival Times (seconds)": arrival_times, "Service Times (seconds)": [service_times_seconds[n] for n in path]
            })

    # Record dropped nodes
    dropped_nodes = []
    for i in range(1, n_locations):
        index = manager.NodeToIndex(i)
        if solution.Value(routing.NextVar(index)) == index:
            # Check why it was dropped
            node_demand = demands[i]
            total_fleet_cap = sum(v["capacity"] for v in expanded_vehicles)
            
            reason = "Constraints (Time/Capacity/Geography) could not be met"
            if node_demand > max(v["capacity"] for v in vehicles):
                 reason = f"Item too big for any single vehicle ({node_demand} units)"
            elif i in narrow_nodes and not [v for v in vehicles if v.get("capacity", 9999) <= small_threshold]:
                 reason = "Infrastructure Restriction (Narrow Road - No Small Vehicle)"

            dropped_nodes.append({
                "index": i,
                "name": f"Location {i}",
                "reason": reason,
                "demand": node_demand
            })
            
    if dropped_nodes:
        logging.warning(f"Solver dropped {len(dropped_nodes)} nodes due to constraint violations.")
        
    return {
        "active_routes": results,
        "dropped_nodes": dropped_nodes
    }