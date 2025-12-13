# vrp_solver.py

import logging
from typing import List, Dict, Any, Tuple
from math import radians, sin, cos, sqrt, atan2
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
import openrouteservice

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
    avg_speed_kmh: int = 40,
    time_limit_seconds: int = 30,
    traffic_factor: float = 1.25
) -> List[Dict[str, Any]]:
    n_locations, n_vehicles, depot_index = len(distance_matrix), len(vehicles), 0
    speed_m_per_s = avg_speed_kmh * 1000 / 3600
    manager = pywrapcp.RoutingIndexManager(n_locations, n_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)
    def distance_callback(from_idx, to_idx): return distance_matrix[manager.IndexToNode(from_idx)][manager.IndexToNode(to_idx)]
    transit_callback_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_idx)
    def demand_callback(from_idx): return demands[manager.IndexToNode(from_idx)]
    demand_callback_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_idx, 0, [v["capacity"] for v in vehicles], True, "Capacity")
    def time_callback(from_idx, to_idx):
        from_node, to_node = manager.IndexToNode(from_idx), manager.IndexToNode(to_idx)
        travel_time = int((distance_matrix[from_node][to_node] / speed_m_per_s) * traffic_factor)
        service_time = service_times_seconds[from_node]
        return travel_time + service_time
    time_callback_idx = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(time_callback_idx, 30 * 3600, 24 * 3600, False, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")
    depot_start_seconds = 6 * 3600
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        time_dimension.CumulVar(index).SetMin(depot_start_seconds)
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
                "Vehicle ID": vehicles[v_id]["id"], "Route Indices": path, "Load Carried": route_load,
                "Distance (km)": round(route_dist_meters / 1000, 2), "Duration (seconds)": duration_seconds,
                "Arrival Times (seconds)": arrival_times, "Service Times (seconds)": [service_times_seconds[n] for n in path]
            })
    return results

# --------------------- VRP Solver with Time Windows (NOW FULLY CORRECTED) ---------------------
def solve_cvrp_with_time_windows(
    distance_matrix: Dict[int, Dict[int, int]],
    vehicles: List[Dict[str, Any]],
    demands: List[int],
    time_windows_seconds: List[Tuple[int, int]],
    service_times_seconds: List[int],
    avg_speed_kmh: int = 40,
    time_limit_seconds: int = 30,
    traffic_factor: float = 1.25
) -> List[Dict[str, Any]]:
    n_locations, n_vehicles, depot_index = len(distance_matrix), len(vehicles), 0
    speed_m_per_s = avg_speed_kmh * 1000 / 3600
    manager = pywrapcp.RoutingIndexManager(n_locations, n_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)
    def time_callback(from_idx, to_idx):
        from_node, to_node = manager.IndexToNode(from_idx), manager.IndexToNode(to_idx)
        travel_time = int((distance_matrix[from_node][to_node] / speed_m_per_s) * traffic_factor)
        service_time = service_times_seconds[from_node]
        return travel_time + service_time
    time_callback_idx = routing.RegisterTransitCallback(time_callback)
    routing.AddDimension(time_callback_idx, 30 * 3600, 24 * 3600, False, "Time")
    time_dimension = routing.GetDimensionOrDie("Time")
    
    # This loop sets the specific time windows for customers, which is correct.
    for loc_idx, (start_s, end_s) in enumerate(time_windows_seconds):
        index = manager.NodeToIndex(loc_idx)
        time_dimension.CumulVar(index).SetRange(start_s, end_s)

    # ========================== THE FINAL, CRITICAL FIX ==========================
    # Add a fail-safe rule. Even if the depot's window from the input is [0, 86400],
    # this line FORCES the actual start time to be no earlier than 6 AM.
    # This makes the behavior identical to the `without_restrictions` solver.
    depot_start_seconds = 6 * 3600 # 6 AM
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        time_dimension.CumulVar(index).SetMin(depot_start_seconds)
    # ===========================================================================

    def demand_callback(from_idx): return demands[manager.IndexToNode(from_idx)]
    demand_callback_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(demand_callback_idx, 0, [v["capacity"] for v in vehicles], True, "Capacity")
    routing.SetArcCostEvaluatorOfAllVehicles(time_callback_idx)
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.time_limit.seconds = time_limit_seconds
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
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
                "Vehicle ID": vehicles[v_id]["id"], "Route Indices": path, "Load Carried": route_load,
                "Distance (km)": round(route_dist_meters / 1000, 2), "Duration (seconds)": duration_seconds,
                "Arrival Times (seconds)": arrival_times, "Service Times (seconds)": [service_times_seconds[n] for n in path]
            })
    return results