export var DirectionsAttributes;
(function (DirectionsAttributes) {
    DirectionsAttributes["AVERAGE_SPEED"] = "avgspeed";
    DirectionsAttributes["DETOUR_FACTOR"] = "detourfactor";
    DirectionsAttributes["PERCENTAGE"] = "percentage";
})(DirectionsAttributes || (DirectionsAttributes = {}));
export var DirectionsExtraInfo;
(function (DirectionsExtraInfo) {
    DirectionsExtraInfo["STEEPNESS"] = "steepness";
    DirectionsExtraInfo["SUITABILITY"] = "suitability";
    DirectionsExtraInfo["SURFACE"] = "surface";
    DirectionsExtraInfo["WAY_CATEGORY"] = "waycategory";
    DirectionsExtraInfo["WAY_TYPE"] = "waytype";
    DirectionsExtraInfo["TOLLWAYS"] = "tollways";
    DirectionsExtraInfo["TRAIL_DIFFICULTY"] = "traildifficulty";
    DirectionsExtraInfo["OSM_ID"] = "osmid";
    DirectionsExtraInfo["ROAD_ACCESS_RESTRICTIONS"] = "roadaccessrestrictions";
    DirectionsExtraInfo["COUNTRY_INFO"] = "countryinfo";
    DirectionsExtraInfo["GREEN"] = "green";
    DirectionsExtraInfo["NOISE"] = "noise";
    DirectionsExtraInfo["CSV"] = "csv";
    DirectionsExtraInfo["SHADOW"] = "shadow";
})(DirectionsExtraInfo || (DirectionsExtraInfo = {}));
export var DirectionsFeatures;
(function (DirectionsFeatures) {
    DirectionsFeatures["HIGHWAYS"] = "highways";
    DirectionsFeatures["TOLLWAYS"] = "tollways";
    DirectionsFeatures["FERRIES"] = "ferries";
})(DirectionsFeatures || (DirectionsFeatures = {}));
export var DirectionsBorders;
(function (DirectionsBorders) {
    DirectionsBorders["ALL"] = "all";
    DirectionsBorders["CONTROLLED"] = "controlled";
    DirectionsBorders["NONE"] = "none";
})(DirectionsBorders || (DirectionsBorders = {}));
export var DirectionsVehicleType;
(function (DirectionsVehicleType) {
    DirectionsVehicleType["HGV"] = "hgv";
    DirectionsVehicleType["BUS"] = "bus";
    DirectionsVehicleType["AGRICULTURAL"] = "agricultural";
    DirectionsVehicleType["DELIVERY"] = "delivery";
    DirectionsVehicleType["FORESTRY"] = "forestry";
    DirectionsVehicleType["GOODS"] = "goods";
    DirectionsVehicleType["UNKNOWN"] = "unknown";
})(DirectionsVehicleType || (DirectionsVehicleType = {}));
export var DirectionsSmoothness;
(function (DirectionsSmoothness) {
    DirectionsSmoothness["EXCELLENT"] = "excellent";
    DirectionsSmoothness["GOOD"] = "good";
    DirectionsSmoothness["INTERMEDIATE"] = "intermediate";
    DirectionsSmoothness["BAD"] = "bad";
    DirectionsSmoothness["VERY_BAD"] = "very_bad";
    DirectionsSmoothness["HORRIBLE"] = "horrible";
})(DirectionsSmoothness || (DirectionsSmoothness = {}));
export var DirectionsPreference;
(function (DirectionsPreference) {
    DirectionsPreference["FASTEST"] = "fastest";
    DirectionsPreference["SHORTEST"] = "shortest";
    DirectionsPreference["RECOMMENDED"] = "recommended";
})(DirectionsPreference || (DirectionsPreference = {}));
export var DirectionsUnits;
(function (DirectionsUnits) {
    DirectionsUnits["METERS"] = "m";
    DirectionsUnits["KILOMETERS"] = "km";
    DirectionsUnits["MILES"] = "mi";
})(DirectionsUnits || (DirectionsUnits = {}));
export var DirectionsFormat;
(function (DirectionsFormat) {
    DirectionsFormat["JSON"] = "json";
    DirectionsFormat["GPX"] = "gpx";
    DirectionsFormat["GEOJSON"] = "geojson";
})(DirectionsFormat || (DirectionsFormat = {}));
export var DirectionsInstructionType;
(function (DirectionsInstructionType) {
    DirectionsInstructionType[DirectionsInstructionType["LEFT"] = 0] = "LEFT";
    DirectionsInstructionType[DirectionsInstructionType["RIGHT"] = 1] = "RIGHT";
    DirectionsInstructionType[DirectionsInstructionType["SHARP_LEFT"] = 2] = "SHARP_LEFT";
    DirectionsInstructionType[DirectionsInstructionType["SHARP_RIGHT"] = 3] = "SHARP_RIGHT";
    DirectionsInstructionType[DirectionsInstructionType["SLIGHT_LEFT"] = 4] = "SLIGHT_LEFT";
    DirectionsInstructionType[DirectionsInstructionType["SLIGHT_RIGHT"] = 5] = "SLIGHT_RIGHT";
    DirectionsInstructionType[DirectionsInstructionType["STRAIGHT"] = 6] = "STRAIGHT";
    DirectionsInstructionType[DirectionsInstructionType["ENTER_ROUNDABOUT"] = 7] = "ENTER_ROUNDABOUT";
    DirectionsInstructionType[DirectionsInstructionType["EXIT_ROUNDABOUT"] = 8] = "EXIT_ROUNDABOUT";
    DirectionsInstructionType[DirectionsInstructionType["U_TURN"] = 9] = "U_TURN";
    DirectionsInstructionType[DirectionsInstructionType["GOAL"] = 10] = "GOAL";
    DirectionsInstructionType[DirectionsInstructionType["DEPART"] = 11] = "DEPART";
    DirectionsInstructionType[DirectionsInstructionType["KEEP_LEFT"] = 12] = "KEEP_LEFT";
    DirectionsInstructionType[DirectionsInstructionType["KEEP_RIGHT"] = 13] = "KEEP_RIGHT";
})(DirectionsInstructionType || (DirectionsInstructionType = {}));
