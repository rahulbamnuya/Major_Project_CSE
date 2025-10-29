import flat from "flat";
const { flatten, unflatten } = flat;
import { LineString, Point, Position } from "geojson";
import { Profile } from "./common.js";
import { BasicDirectionsResponse, DirectionsFormat, DirectionsQuery, DirectionsResponseJSON, DirectionsResponseGeoJSON, DirectionsResponseGPX, DirectionsResponse } from "./directions.js";
import { ElevationResponsePointGeoJSON, ElevationResponseLineGeoJSON, ElevationResponsePoint, ElevationResponseLine, ElevationResponseEncodedPolyline } from "./elevation.js";
import { GeocodeStructuredQuery, GeocodeQuery, GeocodeResponse, GeocodeReverseQuery } from "./geocode.js";
import { IsochronesQuery, IsochronesResponse } from "./isochrones.js";
import { MatrixQuery, MatrixResponse } from "./matrix.js";
import { POIQuery, POIRequestType, POIResponsePOIs, POIResponseStats, POIResponseList, POIResponse } from "./poi.js";

export default class Openrouteservice {
    private apiKey: string;

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    private orsFetch = (endpoint: string, post: boolean, body: string) => fetch(
        `https://api.openrouteservice.org${endpoint}${
            post ? '' : `?api_key=${this.apiKey}&${body}`
        }`, 
        post ? {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.apiKey
            },
            body
        } : {}
    ).then(async res => {
        const text = await res.text();
        try {
            return JSON.parse(text);
        } catch (e) {
            return text;
        }
    });

    getBasicDirections = async (profile: Profile, start: Position, end: Position): Promise<BasicDirectionsResponse> => 
        this.orsFetch(
            '/v2/directions/' + profile, 
            false, 
            new URLSearchParams({
                start: start.join(','),
                end: end.join(',')
            }).toString()
        );

    async getDirections (profile: Profile, format: DirectionsFormat.JSON, query: DirectionsQuery): Promise<DirectionsResponseJSON>;
    async getDirections (profile: Profile, format: DirectionsFormat.GEOJSON, query: DirectionsQuery): Promise<DirectionsResponseGeoJSON>;
    async getDirections (profile: Profile, format: DirectionsFormat.GPX, query: DirectionsQuery): Promise<DirectionsResponseGPX>;
    async getDirections (profile: Profile, format: DirectionsFormat, query: DirectionsQuery): Promise<DirectionsResponse> {
        return this.orsFetch(
            `/v2/directions/${profile}/${format}`, 
            true, 
            JSON.stringify(query)
        );
    }

    getIsochrones = async (profile: Profile, query: IsochronesQuery): Promise<IsochronesResponse> => 
        this.orsFetch(
            '/v2/isochrones/' + profile,
            true,
            JSON.stringify(query)
        );

    getMatrix = async (profile: Profile, query: MatrixQuery): Promise<MatrixResponse> =>
        this.orsFetch(
            '/v2/matrix/' + profile,
            true,
            JSON.stringify(query)
        );

    static unflattenResult(res: any) {
        res.geocoding.query = unflatten(res.geocoding.query);
        return res;
    }

    async getGeocodeSearch(query: string | GeocodeStructuredQuery, additionalQuery?: GeocodeQuery): Promise<GeocodeResponse> {
        const structured = typeof query !== 'string';
        
        const params: any = flatten({
            ...(structured ? query : {}),
            ...(additionalQuery ?? {})
        });

        if (!structured)
            params.text = query;

        if (additionalQuery?.sources)
            params.sources = additionalQuery.sources.join(',');

        if (additionalQuery?.layers)
            params.layers = additionalQuery.layers.join(',');

        return this.orsFetch(
            '/geocode/search' + (structured ? '/structured' : ''),
            false,
            new URLSearchParams(params).toString()
        ).then(Openrouteservice.unflattenResult);
    }

    async getGeocodeAutocomplete(text: string, query?: GeocodeQuery): Promise<GeocodeResponse> {
        const params: any = flatten(query ?? {});

        params.text = text;

        if (query?.sources)
            params.sources = query.sources.join(',');

        if (query?.layers)
            params.layers = query.layers.join(',');

        return this.orsFetch(
            '/geocode/autocomplete',
            false,
            new URLSearchParams(params).toString()
        ).then(Openrouteservice.unflattenResult);
    }

    async getGeocodeReverse(query: GeocodeReverseQuery): Promise<GeocodeResponse> {
        const params: any = flatten(query);

        if (query.sources)
            params.sources = query.sources.join(',');

        if (query.layers)
            params.layers = query.layers.join(',');

        return this.orsFetch(
            '/geocode/reverse',
            false,
            new URLSearchParams(params).toString()
        ).then(Openrouteservice.unflattenResult);
    }

    async getPOIs(query: POIQuery & { request: POIRequestType.PLACES_OF_INTEREST }): Promise<POIResponsePOIs>;
    async getPOIs(query: POIQuery & { request: POIRequestType.STATISTICS }): Promise<POIResponseStats>;
    async getPOIs(query: POIQuery & { request: POIRequestType.LIST }): Promise<POIResponseList>;
    async getPOIs(query: POIQuery): Promise<POIResponse> {
        return this.orsFetch(
            '/pois',
            true,
            JSON.stringify(query)
        );
    }

    async getElevation(geometry: Point | Position, outputFormat: 'geojson'): Promise<ElevationResponsePointGeoJSON>;
    async getElevation(geometry: LineString | Position[] | string, outputFormat: 'geojson'): Promise<ElevationResponseLineGeoJSON>;
    async getElevation(geometry: Point | Position, outputFormat: 'point'): Promise<ElevationResponsePoint>;
    async getElevation(geometry: LineString | Position[] | string, outputFormat: 'polyline'): Promise<ElevationResponseLine>;
    async getElevation(geometry: LineString | Position[] | string, outputFormat: 'encodedpolyline5'): Promise<ElevationResponseEncodedPolyline>;
    async getElevation(geometry: Point | LineString | Position | Position[] | string, outputFormat: 'geojson' | 'point' | 'polyline' | 'encodedpolyline5') {
        const isPoint = (
            typeof geometry === 'object' 
                && 
            !Array.isArray(geometry) 
                && 
            geometry.type === 'Point'
        ) || (
            Array.isArray(geometry) 
                && 
            typeof geometry[0] === 'number'
        );
        const isGeoJSON = typeof geometry === 'object' && 'type' in geometry;
        const isEncodedPolyline = typeof geometry === 'string';
        const endpoint = `/elevation/${isPoint ? 'point' : 'line'}`;
        const params = (isPoint && !isGeoJSON)
            ? new URLSearchParams({
                geometry: geometry.join(','),
                format_out: outputFormat
            }).toString() : JSON.stringify({
                format_in: (
                    isEncodedPolyline
                        ? 'encodedpolyline5'
                        : isGeoJSON
                            ? 'geojson'
                            : isPoint
                                ? 'point'
                                : 'polyline'
                ), geometry
            });
            
        return this.orsFetch(
            endpoint,
            !(isPoint && !isGeoJSON),
            params
        );
    }

    // async getOptimization(query: OptimizationQuery) {
    //     return this.orsFetch(
    //         '/optimization',
    //         true,
    //         JSON.stringify(query)
    //     )
    // }

    static decodePolyline(encodedPolyline: string, includeElevation?: boolean): Position[] {
        const points = [];
        let index = 0;
        let lat = 0;
        let lng = 0;
        let ele = 0;
        while (index < encodedPolyline.length) {
            let b;
            let shift = 0;
            let result = 0;
            do {
                b = encodedPolyline.charAt(index++).charCodeAt(0) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
        
            lat += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
            shift = 0;
            result = 0;
            do {
                b = encodedPolyline.charAt(index++).charCodeAt(0) - 63;
                result |= (b & 0x1f) << shift;
                shift += 5;
            } while (b >= 0x20);
            lng += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
        
            if (includeElevation) {
                shift = 0;
                result = 0;
                do {
                    b = encodedPolyline.charAt(index++).charCodeAt(0) - 63;
                    result |= (b & 0x1f) << shift;
                    shift += 5;
                } while (b >= 0x20);
                ele += ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
            }
            try {
                let location = [(lng / 1E5), (lat / 1E5)];
                if (includeElevation) location.push((ele / 100));
                points.push(location);
            } catch (e) {
                console.log(e);
            }
        }
        return points;
    }
}