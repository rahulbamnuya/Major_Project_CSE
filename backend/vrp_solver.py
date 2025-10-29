import logging
from ortools.constraint_solver import pywrapcp, routing_enums_pb2
from openrouteservice.exceptions import ApiError
from math import radians, sin, cos, sqrt, atan2
# def get_distance_matrix(client, locations):
#     """
#     Fetches a distance matrix from the OpenRouteService API.
    
#     Args:
#         client: An initialized openrouteservice.Client instance.
#         locations: A list of (latitude, longitude) tuples.
        
#     Returns:
#         A dictionary-based matrix of distances in meters, or None if the API call fails.
#     """
#     try:
#         # ORS expects coordinates in (longitude, latitude) format.
#         coordinates = [(lon, lat) for lat, lon in locations]
        
#         matrix_response = client.distance_matrix(
#             locations=coordinates,
#             profile='driving-car',
#             metrics=['distance'],
#             units='m'
#         )
        
#         # Convert the list-of-lists response to a more stable dict-of-dicts.
#         # Use a large number for unreachable locations.
#         distance_matrix = {
#             i: {j: int(dist) if dist is not None else 9999999 for j, dist in enumerate(row)}
#             for i, row in enumerate(matrix_response['distances'])
#         }
#         return distance_matrix
        
#     except ApiError as e:
#         logging.error(f"ORS ApiError in get_distance_matrix: {e}")
#         return None
#     except Exception as e:
#         logging.error(f"Unexpected error in get_distance_matrix: {e}")
#         return None
def get_distance_matrix(locations):
    """
    Calculates a distance matrix using the Haversine formula (straight-line distance).
    
    Args:
        locations: A list of (latitude, longitude) tuples.
        
    Returns:
        A dictionary-based matrix of distances in integer meters.
    """
    
    def _haversine_distance(lat1, lon1, lat2, lon2):
        """Calculates the straight-line distance between two points in meters."""
        R = 6371000  # Earth radius in meters
        
        rad_lat1 = radians(lat1)
        rad_lon1 = radians(lon1)
        rad_lat2 = radians(lat2)
        rad_lon2 = radians(lon2)
        
        dlon = rad_lon2 - rad_lon1
        dlat = rad_lat2 - rad_lat1
        
        a = sin(dlat / 2)**2 + cos(rad_lat1) * cos(rad_lat2) * sin(dlon / 2)**2
        c = 2 * atan2(sqrt(a), sqrt(1 - a))
        
        return int(R * c) # Return distance in integer meters

    num_locations = len(locations)
    distance_matrix = {}
    
    logging.info("Building distance matrix using Haversine formula...")
    for i in range(num_locations):
        distance_matrix[i] = {}
        for j in range(num_locations):
            if i == j:
                distance_matrix[i][j] = 0
            else:
                lat1, lon1 = locations[i]
                lat2, lon2 = locations[j]
                distance_matrix[i][j] = _haversine_distance(lat1, lon1, lat2, lon2)
    
    logging.info("Successfully built distance matrix.")
    return distance_matrix
def solve_cvrp_without_restrictions(distance_matrix, vehicles, demands, location_names, time_limit_seconds=15):
    """
    Solves the Capacitated Vehicle Routing Problem using OR-Tools.
    """
    n_locations = len(distance_matrix)
    n_vehicles = len(vehicles)
    depot_index = 0
    
    manager = pywrapcp.RoutingIndexManager(n_locations, n_vehicles, depot_index)
    routing = pywrapcp.RoutingModel(manager)

    # --- Callbacks ---
    def distance_callback(from_idx, to_idx):
        """Returns the distance between two nodes."""
        from_node = manager.IndexToNode(from_idx)
        to_node = manager.IndexToNode(to_idx)
        return distance_matrix[from_node][to_node]

    transit_callback_idx = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_idx)

    def demand_callback(from_idx):
        """Returns the demand of a node."""
        from_node = manager.IndexToNode(from_idx)
        return demands[from_node]

    demand_callback_idx = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_idx,
        0,  # null capacity slack
        [v["capacity"] for v in vehicles],  # vehicle capacities array
        True,  # start cumul to zero
        "Capacity"
    )

    # --- Search Parameters ---
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.time_limit.seconds = time_limit_seconds
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC

    solution = routing.SolveWithParameters(search_params)
    
    if not solution:
        logging.warning("OR-Tools solver could not find a solution.")
        return None

    # --- Process Solution ---
    results = []
    for v_id in range(n_vehicles):
        index = routing.Start(v_id)
        # Skip unused vehicles
        if routing.IsEnd(solution.Value(routing.NextVar(index))):
            continue

        path = []
        route_load = 0
        while not routing.IsEnd(index):
            node_idx = manager.IndexToNode(index)
            path.append(node_idx)
            if node_idx != depot_index:
                route_load += int(demands[node_idx])
            index = solution.Value(routing.NextVar(index))
        # Add the final depot stop to complete the loop
        final_node_idx = manager.IndexToNode(index)
        path.append(final_node_idx)

        # Calculate route distance from the pre-computed matrix
        route_dist_meters = 0
        for i in range(len(path) - 1):
            route_dist_meters += distance_matrix[path[i]][path[i+1]]
            
        vehicle_data = vehicles[v_id]

        if len(path) > 2: # Ensure the route has at least one stop besides the depot
            route_with_names = " → ".join(location_names[n] for n in path)
            distance_km = round(route_dist_meters / 1000, 2)
            
            # Use provided costs or a sensible default if they are missing
            fuel_cost_per_km = vehicle_data.get("fuel_cost_per_km") or 5.0
            driver_cost_per_km = vehicle_data.get("driver_cost_per_km") or 7.0
            
            fuel_cost = round(distance_km * fuel_cost_per_km, 2)
            driver_cost = round(distance_km * driver_cost_per_km, 2)
            
            results.append({
                "Vehicle ID": vehicle_data["id"],
                "Vehicle Type": vehicle_data.get("type", "N/A"),
                "Vehicle Capacity": vehicle_data["capacity"],
                "Route": route_with_names,
                "Route Indices": path,
                "Load Carried": route_load,
                "Distance (km)": distance_km,
                "Fuel Cost (₹)": fuel_cost,
                "Driver Cost (₹)": driver_cost,
                "Total Route Cost (₹)": fuel_cost + driver_cost
            })
            
    logging.info(f"OR-Tools solver successfully processed {len(results)} routes.")
    return results

def compute_route_geometries(client, locations, optimized_data):
    """
    Fetches route geometry for each route in a single API call per route.
    This is much more efficient and avoids rate limiting.
    """
    for vehicle_route in optimized_data:
        path_indices = vehicle_route.get("Route Indices", [])
        
        if len(path_indices) < 2:
            vehicle_route["Route Geometry"] = []
            continue

        try:
            # Get the list of coordinates for the entire route
            # ORS expects (longitude, latitude)
            route_coords = [
                (locations[idx][1], locations[idx][0]) for idx in path_indices
            ]

            # Make a single API call for the whole route
            route_response = client.directions(
                coordinates=route_coords,
                profile='driving-car',
                format='geojson'
            )
            
            # Extract the geometry and convert from [lon, lat] to [lat, lon] for the frontend
            geometry = route_response['features'][0]['geometry']['coordinates']
            vehicle_route["Route Geometry"] = [[c[1], c[0]] for c in geometry]

        except Exception as e:
            logging.warning(f"ORS directions API failed for an entire route: {e}. Falling back to straight lines.")
            # Fallback: create a simple straight-line geometry if the API fails
            vehicle_route["Route Geometry"] = [
                [locations[idx][0], locations[idx][1]] for idx in path_indices
            ]
            
    return optimized_data