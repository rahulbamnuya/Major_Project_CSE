import requests
import json
import time

url = "http://127.0.0.1:8001/optimize"

# Test payload mirroring a real day at Sanchi Dairy in Indore
payload = {
    "locations": [
        {
            "name": "Sanchi Factory (Depot)", # 0
            "latitude": 22.7565,
            "longitude": 75.8950,
            "serviceTime": 0,
            "timeWindowStart": 360, "timeWindowEnd": 1080
        },
        {
            "name": "Palasia_Square", # 1 (Street/Highway, 400kg)
            "latitude": 22.7245,
            "longitude": 75.8837,
            "timeWindowStart": 420, "timeWindowEnd": 600
        },
        {
            "name": "Lasudia_Mori_Industrial", # 2 (Large Drop)
            "latitude": 22.7685,
            "longitude": 75.9081,
            "timeWindowStart": 480, "timeWindowEnd": 960
        },
        {
            "name": "Manglia_Highway_Hub", # 3 (Large Drop)
            "latitude": 22.8051,
            "longitude": 75.9604,
            "timeWindowStart": 540, "timeWindowEnd": 1020
        },
        {
            "name": "Sapna_Sangeeta_Market", # 4 (Street/Market)
            "latitude": 22.7042,
            "longitude": 75.8655,
            "timeWindowStart": 420, "timeWindowEnd": 840
        },
        {
            "name": "Khajrana_Temple_Lane", # 5 (Narrow Drop)
            "latitude": 22.7388,
            "longitude": 75.9036,
            "timeWindowStart": 480, "timeWindowEnd": 1080
        },
        {
            "name": "Annapurna_Residential", # 6 (Narrow Drop)
            "latitude": 22.7001,
            "longitude": 75.8361,
            "timeWindowStart": 420, "timeWindowEnd": 960
        }
    ],
    "vehicles": [
        {"id": "Tata_Ace_1", "capacity": 750},       # SMALL
        {"id": "Tata_Ace_2", "capacity": 750},       # SMALL
        {"id": "Mahindra_Supro_1", "capacity": 900}, # SMALL
        {"id": "Tata_407_1", "capacity": 2500},      # MEDIUM
        {"id": "Tata_407_2", "capacity": 2500},      # MEDIUM
        {"id": "BharatBenz_Bulk", "capacity": 10000} # LARGE
    ],
    "demands": [0, 400, 3200, 4500, 500, 700, 650],
    "useTimeWindows": True,
    "strategy": "hybrid",
    "include_geometry": False,  
    "time_limit_seconds": 10,
    "avg_speed_kmh": 30
}

print(f"📡 Sending Optimization Request to FastAPI API ({url})...")
start_time = time.time()

try:
    response = requests.post(url, json=payload)
    print(f"⏳ Response received in {time.time() - start_time:.2f} seconds.")
    
    if response.status_code == 200:
        print("\n✅ SUCCESS! Response Payload:")
        print(json.dumps(response.json(), indent=2))
    else:
        print(f"\n❌ FAILED. Status Code: {response.status_code}")
        print(response.text)
except requests.exceptions.ConnectionError:
    print("\n❌ API is down. Ensure uvicorn is running.")
