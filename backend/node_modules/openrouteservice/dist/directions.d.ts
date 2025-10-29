import { FeatureCollection, LineString, Position } from "geojson";
import { Metadata, Profile, BoundingBox, Warnings } from "./common.js";
export type BasicDirectionsResponse = FeatureCollection<LineString, DirectionsProperties> & {
    metadata: Metadata & {
        service: 'routing';
        query: {
            coordinates: [Position, Position];
            profile: Profile;
            format: 'json';
        };
    };
};
export declare enum DirectionsAttributes {
    AVERAGE_SPEED = "avgspeed",
    DETOUR_FACTOR = "detourfactor",
    PERCENTAGE = "percentage"
}
export declare enum DirectionsExtraInfo {
    STEEPNESS = "steepness",
    SUITABILITY = "suitability",
    SURFACE = "surface",
    WAY_CATEGORY = "waycategory",
    WAY_TYPE = "waytype",
    TOLLWAYS = "tollways",
    TRAIL_DIFFICULTY = "traildifficulty",
    OSM_ID = "osmid",
    ROAD_ACCESS_RESTRICTIONS = "roadaccessrestrictions",
    COUNTRY_INFO = "countryinfo",
    GREEN = "green",
    NOISE = "noise",
    CSV = "csv",
    SHADOW = "shadow"
}
export declare enum DirectionsFeatures {
    HIGHWAYS = "highways",
    TOLLWAYS = "tollways",
    FERRIES = "ferries"
}
export declare enum DirectionsBorders {
    ALL = "all",
    CONTROLLED = "controlled",
    NONE = "none"
}
export declare enum DirectionsVehicleType {
    HGV = "hgv",
    BUS = "bus",
    AGRICULTURAL = "agricultural",
    DELIVERY = "delivery",
    FORESTRY = "forestry",
    GOODS = "goods",
    UNKNOWN = "unknown"
}
export declare enum DirectionsSmoothness {
    EXCELLENT = "excellent",
    GOOD = "good",
    INTERMEDIATE = "intermediate",
    BAD = "bad",
    VERY_BAD = "very_bad",
    HORRIBLE = "horrible"
}
export declare enum DirectionsPreference {
    FASTEST = "fastest",
    SHORTEST = "shortest",
    RECOMMENDED = "recommended"
}
export declare enum DirectionsUnits {
    METERS = "m",
    KILOMETERS = "km",
    MILES = "mi"
}
export declare enum DirectionsFormat {
    JSON = "json",
    GPX = "gpx",
    GEOJSON = "geojson"
}
export interface DirectionsOptions {
    avoid_features?: DirectionsFeatures[];
    avoid_borders?: DirectionsBorders;
    avoid_countries?: number[];
    avoid_polygons?: {
        empty: boolean;
    };
    round_trip?: {
        length?: number;
        points?: number;
        seed?: number;
    };
    vehicle_type?: DirectionsVehicleType;
    profile_params?: {
        weightings?: {
            steepness_difficulty?: number;
            green?: number;
            quiet?: number;
            shadow?: number;
        };
        restrictions?: {
            length?: number;
            width?: number;
            height?: number;
            axleload?: number;
            weight?: number;
            hazmat?: boolean;
            surface_type?: string;
            track_type?: string;
            smoothness_type?: DirectionsSmoothness;
            maximum_sloped_kerb?: number;
            maximum_incline?: number;
            minimum_width?: number;
        };
        surface_quality_known?: boolean;
        allow_unsuitable?: boolean;
    };
}
export type DirectionsQuery = {
    coordinates: Position[];
    alternative_routes?: {
        target_count?: number;
        weight_factor?: number;
        share_factor?: number;
    };
    attributes?: DirectionsAttributes[];
    continue_straight?: boolean;
    elevation?: string;
    extra_info?: DirectionsExtraInfo[];
    geometry_simplify?: boolean;
    id?: string;
    instructions?: boolean;
    instructions_format?: string;
    language?: string;
    maneuvers?: boolean;
    options?: DirectionsOptions;
    preference?: DirectionsPreference;
    radiuses?: number[];
    roundabout_exits?: boolean;
    skip_segments?: number[];
    supress_warnings?: boolean;
    units?: DirectionsUnits;
    geometry?: boolean;
    bearings?: number[][];
    maximum_speed?: number;
};
export declare enum DirectionsInstructionType {
    LEFT = 0,
    RIGHT = 1,
    SHARP_LEFT = 2,
    SHARP_RIGHT = 3,
    SLIGHT_LEFT = 4,
    SLIGHT_RIGHT = 5,
    STRAIGHT = 6,
    ENTER_ROUNDABOUT = 7,
    EXIT_ROUNDABOUT = 8,
    U_TURN = 9,
    GOAL = 10,
    DEPART = 11,
    KEEP_LEFT = 12,
    KEEP_RIGHT = 13
}
export type DirectionsSummary = {
    distance: number;
    duration: number;
};
type DirectionsStep = DirectionsSummary & {
    type: DirectionsInstructionType;
    instruction?: string;
    name: string;
    waypoints: [number, number];
    maneuver?: {
        location: Position;
        bearing_before: number;
        bearing_after: number;
    };
};
type DirectionsSegment = DirectionsSummary & {
    steps: DirectionsStep[];
    avgspeed?: number;
    detourfactor?: number;
    percentage?: number;
};
interface DirectionsExtra {
    values: [number, number, number][];
    summary: {
        value: number;
        distance: number;
        amount: number;
    }[];
}
interface DirectionsExtras {
    steepness?: DirectionsExtra;
    suitability?: DirectionsExtra;
    surface?: DirectionsExtra;
    waycategory?: DirectionsExtra;
    waytype?: DirectionsExtra;
    tollways?: DirectionsExtra;
    traildifficulty?: DirectionsExtra;
    osmid?: DirectionsExtra;
    roadaccessrestrictions?: DirectionsExtra;
    countryinfo?: DirectionsExtra;
    green?: DirectionsExtra;
    noise?: DirectionsExtra;
}
interface DirectionsRoute {
    summary: DirectionsSummary;
    segments: DirectionsSegment[];
    bbox: BoundingBox;
    geometry?: string;
    way_points: [number, number];
    legs: unknown[];
    extras?: DirectionsExtras;
    warnings?: Warnings[];
}
type DirectionsResponsePartial = {
    metadata: Metadata & {
        service: 'routing';
        query: DirectionsQuery & {
            profile: Profile;
            format: DirectionsFormat;
        };
    };
};
export type DirectionsResponseJSON = DirectionsResponsePartial & {
    bbox: BoundingBox;
    routes: DirectionsRoute[];
};
interface DirectionsProperties {
    transfers: number;
    fare: number;
    segments: DirectionsSegment[];
    way_points: [number, number];
    summary: DirectionsSummary;
    extras?: DirectionsExtras;
    warnings?: Warnings[];
}
export type DirectionsResponseGeoJSON = DirectionsResponsePartial & FeatureCollection<LineString, DirectionsProperties>;
export type DirectionsResponseGPX = string;
export type DirectionsResponse = DirectionsResponseJSON | DirectionsResponseGeoJSON | DirectionsResponseGPX;
export {};
