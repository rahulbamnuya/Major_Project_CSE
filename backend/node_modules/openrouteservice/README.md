# Openrouteservice API for JavaScript/TypeScript

## A type-safe solution to consume the Openrouteservice API

Please read the API documentation at [Openrouteservice](https://openrouteservice.org/dev/#/api-docs) and grab an [API key](https://openrouteservice.org/dev/#/login).

To use, just create an instance of the API and call your function:
```typescript
import Openrouteservice from 'openrouteservice';
import { Profile } from 'openrouteservice/dist/common.js';
import { DirectionsFormat } from 'openrouteservice/dist/directions.js';

const ors = new Openrouteservice(API_KEY);
const directions = await ors.getDirections(
    Profile.DRIVING_CAR,
    DirectionsFormat.JSON,
    {
        coordinates: [
            [-121.86592918628558, 37.41513158647777],
            [-121.86597210162844, 37.424061505151634]
        ]
    }
);

console.log(directions);
console.log(
    directions.routes[0].geometry
        && 
    Openrouteservice.decodePolyline(directions.routes[0].geometry, true)
);
```