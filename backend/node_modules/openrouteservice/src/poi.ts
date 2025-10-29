import { Position, Polygon, Point, LineString, FeatureCollection } from "geojson";
import { Metadata } from "./common.js";

export enum POIRequestType {
    PLACES_OF_INTEREST = 'pois',
    STATISTICS = 'stats',
    LIST = 'list'
}

export enum POISortBy {
    CATEGORY = 'category',
    DISTANCE = 'distance'
}

export type POIQuery = {
    request: POIRequestType;
    geometry: {
        bbox?: [Position, Position],
        geojson?: Polygon | Point | LineString;
        buffer?: number;
    }
    filters?: {
        category_group_ids?: number[];
        category_ids?: number[];
        name?: string[];
        wheelchair?: (string | boolean)[];
        smoking?: (string | boolean)[];
        fee?: boolean[];
    }
    limit?: number;
    sortby?: POISortBy;
}

type POIInformation = {
    information: Metadata & {
        query: POIQuery;
    }
}

export type POIResponsePOIs = FeatureCollection<Point, POIProperties> & POIInformation;

export type POIResponseStats = {
    places: {
        total_count: number;
    } & {
        [category: string]: {
            group_id: number;
            categories: {
                [category: string]: {
                    count: number;
                    category_id: number;
                }
            }
            total_count: number;
        }
    }
} & POIInformation;

export type POIResponseList = {
    [category: string]: {
        id: number;
        children: {
            [category: string]: number;
        }
    }
}

export type POIResponse = POIResponsePOIs | POIResponseStats | POIResponseList;

export interface POIProperties {
    osm_id: number;
    osm_type: number;
    distance: number;
    category_ids: {
        [id: string]: {
            category_name: string;
            category_group: string;
        }
    }
    osm_tags: {
        name: string;
        wheelchair: string;
    }
}