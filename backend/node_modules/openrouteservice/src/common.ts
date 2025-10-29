export type Metadata = {
    version?: string;
    attribution: string;
    timestamp: number;
    engine?: {
        version: string;
        build_date?: string;
        graph_date?: string;
        author?: string;
        name?: string;
    }
}

export type BoundingBox = [number, number, number, number];

export enum Profile {
    DRIVING_CAR = 'driving-car',
    DRIVING_HGV = 'driving-hgv',
    CYCLING_REGULAR = 'cycling-regular',
    CYCLING_ROAD = 'cycling-road',
    CYCLING_MOUNTAIN = 'cycling-mountain',
    CYCLING_ELECTRIC = 'cycling-electric',
    FOOT_WALKING = 'foot-walking',
    FOOT_HIKING = 'foot-hiking',
    WHEELCHAIR = 'wheelchair'
}

export interface Warnings {
    code: number;
    message: string;
}