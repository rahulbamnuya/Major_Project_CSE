
import sys
import os
from vrp_solver import solve_cvrp_with_time_windows

# Simple distance matrix (triangle + depot)
dist_matrix = {
    0: {0: 0, 1: 5000, 2: 5000, 3: 10000},
    1: {0: 5000, 1: 0, 2: 2000, 3: 5000},
    2: {0: 5000, 1: 2000, 2: 0, 3: 5000},
    3: {0: 10000, 1: 5000, 2: 5000, 3: 0}
}

# 1 vehicle with 400 capacity. Locations have 300 demand each.
# Total demand = 900. Max Trips = 3 needed.
vehicles = [{"id": "TruckA", "capacity": 400}]
demands = [0, 300, 300, 300]
time_windows = [(0, 86400), (0, 86400), (0, 86400), (0, 86400)]
service_times = [0, 600, 600, 600] # 10 mins each

print("Starting Sequential Verification Test...")

result = solve_cvrp_with_time_windows(
    distance_matrix=dist_matrix,
    vehicles=vehicles,
    demands=demands,
    time_windows_seconds=time_windows,
    service_times_seconds=service_times,
    avg_speed_kmh=40
)

active_routes = result['active_routes']
print(f"Total Routes: {len(active_routes)}")

# Sort by Vehicle name (which includes trip info)
active_routes.sort(key=lambda x: x['Vehicle ID'])

previous_end = -1
for r in active_routes:
    start_time = r['Arrival Times (seconds)'][0]
    end_time = r['Arrival Times (seconds)'][-1]
    vid = r['Vehicle ID']
    
    print(f"Vehicle: {vid} | Start: {start_time} | End: {end_time}")
    
    if previous_end != -1:
        if start_time < previous_end:
            print(f"FAILURE: Sequential violation! {vid} started at {start_time} but previous ended at {previous_end}")
            sys.exit(1)
        else:
            print(f"SUCCESS: {vid} started {start_time - previous_end}s after previous trip.")
    
    previous_end = end_time

print("\n--- TEST COMPLETED SUCCESSFULLY ---")
