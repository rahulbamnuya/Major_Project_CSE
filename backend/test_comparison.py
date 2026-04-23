import time
import os
import json
import pandas as pd
from vrp_solver import get_distance_matrix, solve_cvrp_with_time_windows

def run_local_comparison():
    print("--- Initiating Main Project Integration Test: Pre-Routing vs Hybrid ---")
    
    # 1. SAMPLE DATA (Indore & Sanchi Factory Context)
    locations = [
        (22.7565, 75.8950), # 0 Depot
        (22.7161, 75.8545), # 1
        (22.7533, 75.8937), # 2
        (22.7245, 75.8837), # 3
        (22.6896, 75.8674), # 4
        (22.7001, 75.8361), # 5
        (22.7388, 75.9036), # 6
        (22.6842, 75.8365), # 7
        (22.7042, 75.8655), # 8
        (22.7410, 75.8885), # 9
    ]
    
    vehicles = [
        {"id": "Tata_Ace_1", "capacity": 750},
        {"id": "Tata_Ace_2", "capacity": 750},
        {"id": "Mahindra_1", "capacity": 900},
        {"id": "Eicher_1", "capacity": 5000},
    ]
    
    demands = [0, 280, 310, 240, 350, 4200, 290, 210, 330, 270]
    total_locations = len(locations) - 1
    
    # 8AM to 6PM time windows
    time_windows_seconds = [(0, 86400)] + [(28800, 64800)] * 9
    service_times_seconds = [0, 600, 600, 600, 600, 1800, 600, 600, 600, 600]
    
    print("Calculating Physical Distance Matrix...")
    dist_matrix = get_distance_matrix(locations)
    os.makedirs("solutions", exist_ok=True)

    algorithms = [
        {"name": "Pre-Routing (Heuristic)", "strategy": "pre", "limit": 20},
        {"name": "Hybrid (Guided Local Search)", "strategy": "hybrid", "limit": 10}
    ]

    benchmark_results = []

    for algo in algorithms:
        print(f"\nExecuting {algo['name']}...")
        start_t = time.time()
        
        response = solve_cvrp_with_time_windows(
            dist_matrix, vehicles, demands, time_windows_seconds, service_times_seconds, 
            time_limit_seconds=algo['limit'], strategy=algo['strategy']
        )
        
        exec_time = time.time() - start_t
        active_routes = response.get("active_routes", [])
        dropped_nodes = response.get("dropped_nodes", [])
        
        total_dist = sum([r.get("Distance (km)", 0) for r in active_routes])
        fulfilled_count = total_locations - len(dropped_nodes)
        fulfillment_rate = (fulfilled_count / total_locations) * 100 if total_locations > 0 else 100
        
        benchmark_results.append({
            "Algorithm": algo['name'],
            "Execution Time (s)": round(exec_time, 2),
            "Total Distance (km)": round(total_dist, 2),
            "Stops Served": fulfilled_count,
            "Fulfillment Rate (%)": round(fulfillment_rate, 2),
            "Dropped Nodes": len(dropped_nodes)
        })

        # Save specific solution
        file_name = f"solutions/{algo['strategy']}_solution.json"
        with open(file_name, "w") as f:
            json.dump(response, f, indent=4)

    # Output Benchmark Table
    print("\n" + "="*70)
    print("API ALGORITHM PERFORMANCE BENCHMARK")
    print("="*70)
    df = pd.DataFrame(benchmark_results)
    print(df.to_string(index=False))
    print("="*70)
    
    df.to_csv("solutions/benchmark_report.csv", index=False)
    print("Benchmark report saved to solutions/benchmark_report.csv")

if __name__ == "__main__":
    run_local_comparison()

if __name__ == "__main__":
    run_local_comparison()
