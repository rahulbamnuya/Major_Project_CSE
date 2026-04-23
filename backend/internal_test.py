import json
import logging
from vrp_solver import solve_cvrp_with_time_windows

logging.basicConfig(level=logging.INFO)

payload = {
    "locations": [
        {"latitude": 22.7565, "longitude": 75.8950}, # Sanchi
        {"latitude": 22.7245, "longitude": 75.8837}, # Palasia
        {"latitude": 22.7685, "longitude": 75.9081}, # Lasudia
        {"latitude": 22.8051, "longitude": 75.9604}, # Manglia
        {"latitude": 22.7042, "longitude": 75.8655}, # Sapna Sangeeta
        {"latitude": 22.7388, "longitude": 75.9036}, # Khajrana (Narrow)
        {"latitude": 22.7001, "longitude": 75.8361}  # Annapurna (Narrow)
    ],
    "vehicles": [
        {"id": "Tata_Ace_1", "capacity": 750, "average_speed": 25},
        {"id": "Tata_Ace_2", "capacity": 750, "average_speed": 25},
        {"id": "BharatBenz_Bulk", "capacity": 10000, "average_speed": 50}
    ],
    "demands": [0, 400, 3200, 4500, 500, 700, 650], 
    "time_windows": [(360*60, 1080*60), (420*60, 600*60), (480*60, 960*60), (540*60, 1020*60), (420*60, 840*60), (480*60, 1080*60), (420*60, 960*60)],
    "service_times": [0, 600, 1200, 1800, 600, 600, 600]
}

# Dummy distance matrix for quick test
n = len(payload["locations"])
dist_matrix = [[1000 for _ in range(n)] for _ in range(n)]
for i in range(n): dist_matrix[i][i] = 0

locations_coords = [(loc["latitude"], loc["longitude"]) for loc in payload["locations"]]

print("🚀 Running the Advanced Hybrid Geo Solver (Directly)...\n")
results = solve_cvrp_with_time_windows(
    distance_matrix=dist_matrix,
    vehicles=payload["vehicles"],
    demands=payload["demands"],
    time_windows_seconds=payload["time_windows"],
    service_times_seconds=payload["service_times"],
    avg_speed_kmh=40,
    time_limit_seconds=2,
    strategy="hybrid",
    locations_coords=locations_coords
)

if results:
    print("="*80)
    print(f"{'VRP OPTIMIZATION REPORT - ADVANCED GEO-ENGINE':^80}")
    print("="*80)
    
    for r in results:
        v_id = r['Vehicle ID']
        print(f"\n🚛 VEHICLE: {v_id:25} | LOAD: {r['Load Carried']:5} kg | DIST: {r['Distance (km)']:6} km")
        print("-" * 80)
        print(f"{'Stop':<5} | {'Location Name':<25} | {'Arrival':<8} | {'Service':<8} | {'Departure':<8} | {'Demand'}")
        print("-" * 80)
        
        path = r['Route Indices']
        arrivals = r['Arrival Times (seconds)']
        services = r['Service Times (seconds)']
        
        for i, node_idx in enumerate(path):
            # Map index back to location data
            loc_names = ["Sanchi Factory", "Palasia", "Lasudia", "Manglia", "Sapna Sangeeta", "Khajrana", "Annapurna"]
            name = loc_names[node_idx] if node_idx < len(loc_names) else f"Node {node_idx}"
            demand = payload["demands"][node_idx]
            
            arr_time = f"{int(arrivals[i]//3600):02d}:{(int(arrivals[i]%3600)//60):02d}"
            dep_time = f"{int((arrivals[i]+services[i])//3600):02d}:{(int((arrivals[i]+services[i])%3600)//60):02d}"
            
            print(f"{i:<5} | {name:<25} | {arr_time:<8} | {services[i]//60:<5} min | {dep_time:<8} | {demand:>4} kg")
        
        print("-" * 80)
    
    print(f"\n{'END OF LOGISTICS REPORT':^80}")
    print("="*80)
else:
    print("❌ No solution found.")
