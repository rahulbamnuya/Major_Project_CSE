import { LineString, Point, Position } from "geojson";
import { Profile } from "./common.js";
import { BasicDirectionsResponse, DirectionsFormat, DirectionsQuery, DirectionsResponseJSON, DirectionsResponseGeoJSON, DirectionsResponseGPX } from "./directions.js";
import { ElevationResponsePointGeoJSON, ElevationResponseLineGeoJSON, ElevationResponsePoint, ElevationResponseLine, ElevationResponseEncodedPolyline } from "./elevation.js";
import { GeocodeStructuredQuery, GeocodeQuery, GeocodeResponse, GeocodeReverseQuery } from "./geocode.js";
import { IsochronesQuery, IsochronesResponse } from "./isochrones.js";
import { MatrixQuery, MatrixResponse } from "./matrix.js";
import { POIQuery, POIRequestType, POIResponsePOIs, POIResponseStats, POIResponseList } from "./poi.js";
export default class Openrouteservice {
    private apiKey;
    constructor(apiKey: string);
    private orsFetch;
    getBasicDirections: (profile: Profile, start: Position, end: Position) => Promise<BasicDirectionsResponse>;
    getDirections(profile: Profile, format: DirectionsFormat.JSON, query: DirectionsQuery): Promise<DirectionsResponseJSON>;
    getDirections(profile: Profile, format: DirectionsFormat.GEOJSON, query: DirectionsQuery): Promise<DirectionsResponseGeoJSON>;
    getDirections(profile: Profile, format: DirectionsFormat.GPX, query: DirectionsQuery): Promise<DirectionsResponseGPX>;
    getIsochrones: (profile: Profile, query: IsochronesQuery) => Promise<IsochronesResponse>;
    getMatrix: (profile: Profile, query: MatrixQuery) => Promise<MatrixResponse>;
    static unflattenResult(res: any): any;
    getGeocodeSearch(query: string | GeocodeStructuredQuery, additionalQuery?: GeocodeQuery): Promise<GeocodeResponse>;
    getGeocodeAutocomplete(text: string, query?: GeocodeQuery): Promise<GeocodeResponse>;
    getGeocodeReverse(query: GeocodeReverseQuery): Promise<GeocodeResponse>;
    getPOIs(query: POIQuery & {
        request: POIRequestType.PLACES_OF_INTEREST;
    }): Promise<POIResponsePOIs>;
    getPOIs(query: POIQuery & {
        request: POIRequestType.STATISTICS;
    }): Promise<POIResponseStats>;
    getPOIs(query: POIQuery & {
        request: POIRequestType.LIST;
    }): Promise<POIResponseList>;
    getElevation(geometry: Point | Position, outputFormat: 'geojson'): Promise<ElevationResponsePointGeoJSON>;
    getElevation(geometry: LineString | Position[] | string, outputFormat: 'geojson'): Promise<ElevationResponseLineGeoJSON>;
    getElevation(geometry: Point | Position, outputFormat: 'point'): Promise<ElevationResponsePoint>;
    getElevation(geometry: LineString | Position[] | string, outputFormat: 'polyline'): Promise<ElevationResponseLine>;
    getElevation(geometry: LineString | Position[] | string, outputFormat: 'encodedpolyline5'): Promise<ElevationResponseEncodedPolyline>;
    static decodePolyline(encodedPolyline: string, includeElevation?: boolean): Position[];
}
