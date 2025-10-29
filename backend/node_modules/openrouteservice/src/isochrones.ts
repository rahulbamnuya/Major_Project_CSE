import { Position, FeatureCollection, Polygon } from "geojson";
import { Metadata, Profile } from "./common.js";
import { DirectionsOptions, DirectionsUnits } from "./directions.js";

export enum IsochronesAttributes {
    AREA = 'area',
    REACH_FACTOR = 'reachfactor',
    TOTAL_POPULATION = 'total_pop'
}

export enum IsochronesLocationType {
    START = 'start',
    DESTINATION = 'destination'
}

export enum IsochronesRangeType {
    TIME = 'time',
    DISTANCE = 'distance'
}

interface IsochronesProperties {
    group_index: number;
    value: number;
    center: Position;
    area?: number;
    reachfactor?: number;
    total_pop?: number;
}

export type IsochronesQuery = {
    locations: Position[];
    range: [number, number];
    attributes?: IsochronesAttributes[];
    id?: string;
    intersections?: boolean;
    interval?: number;
    location_type?: IsochronesLocationType;
    options?: DirectionsOptions;
    range_type?: IsochronesRangeType;
    smoothing?: number;
    areaUnits?: DirectionsUnits;
    units?: DirectionsUnits;
}

export type IsochronesResponse = FeatureCollection<Polygon, IsochronesProperties> & {
    metadata: Metadata & {
        service: 'isochrones';
        query: IsochronesQuery & {
            profile: Profile
        }
    }
}
