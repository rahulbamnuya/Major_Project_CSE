import { Point, LineString, Position } from "geojson";
import { Metadata } from "./common.js";
export type ElevationResponsePointGeoJSON = Metadata & {
    geometry: Point;
};
export type ElevationResponseLineGeoJSON = Metadata & {
    geometry: LineString;
};
export type ElevationResponsePoint = Metadata & {
    geometry: Position;
};
export type ElevationResponseLine = Metadata & {
    geometry: Position[];
};
export type ElevationResponseEncodedPolyline = Metadata & {
    geometry: string;
};
