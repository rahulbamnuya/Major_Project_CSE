import requests
import time
import json
import os
from dotenv import load_dotenv

load_dotenv()

CACHE_FILE = "geo_cache.json"

class GeoIntelligence:
    def __init__(self):
        if os.path.exists(CACHE_FILE):
            with open(CACHE_FILE, 'r') as f:
                self.cache = json.load(f)
        else:
            self.cache = {}

    def save_cache(self):
        with open(CACHE_FILE, 'w') as f:
            json.dump(self.cache, f)

    def get_road_metadata(self, lat, lon):
        """
        Calls OpenStreetMap Nominatim API to find out if a location is an alley, market, or street.
        """
        coord_key = f"{lat},{lon}"
        if coord_key in self.cache:
            return self.cache[coord_key]

        headers = {'User-Agent': 'RouteOptimizationEngine/1.0'}
        url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=18"
        
        try:
            time.sleep(1.1) 
            response = requests.get(url, headers=headers)
            if response.status_code == 200:
                data = response.json()
                
                address = data.get('address', {})
                osm_type = data.get('type', 'standard')
                road = address.get('road', '')
                suburb = address.get('suburb', '')
                
                res = 'street'
                is_bridge = data.get('address', {}).get('bridge') or 'bridge' in data.get('display_name', '').lower()
                
                if osm_type in ['footway', 'path', 'pedestrian', 'residential']:
                    res = 'alley'
                elif 'market' in suburb.lower() or 'market' in road.lower() or osm_type == 'marketplace':
                    res = 'market'
                elif osm_type in ['secondary', 'tertiary']:
                    res = 'street'
                elif osm_type in ['primary', 'trunk', 'motorway']:
                    res = 'highway'
                
                if is_bridge:
                    res = 'bridge_restricted' 
                
                self.cache[coord_key] = res
                self.save_cache()
                return res
        except Exception as e:
            print(f"⚠️ Geocoding Error for {coord_key}: {e}")
            
        return 'street'

    def get_matrix(self, nodes):
        api_key = os.getenv("ORS_API_KEY")
        if not api_key:
            return None, None

        coords = [[n.lon, n.lat] for n in nodes]
        url = "https://api.openrouteservice.org/v2/matrix/driving-car"
        headers = {
            'Authorization': api_key,
            'Content-Type': 'application/json'
        }
        body = {"locations": coords, "metrics": ["distance", "duration"]}

        try:
            response = requests.post(url, json=body, headers=headers, timeout=10)
            data = response.json()
            
            if 'distances' in data and 'durations' in data:
                return data['distances'], data['durations']
            else:
                return None, None
        except Exception as e:
            return None, None
