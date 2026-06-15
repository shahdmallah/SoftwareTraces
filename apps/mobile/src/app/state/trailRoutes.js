"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setTrailRouteCoordinates = setTrailRouteCoordinates;
exports.getTrailRouteCoordinates = getTrailRouteCoordinates;
var routeCache = new Map();
function setTrailRouteCoordinates(trailId, coordinates) {
    routeCache.set(trailId, coordinates);
}
function getTrailRouteCoordinates(trailId) {
    var _a;
    return (_a = routeCache.get(trailId)) !== null && _a !== void 0 ? _a : null;
}
