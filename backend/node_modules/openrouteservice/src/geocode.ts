import { FeatureCollection, Point } from "geojson";
import { Metadata, Warnings } from "./common.js";

export enum GeocodeSearchSource {
    OPENSTREETMAP = 'osm',
    OPENADDRESSES = 'oa',
    WHOS_ON_FIRST = 'wof',
    GEONAMES = 'gn'
}

export enum GeocodeSearchLayer {
    ADDRESS = 'address',
    VENUE = 'venue',
    NEIGHBORHOOD = 'neighbourhood',
    LOCALITY = 'locality',
    BOROUGH = 'borough',
    LOCAL_ADMINISTRATION = 'localadmin',
    COUNTY = 'county',
    MACRO_COUNTY = 'macrocounty',
    REGION = 'region',
    MACRO_REGION = 'macroregion',
    COUNTRY = 'country',
    COARSE = 'coarse',
}

export type GeocodeStructuredQuery = Partial<{
    address: string;
    neighborhood: string;
    country: string;
    postalcode: string;
    region: string;
    county: string;
    locality: string;
    borough: string;
}>;

export type GeocodeQuery = Partial<{
    focus: {
        point?: {
            lon: number;
            lat?: number;
        }
    }
    boundary: Partial<{
        rect: {
            min_lon: number;
            min_lat?: number;
            max_lon?: number;
            max_lat?: number;
        }
        circle: {
            lon: number;
            lat?: number;
            radius?: number;
        }
        gid: string;
        country: string;
    }>;
    size: number;
    sources: GeocodeSearchSource[];
    layers: GeocodeSearchLayer[];
}>;

export type GeocodeResponse = FeatureCollection<Point, GeocodeProperties> & {
    geocoding: Metadata & {
        query: GeocodeQuery & Partial<GeocodeReverseQuery> & {
            size: number;
            layers?: string[];
            private: boolean;
            lang: {
                name: string;
                iso6391: string;
                iso6393: string;
                via: string;
                defaulted: boolean;
            }
            querySize: number;
            parser?: string;
            parsed_text?: {
                subject: string;
            }
            warnings?: Warnings[];
        }
    }
}
interface GeocodeProperties {
    id: string;
    gid: string;
    layer: string;
    source: string;
    source_id: string;
    name: string;
    housenumber?: string;
    street?: string;
    confidence?: number;
    match_type?: string;
    postalcode?: string;
    accuracy?: string;
    country?: string;
    country_gid?: string;
    country_a?: string;
    macroregion?: string;
    macroregion_gid?: string;
    macroregion_a?: string;
    region?: string;
    region_gid?: string;
    region_a?: string;
    county?: string;
    county_gid?: string;
    county_a?: string;
    localadmin?: string;
    localadmin_gid?: string;
    localadmin_a?: string;
    locality?: string;
    locality_gid?: string;
    locality_a?: string;
    neighbourhood?: string;
    neighbourhood_gid?: string;
    neighbourhood_a?: string;
    borough?: string;
    borough_gid?: string;
    borough_a?: string;
    continent?: string;
    continent_gid?: string;
    label: string;
    addendum: {
        osm: {
            wheelchair: string;
            website: string;
            phone: string;
        }
    }
}

export type GeocodeReverseQuery = {
    point: {
        lon: number;
        lat: number;
    }
    boundary?: {
        circle?: {
            radius: number;
        }
        country?: string;
    }
    sources?: GeocodeSearchSource[];
    layers?: GeocodeSearchLayer[];
}