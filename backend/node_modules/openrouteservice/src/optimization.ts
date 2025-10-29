import { Position } from "geojson";

export type OptimizationQuery = {
    jobs: OptimizationJob[];
    shipments: OptimizationShipment[];
    vehicles: OptimizationVehicle[];
    matrices?: {
        [profile: string]: Partial<{
            durations: number[][];
            costs: number[][];
        }>;
    }
}

interface OptimizationJob {
    id: number;
    description?: string;
    location?: Position;
    location_index?: [number, number];
    setup?: number;
    service?: number;
    delivery?: number[];
    pickup?: number[];
    skills?: number[];
    priority?: number;
    time_windows?: [number, number][];
}

interface OptimizationShipment {
    pickup: OptimizationShipmentStep;
    delivery: OptimizationShipmentStep;
    amount?: number[];
    skills?: number[]
    priority?: number;
}

interface OptimizationShipmentStep {
    id: number;
    description?: string;
    location?: Position;
    location_index?: [number, number];
    setup?: number;
    service?: number;
    time_windows?: [number, number][];
}

interface OptimizationVehicle {
    id: number;
    profile?: string;
    description?: string;
    start?: Position;
    start_index?: [number, number];
    end?: Position;
    end_index?: [number, number];
    capacity?: number[];
    costs?: OptimizationCost[];
    skills?: number[];
    time_window?: [number, number];
    breaks?: OptimizationBreak[];
    speed_factor?: number[];
    max_tasks?: number;
    max_travel_time?: number;
    steps?: OptimizationStep[];
}

type OptimizationCost = Partial<{
    fixed: number;
    per_hour: number;
}>;

interface OptimizationBreak {
    id: number;
    time_windows?: [number, number][];
    service?: number;
    description?: string;
    max_load?: number[];
}

export enum OptimizationStepType {
    START = 'start', 
    JOB = 'job', 
    PICKUP = 'pickup', 
    DELIVERY = 'delivery', 
    BREAK = 'break', 
    END = 'end'
}

interface OptimizationStep {
    type: OptimizationStepType;
    id?: number;
    service_at?: number;
    service_after?: number;
    service_before?: number;
}

export interface OptimizationResponse {

}