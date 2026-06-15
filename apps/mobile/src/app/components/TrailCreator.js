"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrailCreator = TrailCreator;
// Updated to support staged trail creation with start, optional middle waypoints, end, and loop routes.
var react_1 = require("react");
var react_native_1 = require("react-native");
var ImagePicker = require("expo-image-picker");
var Location = require("expo-location");
var maps_1 = require("@rnmapbox/maps");
var vector_icons_1 = require("@expo/vector-icons");
var react_native_safe_area_context_1 = require("react-native-safe-area-context");
var trailsApi_1 = require("../api/trailsApi");
var client_1 = require("../api/client");
var trailRoutes_1 = require("../state/trailRoutes");
var translateTrailContent_1 = require("../utils/translateTrailContent");
var MAPBOX_ACCESS_TOKEN = (_a = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN) !== null && _a !== void 0 ? _a : '';
function formatDuration(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0)
        return '--';
    var h = Math.floor(minutes / 60);
    var m = Math.round(minutes % 60);
    if (h <= 0)
        return "".concat(m, "m");
    return "".concat(h, "h ").concat(m, "m");
}
function pickTrailImage() {
    return __awaiter(this, void 0, void 0, function () {
        var permission, result, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    return [4 /*yield*/, ImagePicker.requestMediaLibraryPermissionsAsync()];
                case 1:
                    permission = _a.sent();
                    if (!permission.granted) {
                        react_native_1.Alert.alert('Permission required', 'Media library access is required to choose a trail photo.');
                        return [2 /*return*/, null];
                    }
                    return [4 /*yield*/, ImagePicker.launchImageLibraryAsync({
                            mediaTypes: ImagePicker.MediaTypeOptions.Images,
                            quality: 0.8,
                            allowsEditing: true,
                            aspect: [4, 3],
                        })];
                case 2:
                    result = _a.sent();
                    if (result.canceled || !result.assets.length) {
                        return [2 /*return*/, null];
                    }
                    return [2 /*return*/, result.assets[0].uri];
                case 3:
                    error_1 = _a.sent();
                    console.warn('Trail image picker failed:', error_1);
                    return [2 /*return*/, null];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function reverseGeocodeRegion(coordinate) {
    return __awaiter(this, void 0, void 0, function () {
        var url, res, data, feature, neighborhoodContext, placeContext, fallbackRegionContext, neighborhoodName, cityName, error_2;
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v;
        return __generator(this, function (_w) {
            switch (_w.label) {
                case 0:
                    if (!MAPBOX_ACCESS_TOKEN) {
                        return [2 /*return*/, ''];
                    }
                    _w.label = 1;
                case 1:
                    _w.trys.push([1, 4, , 5]);
                    url = new URL("https://api.mapbox.com/geocoding/v5/mapbox.places/".concat(coordinate[0], ",").concat(coordinate[1], ".json"));
                    url.searchParams.set('access_token', MAPBOX_ACCESS_TOKEN);
                    url.searchParams.set('types', 'place,locality,region,neighborhood,district');
                    url.searchParams.set('language', 'en');
                    url.searchParams.set('limit', '1');
                    return [4 /*yield*/, fetch(url.toString())];
                case 2:
                    res = _w.sent();
                    if (!res.ok) {
                        return [2 /*return*/, ''];
                    }
                    return [4 /*yield*/, res.json()];
                case 3:
                    data = _w.sent();
                    feature = (_a = data.features) === null || _a === void 0 ? void 0 : _a[0];
                    if (!feature) {
                        return [2 /*return*/, ''];
                    }
                    neighborhoodContext = (_e = (_c = (_b = feature.context) === null || _b === void 0 ? void 0 : _b.find(function (item) { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.startsWith('neighborhood'); })) !== null && _c !== void 0 ? _c : (_d = feature.context) === null || _d === void 0 ? void 0 : _d.find(function (item) { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.startsWith('district'); })) !== null && _e !== void 0 ? _e : (((_f = feature.place_type) === null || _f === void 0 ? void 0 : _f.includes('neighborhood')) || ((_g = feature.place_type) === null || _g === void 0 ? void 0 : _g.includes('district')) ? feature : undefined);
                    placeContext = (_l = (_j = (_h = feature.context) === null || _h === void 0 ? void 0 : _h.find(function (item) { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.startsWith('place'); })) !== null && _j !== void 0 ? _j : (_k = feature.context) === null || _k === void 0 ? void 0 : _k.find(function (item) { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.startsWith('locality'); })) !== null && _l !== void 0 ? _l : (((_m = feature.place_type) === null || _m === void 0 ? void 0 : _m.includes('place')) || ((_o = feature.place_type) === null || _o === void 0 ? void 0 : _o.includes('locality')) ? feature : undefined);
                    fallbackRegionContext = (_p = feature.context) === null || _p === void 0 ? void 0 : _p.find(function (item) { var _a; return (_a = item.id) === null || _a === void 0 ? void 0 : _a.startsWith('region'); });
                    neighborhoodName = (_q = neighborhoodContext === null || neighborhoodContext === void 0 ? void 0 : neighborhoodContext.text) === null || _q === void 0 ? void 0 : _q.trim();
                    cityName = (_s = (_r = placeContext === null || placeContext === void 0 ? void 0 : placeContext.text) === null || _r === void 0 ? void 0 : _r.trim()) !== null && _s !== void 0 ? _s : (_t = fallbackRegionContext === null || fallbackRegionContext === void 0 ? void 0 : fallbackRegionContext.text) === null || _t === void 0 ? void 0 : _t.trim();
                    if (neighborhoodName && cityName && neighborhoodName.toLowerCase() !== cityName.toLowerCase()) {
                        return [2 /*return*/, "".concat(neighborhoodName, " - ").concat(cityName)];
                    }
                    if (neighborhoodName) {
                        return [2 /*return*/, neighborhoodName];
                    }
                    if (cityName) {
                        return [2 /*return*/, cityName];
                    }
                    if ((_u = feature.text) === null || _u === void 0 ? void 0 : _u.trim()) {
                        return [2 /*return*/, feature.text.trim()];
                    }
                    if ((_v = feature.place_name) === null || _v === void 0 ? void 0 : _v.trim()) {
                        return [2 /*return*/, feature.place_name.split(',')[0].trim()];
                    }
                    return [2 /*return*/, ''];
                case 4:
                    error_2 = _w.sent();
                    console.warn('Region reverse geocode failed:', error_2);
                    return [2 /*return*/, ''];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function toLineFeature(routeCoordinates) {
    var lineFeature = routeCoordinates.length >= 2
        ? [
            {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: routeCoordinates },
            },
        ]
        : [];
    return {
        type: 'FeatureCollection',
        features: lineFeature,
    };
}
function toPointFeature(coordinate) {
    return toPointsFeatureCollection(coordinate ? [coordinate] : []);
}
function toPointsFeatureCollection(coordinates) {
    var pointFeatures = coordinates.map(function (coordinate, index) { return ({
        type: 'Feature',
        properties: { index: index },
        geometry: { type: 'Point', coordinates: coordinate },
    }); });
    return {
        type: 'FeatureCollection',
        features: pointFeatures,
    };
}
function difficultyTone(difficulty) {
    switch (difficulty) {
        case 'easy':
        case 'Easy':
            return { bg: 'rgba(122,154,58,0.16)', fg: '#5B7A2C', dot: '#7A9A3A' };
        case 'moderate':
        case 'Moderate':
            return { bg: 'rgba(212,168,67,0.18)', fg: '#8E6A09', dot: '#D4A843' };
        case 'hard':
        case 'Hard':
            return { bg: 'rgba(187,40,35,0.14)', fg: '#BB2823', dot: '#BB2823' };
        case 'expert':
        case 'Expert':
            return { bg: 'rgba(99,14,19,0.14)', fg: '#630E13', dot: '#630E13' };
        default:
            return { bg: 'rgba(44,36,24,0.10)', fg: '#2C2418', dot: '#8A7A6A' };
    }
}
function estimateDifficulty(distanceMeters) {
    var distanceKm = distanceMeters / 1000;
    if (distanceKm < 5)
        return 'easy';
    if (distanceKm < 10)
        return 'moderate';
    if (distanceKm < 16)
        return 'hard';
    return 'expert';
}
function toFallbackStats(distanceMeters, durationSeconds) {
    return {
        length_meters: distanceMeters,
        elevation_gain_meters: 0,
        estimated_duration_minutes: Math.max(1, Math.round(durationSeconds / 60)),
        difficulty: estimateDifficulty(distanceMeters),
    };
}
function getDistanceMeters(left, right) {
    var earthRadiusMeters = 6371000;
    var toRadians = function (value) { return (value * Math.PI) / 180; };
    var leftLng = left[0], leftLat = left[1];
    var rightLng = right[0], rightLat = right[1];
    var deltaLat = toRadians(rightLat - leftLat);
    var deltaLng = toRadians(rightLng - leftLng);
    var a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
        Math.cos(toRadians(leftLat)) *
            Math.cos(toRadians(rightLat)) *
            Math.sin(deltaLng / 2) *
            Math.sin(deltaLng / 2);
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
function getPathDistanceMeters(points) {
    return points.reduce(function (sum, point, index) {
        if (index === 0) {
            return sum;
        }
        return sum + getDistanceMeters(points[index - 1], point);
    }, 0);
}
function confirmDuplicateTrail(warning) {
    var _a, _b;
    var strongestMatch = warning.matches[0];
    var matchName = (_a = strongestMatch === null || strongestMatch === void 0 ? void 0 : strongestMatch.name) !== null && _a !== void 0 ? _a : 'an existing public trail';
    var reasons = ((_b = strongestMatch === null || strongestMatch === void 0 ? void 0 : strongestMatch.reasons) === null || _b === void 0 ? void 0 : _b.length) ? "\n\n".concat(strongestMatch.reasons.slice(0, 3).join('\n')) : '';
    return new Promise(function (resolve) {
        react_native_1.Alert.alert('Possible duplicate trail', "\"".concat(matchName, "\" looks similar to this route. Open the existing trail instead of creating another copy, unless this is intentionally different.").concat(reasons), [
            { text: 'Cancel', style: 'cancel', onPress: function () { return resolve(false); } },
            { text: 'Create anyway', style: 'destructive', onPress: function () { return resolve(true); } },
        ]);
    });
}
function formatHazardWarningItem(warning) {
    if (typeof warning === 'string') {
        return warning;
    }
    if (warning && typeof warning === 'object') {
        var item = warning;
        return String(item.warning_en || item.warning || item.message || JSON.stringify(item));
    }
    return String(warning);
}
function showHazardBlockedWarning(warnings) {
    var messages = warnings.slice(0, 5).map(formatHazardWarningItem).filter(Boolean);
    var messageText = messages.length > 0
        ? "This route passes through hazardous or settlement areas and cannot be created.\n\n".concat(messages.join('\n'))
        : 'This route passes through hazardous or settlement areas and cannot be created.';
    return new Promise(function (resolve) {
        react_native_1.Alert.alert('Dangerous route blocked', messageText, [{ text: 'OK', onPress: function () { return resolve(); } }], { cancelable: true });
    });
}
function buildDirectionsUrl(waypoints) {
    var coordinates = waypoints.map(function (_a) {
        var lng = _a[0], lat = _a[1];
        return "".concat(lng, ",").concat(lat);
    }).join(';');
    var params = new URLSearchParams({
        access_token: MAPBOX_ACCESS_TOKEN,
        geometries: 'geojson',
        overview: 'full',
    });
    return "https://api.mapbox.com/directions/v5/mapbox/walking/".concat(coordinates, "?").concat(params.toString());
}
function getRouteBounds(coordinates) {
    if (coordinates.length < 2) {
        return null;
    }
    var longitudes = coordinates.map(function (point) { return point[0]; });
    var latitudes = coordinates.map(function (point) { return point[1]; });
    return {
        northEast: [Math.max.apply(Math, longitudes), Math.max.apply(Math, latitudes)],
        southWest: [Math.min.apply(Math, longitudes), Math.min.apply(Math, latitudes)],
    };
}
function TrailCreator(_a) {
    var _this = this;
    var styleURL = _a.styleURL, _b = _a.initialCenter, initialCenter = _b === void 0 ? [35.24, 31.78] : _b, _c = _a.initialZoom, initialZoom = _c === void 0 ? 7.8 : _c, initialGeneratedTrail = _a.initialGeneratedTrail, onSaved = _a.onSaved;
    var insets = (0, react_native_safe_area_context_1.useSafeAreaInsets)();
    var windowHeight = (0, react_native_1.useWindowDimensions)().height;
    var cameraRef = (0, react_1.useRef)(null);
    var locationSubscriptionRef = (0, react_1.useRef)(null);
    var lastAiNameRef = (0, react_1.useRef)('');
    var lastAiDescriptionRef = (0, react_1.useRef)('');
    var lastAiRegionRef = (0, react_1.useRef)('');
    var _d = (0, react_1.useState)(false), isDrawing = _d[0], setIsDrawing = _d[1];
    var _e = (0, react_1.useState)(false), isRecordingTrail = _e[0], setIsRecordingTrail = _e[1];
    var _f = (0, react_1.useState)(false), isFinished = _f[0], setIsFinished = _f[1];
    var _g = (0, react_1.useState)('start'), drawingStage = _g[0], setDrawingStage = _g[1];
    var _h = (0, react_1.useState)(false), isLoop = _h[0], setIsLoop = _h[1];
    var _j = (0, react_1.useState)(null), startCoordinate = _j[0], setStartCoordinate = _j[1];
    var _k = (0, react_1.useState)([]), middleCoordinates = _k[0], setMiddleCoordinates = _k[1];
    var _l = (0, react_1.useState)(null), endCoordinate = _l[0], setEndCoordinate = _l[1];
    var _m = (0, react_1.useState)([]), routeCoordinates = _m[0], setRouteCoordinates = _m[1];
    var _o = (0, react_1.useState)(null), stats = _o[0], setStats = _o[1];
    (0, react_1.useEffect)(function () {
        var fetchRegion = function () { return __awaiter(_this, void 0, void 0, function () {
            var fetchedRegion;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!startCoordinate) {
                            setRegion('');
                            return [2 /*return*/];
                        }
                        setIsRegionLoading(true);
                        return [4 /*yield*/, reverseGeocodeRegion(startCoordinate)];
                    case 1:
                        fetchedRegion = _a.sent();
                        setIsRegionLoading(false);
                        setRegion(function (current) {
                            var trimmedCurrent = current.trim();
                            if (!fetchedRegion || (trimmedCurrent && trimmedCurrent !== lastAiRegionRef.current)) {
                                return current;
                            }
                            lastAiRegionRef.current = fetchedRegion;
                            return fetchedRegion;
                        });
                        return [2 /*return*/];
                }
            });
        }); };
        void fetchRegion();
    }, [startCoordinate]);
    var _p = (0, react_1.useState)(false), isCalculating = _p[0], setIsCalculating = _p[1];
    var _q = (0, react_1.useState)(null), calcError = _q[0], setCalcError = _q[1];
    var _r = (0, react_1.useState)(''), name = _r[0], setName = _r[1];
    var _s = (0, react_1.useState)(''), description = _s[0], setDescription = _s[1];
    var _t = (0, react_1.useState)(''), region = _t[0], setRegion = _t[1];
    var _u = (0, react_1.useState)(false), isRegionLoading = _u[0], setIsRegionLoading = _u[1];
    var _v = (0, react_1.useState)([]), features = _v[0], setFeatures = _v[1];
    var _w = (0, react_1.useState)(''), featureDraft = _w[0], setFeatureDraft = _w[1];
    var _x = (0, react_1.useState)(null), trailImage = _x[0], setTrailImage = _x[1];
    var _y = (0, react_1.useState)(false), isPickingImage = _y[0], setIsPickingImage = _y[1];
    var _z = (0, react_1.useState)(null), savingMode = _z[0], setSavingMode = _z[1];
    var _0 = (0, react_1.useState)(null), saveError = _0[0], setSaveError = _0[1];
    var _1 = (0, react_1.useState)(null), saveSuccess = _1[0], setSaveSuccess = _1[1];
    var _2 = (0, react_1.useState)(null), recordingStartedAt = _2[0], setRecordingStartedAt = _2[1];
    var _3 = (0, react_1.useState)(false), isMapReady = _3[0], setIsMapReady = _3[1];
    var _4 = (0, react_1.useState)(false), isTrailInfoCollapsed = _4[0], setIsTrailInfoCollapsed = _4[1];
    var _5 = (0, react_1.useState)(initialZoom), zoomLevel = _5[0], setZoomLevel = _5[1];
    var _6 = (0, react_1.useState)(0), pitch = _6[0], setPitch = _6[1]; // 0 for 2D, 45 for 3D
    var zoomIn = function () { return setZoomLevel(function (prev) { return Math.min(prev + 1, 20); }); };
    var zoomOut = function () { return setZoomLevel(function (prev) { return Math.max(prev - 1, 0); }); };
    var toggle3D = function () { return setPitch(function (prev) { return prev === 0 ? 45 : 0; }); };
    var applyRouteAnalysis = function (analysis) {
        var _a, _b, _c;
        setStats({
            length_meters: analysis.length_meters,
            elevation_gain_meters: analysis.elevation_gain_meters,
            estimated_duration_minutes: analysis.estimated_duration_minutes,
            difficulty: analysis.difficulty,
        });
        var suggestedName = (_a = analysis.ai_name) === null || _a === void 0 ? void 0 : _a.trim();
        var suggestedDescription = (_b = analysis.ai_description) === null || _b === void 0 ? void 0 : _b.trim();
        var suggestedRegion = (_c = analysis.region) === null || _c === void 0 ? void 0 : _c.trim();
        var suggestedLabels = Array.isArray(analysis.ai_labels) ? analysis.ai_labels.filter(Boolean) : [];
        if (suggestedName) {
            setName(function (current) {
                var trimmedCurrent = current.trim();
                if (trimmedCurrent && trimmedCurrent !== lastAiNameRef.current) {
                    return current;
                }
                lastAiNameRef.current = suggestedName;
                return suggestedName;
            });
        }
        if (suggestedDescription) {
            setDescription(function (current) {
                var trimmedCurrent = current.trim();
                if (trimmedCurrent && trimmedCurrent !== lastAiDescriptionRef.current) {
                    return current;
                }
                lastAiDescriptionRef.current = suggestedDescription;
                return suggestedDescription;
            });
        }
        if (suggestedRegion) {
            setRegion(function (current) {
                var trimmedCurrent = current.trim();
                if (trimmedCurrent && trimmedCurrent !== lastAiRegionRef.current) {
                    return current;
                }
                lastAiRegionRef.current = suggestedRegion;
                return suggestedRegion;
            });
        }
        setFeatures(Array.from(new Set(suggestedLabels)));
    };
    var addFeature = function () {
        var nextFeature = featureDraft.trim();
        if (!nextFeature) {
            return;
        }
        setFeatures(function (current) {
            var alreadyExists = current.some(function (feature) { return feature.trim().toLowerCase() === nextFeature.toLowerCase(); });
            return alreadyExists ? current : __spreadArray(__spreadArray([], current, true), [nextFeature], false);
        });
        setFeatureDraft('');
    };
    var removeFeature = function (featureToRemove) {
        setFeatures(function (current) { return current.filter(function (feature) { return feature !== featureToRemove; }); });
    };
    var routeGeojson = (0, react_1.useMemo)(function () { return toLineFeature(routeCoordinates); }, [routeCoordinates]);
    var routeKey = (0, react_1.useMemo)(function () { return routeCoordinates.map(function (_a) {
        var lng = _a[0], lat = _a[1];
        return "".concat(lng.toFixed(5), ",").concat(lat.toFixed(5));
    }).join('|'); }, [routeCoordinates]);
    var startGeojson = (0, react_1.useMemo)(function () { return toPointFeature(startCoordinate); }, [startCoordinate]);
    var middleGeojson = (0, react_1.useMemo)(function () { return toPointsFeatureCollection(middleCoordinates); }, [middleCoordinates]);
    var endGeojson = (0, react_1.useMemo)(function () { return toPointFeature(endCoordinate); }, [endCoordinate]);
    var waypointCount = middleCoordinates.length + (startCoordinate ? 1 : 0) + (endCoordinate ? 1 : 0);
    var canUndo = isDrawing && waypointCount > 0;
    var canMarkEnd = isDrawing && Boolean(startCoordinate) && drawingStage === 'middle';
    var canFinish = isDrawing && Boolean(startCoordinate && endCoordinate) && !isCalculating;
    var recordedDistanceMeters = (0, react_1.useMemo)(function () { return getPathDistanceMeters(routeCoordinates); }, [routeCoordinates]);
    (0, react_1.useEffect)(function () {
        return function () {
            var _a;
            (_a = locationSubscriptionRef.current) === null || _a === void 0 ? void 0 : _a.remove();
            locationSubscriptionRef.current = null;
        };
    }, []);
    (0, react_1.useEffect)(function () {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        if (!((_a = initialGeneratedTrail === null || initialGeneratedTrail === void 0 ? void 0 : initialGeneratedTrail.coordinates) === null || _a === void 0 ? void 0 : _a.length)) {
            return;
        }
        var coordinates = initialGeneratedTrail.coordinates;
        var firstCoordinate = (_b = coordinates[0]) !== null && _b !== void 0 ? _b : null;
        var lastCoordinate = (_c = coordinates[coordinates.length - 1]) !== null && _c !== void 0 ? _c : null;
        (_d = locationSubscriptionRef.current) === null || _d === void 0 ? void 0 : _d.remove();
        locationSubscriptionRef.current = null;
        setSaveSuccess('AI route ready. Review the details, then save or publish it.');
        setSaveError(null);
        setCalcError(null);
        lastAiNameRef.current = ((_e = initialGeneratedTrail.name_suggestion) === null || _e === void 0 ? void 0 : _e.trim()) || 'Suggested Trail';
        lastAiDescriptionRef.current = ((_f = initialGeneratedTrail.description_suggestion) === null || _f === void 0 ? void 0 : _f.trim()) || '';
        lastAiRegionRef.current = '';
        setName(((_g = initialGeneratedTrail.name_suggestion) === null || _g === void 0 ? void 0 : _g.trim()) || 'Suggested Trail');
        setDescription(((_h = initialGeneratedTrail.description_suggestion) === null || _h === void 0 ? void 0 : _h.trim()) || '');
        setFeatures(Array.from(new Set(((_j = initialGeneratedTrail.labels) !== null && _j !== void 0 ? _j : []).filter(Boolean))));
        setStartCoordinate(firstCoordinate);
        setMiddleCoordinates(coordinates.slice(1, -1));
        setEndCoordinate(lastCoordinate);
        setRouteCoordinates(coordinates);
        setStats({
            length_meters: initialGeneratedTrail.length_meters,
            elevation_gain_meters: initialGeneratedTrail.elevation_gain_meters,
            estimated_duration_minutes: initialGeneratedTrail.estimated_duration_minutes,
            difficulty: initialGeneratedTrail.difficulty,
        });
        setIsLoop(Boolean(firstCoordinate && lastCoordinate && firstCoordinate[0] === lastCoordinate[0] && firstCoordinate[1] === lastCoordinate[1]));
        setDrawingStage('end');
        setIsDrawing(false);
        setIsRecordingTrail(false);
        setIsFinished(true);
        setRecordingStartedAt(null);
        setIsTrailInfoCollapsed(false);
        if (firstCoordinate) {
            (_k = cameraRef.current) === null || _k === void 0 ? void 0 : _k.setCamera({
                centerCoordinate: firstCoordinate,
                zoomLevel: 12,
                animationDuration: 650,
            });
        }
    }, [initialGeneratedTrail]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!isMapReady || routeCoordinates.length < 2) {
            return;
        }
        var bounds = getRouteBounds(routeCoordinates);
        if (!bounds) {
            return;
        }
        (_a = cameraRef.current) === null || _a === void 0 ? void 0 : _a.fitBounds(bounds.northEast, bounds.southWest, 80, 800);
    }, [isMapReady, routeKey, routeCoordinates]);
    var begin = function () {
        var _a;
        (_a = locationSubscriptionRef.current) === null || _a === void 0 ? void 0 : _a.remove();
        locationSubscriptionRef.current = null;
        setSaveSuccess(null);
        setSaveError(null);
        setCalcError(null);
        lastAiNameRef.current = '';
        lastAiDescriptionRef.current = '';
        lastAiRegionRef.current = '';
        setStats(null);
        setName('');
        setDescription('');
        setRegion('');
        setFeatures([]);
        setStartCoordinate(null);
        setMiddleCoordinates([]);
        setEndCoordinate(null);
        setRouteCoordinates([]);
        setIsLoop(false);
        setDrawingStage('start');
        setIsDrawing(true);
        setIsRecordingTrail(false);
        setIsFinished(false);
        setRecordingStartedAt(null);
        setIsTrailInfoCollapsed(false);
    };
    var beginRecordingTrail = function () { return __awaiter(_this, void 0, void 0, function () {
        var permission, current, initialCoordinate, _a, error_3;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    (_b = locationSubscriptionRef.current) === null || _b === void 0 ? void 0 : _b.remove();
                    locationSubscriptionRef.current = null;
                    setSaveSuccess(null);
                    setSaveError(null);
                    setCalcError(null);
                    lastAiNameRef.current = '';
                    lastAiDescriptionRef.current = '';
                    lastAiRegionRef.current = '';
                    setStats(null);
                    setName('');
                    setDescription('');
                    setRegion('');
                    setFeatures([]);
                    setStartCoordinate(null);
                    setMiddleCoordinates([]);
                    setEndCoordinate(null);
                    setRouteCoordinates([]);
                    setIsLoop(false);
                    setDrawingStage('start');
                    setIsDrawing(false);
                    setIsFinished(false);
                    setIsRecordingTrail(false);
                    setRecordingStartedAt(null);
                    setIsTrailInfoCollapsed(false);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 5, , 6]);
                    return [4 /*yield*/, Location.requestForegroundPermissionsAsync()];
                case 2:
                    permission = _d.sent();
                    if (!permission.granted) {
                        react_native_1.Alert.alert('Location required', 'Location permission is required to record a trail as you walk.');
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.BestForNavigation,
                        })];
                case 3:
                    current = _d.sent();
                    initialCoordinate = [current.coords.longitude, current.coords.latitude];
                    setStartCoordinate(initialCoordinate);
                    setEndCoordinate(initialCoordinate);
                    setRouteCoordinates([initialCoordinate]);
                    setIsRecordingTrail(true);
                    setRecordingStartedAt(Date.now());
                    (_c = cameraRef.current) === null || _c === void 0 ? void 0 : _c.setCamera({
                        centerCoordinate: initialCoordinate,
                        zoomLevel: 15,
                        animationDuration: 650,
                    });
                    _a = locationSubscriptionRef;
                    return [4 /*yield*/, Location.watchPositionAsync({
                            accuracy: Location.Accuracy.BestForNavigation,
                            distanceInterval: 5,
                            timeInterval: 2500,
                        }, function (location) {
                            var nextCoordinate = [location.coords.longitude, location.coords.latitude];
                            setRouteCoordinates(function (currentPath) {
                                var previousCoordinate = currentPath[currentPath.length - 1];
                                if (previousCoordinate && getDistanceMeters(previousCoordinate, nextCoordinate) < 5) {
                                    return currentPath;
                                }
                                var nextPath = __spreadArray(__spreadArray([], currentPath, true), [nextCoordinate], false);
                                setEndCoordinate(nextCoordinate);
                                return nextPath;
                            });
                        })];
                case 4:
                    _a.current = _d.sent();
                    return [3 /*break*/, 6];
                case 5:
                    error_3 = _d.sent();
                    setIsRecordingTrail(false);
                    setRecordingStartedAt(null);
                    react_native_1.Alert.alert('Unable to start recording', error_3 instanceof Error ? error_3.message : 'Please try again.');
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    var clear = function () {
        var _a;
        (_a = locationSubscriptionRef.current) === null || _a === void 0 ? void 0 : _a.remove();
        locationSubscriptionRef.current = null;
        setName('');
        setDescription('');
        setRegion('');
        setFeatures([]);
        setStartCoordinate(null);
        setMiddleCoordinates([]);
        setEndCoordinate(null);
        setRouteCoordinates([]);
        setIsLoop(false);
        setDrawingStage('start');
        setIsDrawing(false);
        setIsRecordingTrail(false);
        setIsFinished(false);
        setStats(null);
        setCalcError(null);
        setSaveError(null);
        setSaveSuccess(null);
        setRecordingStartedAt(null);
        setIsTrailInfoCollapsed(false);
    };
    var finishRecordedTrail = function () { return __awaiter(_this, void 0, void 0, function () {
        var elapsedSeconds, analysis, _a, error_4;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (routeCoordinates.length < 2) {
                        react_native_1.Alert.alert('Keep walking', 'Record at least two GPS points before finishing the trail.');
                        return [2 /*return*/];
                    }
                    (_b = locationSubscriptionRef.current) === null || _b === void 0 ? void 0 : _b.remove();
                    locationSubscriptionRef.current = null;
                    setIsRecordingTrail(false);
                    setIsCalculating(true);
                    setCalcError(null);
                    setSaveError(null);
                    setSaveSuccess(null);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 6, 7, 8]);
                    elapsedSeconds = recordingStartedAt ? Math.max(60, Math.round((Date.now() - recordingStartedAt) / 1000)) : Math.max(60, routeCoordinates.length * 5);
                    _c.label = 2;
                case 2:
                    _c.trys.push([2, 4, , 5]);
                    return [4 /*yield*/, (0, trailsApi_1.analyzeTrailRoute)({ coordinates: routeCoordinates })];
                case 3:
                    analysis = _c.sent();
                    applyRouteAnalysis(analysis);
                    return [3 /*break*/, 5];
                case 4:
                    _a = _c.sent();
                    setStats(toFallbackStats(recordedDistanceMeters, elapsedSeconds));
                    setFeatures([]);
                    return [3 /*break*/, 5];
                case 5:
                    setIsFinished(true);
                    return [3 /*break*/, 8];
                case 6:
                    error_4 = _c.sent();
                    setCalcError(error_4 instanceof Error ? error_4.message : 'Failed to prepare recorded trail.');
                    return [3 /*break*/, 8];
                case 7:
                    setIsCalculating(false);
                    setRecordingStartedAt(null);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); };
    var undo = function () {
        setSaveSuccess(null);
        setSaveError(null);
        setCalcError(null);
        setStats(null);
        setRouteCoordinates([]);
        setIsFinished(false);
        if (endCoordinate) {
            setEndCoordinate(null);
            setDrawingStage('end');
            return;
        }
        if (middleCoordinates.length) {
            setMiddleCoordinates(function (current) { return current.slice(0, -1); });
            setDrawingStage('middle');
            return;
        }
        if (startCoordinate) {
            setStartCoordinate(null);
            setDrawingStage('start');
        }
    };
    var buildManualWaypoints = function () {
        if (!startCoordinate || !endCoordinate) {
            return [];
        }
        var points = __spreadArray(__spreadArray([startCoordinate], middleCoordinates, true), [endCoordinate], false);
        return isLoop ? __spreadArray(__spreadArray([], points, true), [startCoordinate], false) : points;
    };
    var fetchTrail = function () { return __awaiter(_this, void 0, void 0, function () {
        var waypoints, res, text, json, route, geometryCoordinates, analysis, _a, e_1;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    waypoints = buildManualWaypoints();
                    if (waypoints.length < 2) {
                        setCalcError('Choose a start and end point first.');
                        return [2 /*return*/];
                    }
                    setSaveSuccess(null);
                    setSaveError(null);
                    setIsCalculating(true);
                    setCalcError(null);
                    setStats(null);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 10, 11, 12]);
                    if (!MAPBOX_ACCESS_TOKEN) {
                        throw new Error('Missing EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN.');
                    }
                    return [4 /*yield*/, fetch(buildDirectionsUrl(waypoints))];
                case 2:
                    res = _d.sent();
                    if (!!res.ok) return [3 /*break*/, 4];
                    return [4 /*yield*/, res.text().catch(function () { return ''; })];
                case 3:
                    text = _d.sent();
                    throw new Error(text || "Directions request failed (".concat(res.status, ")"));
                case 4: return [4 /*yield*/, res.json()];
                case 5:
                    json = (_d.sent());
                    route = (_b = json.routes) === null || _b === void 0 ? void 0 : _b[0];
                    geometryCoordinates = (_c = route === null || route === void 0 ? void 0 : route.geometry) === null || _c === void 0 ? void 0 : _c.coordinates;
                    if (!route || !geometryCoordinates || geometryCoordinates.length < 2) {
                        throw new Error('No route was returned for those points.');
                    }
                    setRouteCoordinates(geometryCoordinates);
                    setIsDrawing(false);
                    setIsFinished(true);
                    _d.label = 6;
                case 6:
                    _d.trys.push([6, 8, , 9]);
                    return [4 /*yield*/, (0, trailsApi_1.analyzeTrailRoute)({ coordinates: geometryCoordinates })];
                case 7:
                    analysis = _d.sent();
                    applyRouteAnalysis(analysis);
                    return [3 /*break*/, 9];
                case 8:
                    _a = _d.sent();
                    setStats(toFallbackStats(route.distance, route.duration));
                    setFeatures([]);
                    return [3 /*break*/, 9];
                case 9: return [3 /*break*/, 12];
                case 10:
                    e_1 = _d.sent();
                    setRouteCoordinates([]);
                    setIsFinished(false);
                    setCalcError(e_1 instanceof Error ? e_1.message : 'Failed to calculate stats.');
                    return [3 /*break*/, 12];
                case 11:
                    setIsCalculating(false);
                    return [7 /*endfinally*/];
                case 12: return [2 /*return*/];
            }
        });
    }); };
    var save = async function (status) {
        if (!isFinished || !stats) {
            return;
        }
        if (!name.trim()) {
            react_native_1.Alert.alert('Missing name', 'Please enter a trail name.');
            return;
        }
        if (status === 'published' && !description.trim()) {
            react_native_1.Alert.alert('Missing description', 'Please add a description before publishing this trail.');
            return;
        }
        setSavingMode(status);
        setSaveError(null);
        setSaveSuccess(null);
        try {
            var confirmedDuplicate = false;
            var duplicateWarning = await (0, trailsApi_1.checkDuplicateTrail)({
                name: name.trim(),
                coordinates: routeCoordinates,
                distance: stats.length_meters,
                visibility: 'public',
            });
            if (duplicateWarning.has_similar_trails) {
                var shouldCreateAnyway = await confirmDuplicateTrail(duplicateWarning);
                if (!shouldCreateAnyway) {
                    return;
                }
                confirmedDuplicate = true;
            }
            var translatedTrail = await (0, translateTrailContent_1.translateTrailContentToArabic)({
                name: name.trim(),
                description: description.trim() || undefined,
                region: region.trim() || undefined,
                features: features,
            });
            var createStatus = status === 'published' ? 'draft' : status;
            var payload = {
                name: name.trim(),
                nameAr: translatedTrail.nameAr,
                description: description.trim() || undefined,
                descriptionAr: translatedTrail.descriptionAr,
                region: region.trim() || undefined,
                regionAr: translatedTrail.regionAr,
                features: features,
                featuresAr: translatedTrail.featuresAr,
                tags: features,
                status: createStatus,
                visibility: status === 'published' ? 'public' : 'private',
                confirm_duplicate: confirmedDuplicate,
                coordinates: routeCoordinates,
                stats: stats,
            };
            var json = void 0;
            try {
                json = await (0, trailsApi_1.createTrail)(payload);
            }
            catch (error) {
                var errorPayload = error instanceof client_1.ApiError ? error.payload : undefined;
                if (error instanceof client_1.ApiError &&
                    error.status === 400 &&
                    Array.isArray(errorPayload === null || errorPayload === void 0 ? void 0 : errorPayload.warnings) &&
                    errorPayload.warnings.length > 0) {
                    await showHazardBlockedWarning(errorPayload.warnings);
                    setSaveError('This trail cannot be created because the route passes through hazardous or settlement areas.');
                    return;
                }
                else {
                    throw error;
                }
            }
            if (trailImage) {
                try {
                    await (0, trailsApi_1.uploadTrailPhoto)(json.data.id, trailImage);
                }
                catch (uploadError) {
                    console.warn('Trail photo upload failed:', uploadError);
                    setSaveError('Trail saved, but photo upload failed.');
                }
            }
            if (status === 'published') {
                await (0, trailsApi_1.publishTrail)(json.data.id);
            }
            (0, trailRoutes_1.setTrailRouteCoordinates)(json.data.id, routeCoordinates);
            setSaveSuccess(status === 'published' ? 'Published!' : 'Draft saved!');
            onSaved === null || onSaved === void 0 ? void 0 : onSaved(__assign(__assign({}, payload), { id: json.data.id, status: status }));
        }
        catch (error) {
            setSaveError(error instanceof Error ? error.message : status === 'published' ? 'Failed to publish trail.' : 'Failed to save draft.');
        }
        finally {
            setSavingMode(null);
        }
    };
    var handleMapPress = function (coord) {
        if (!isDrawing || !coord || coord.length !== 2 || isCalculating) {
            return;
        }
        setSaveSuccess(null);
        setSaveError(null);
        setCalcError(null);
        setStats(null);
        setRouteCoordinates([]);
        setIsFinished(false);
        if (drawingStage === 'start') {
            setStartCoordinate(coord);
            setMiddleCoordinates([]);
            setEndCoordinate(null);
            setDrawingStage('middle');
            return;
        }
        if (drawingStage === 'middle') {
            setMiddleCoordinates(function (current) { return __spreadArray(__spreadArray([], current, true), [coord], false); });
            return;
        }
        setEndCoordinate(coord);
    };
    var stageTitle = isRecordingTrail
        ? 'Recording your walk'
        : drawingStage === 'start'
            ? 'Tap a starting point'
            : drawingStage === 'middle'
                ? 'Add middle points or switch to the end point'
                : 'Tap the ending point';
    var stageSummary = isRecordingTrail
        ? "".concat((recordedDistanceMeters / 1000).toFixed(2), " km | ").concat(Math.max(0, routeCoordinates.length), " GPS points")
        : [
            startCoordinate ? 'Start set' : 'Choose a start',
            middleCoordinates.length ? "".concat(middleCoordinates.length, " middle point").concat(middleCoordinates.length === 1 ? '' : 's') : 'No middle points',
            endCoordinate ? 'End set' : 'Choose an end',
            isLoop ? 'Loop on' : 'Loop off',
        ].join(' | ');
    var shouldShowTrailInfoPanel = isDrawing || isRecordingTrail || isFinished;
    var panelBottomPadding = Math.max(12, insets.bottom + 10);
    var mapControlsBottom = !shouldShowTrailInfoPanel
        ? Math.max(22, insets.bottom + 22)
        : isTrailInfoCollapsed
            ? Math.max(92, insets.bottom + 82)
            : 120;
    return (<react_native_1.View style={styles.root}>
      <maps_1.default.MapView style={styles.map} styleURL={styleURL} compassEnabled scaleBarEnabled={false} logoEnabled={false} attributionEnabled={false} onDidFinishLoadingMap={function () { return setIsMapReady(true); }} onPress={function (e) {
            var _a, _b;
            var coord = ((_b = (_a = e.geometry) === null || _a === void 0 ? void 0 : _a.coordinates) !== null && _b !== void 0 ? _b : null);
            handleMapPress(coord);
        }}>
        <maps_1.default.Camera ref={cameraRef} centerCoordinate={initialCenter} zoomLevel={zoomLevel} pitch={pitch}/>

        <maps_1.default.ShapeSource key={"trail-route-source-".concat(routeKey)} id="trail-route-source" shape={routeGeojson}>
          <maps_1.default.LineLayer id="trail-line" style={{
            lineColor: '#1D9E75',
            lineWidth: 5,
            lineJoin: 'round',
            lineCap: 'round',
            lineOpacity: 0.92,
            lineDasharray: [1.2, 1.2],
        }}/>
        </maps_1.default.ShapeSource>

        <maps_1.default.ShapeSource id="trail-start-source" shape={startGeojson}>
          <maps_1.default.CircleLayer id="trail-start-point" style={{
            circleColor: '#FFFFFF',
            circleStrokeColor: '#1D9E75',
            circleStrokeWidth: 3,
            circleRadius: 7,
        }}/>
        </maps_1.default.ShapeSource>

        <maps_1.default.ShapeSource id="trail-middle-source" shape={middleGeojson}>
          <maps_1.default.CircleLayer id="trail-middle-points" style={{
            circleColor: '#FFFFFF',
            circleStrokeColor: '#D4A843',
            circleStrokeWidth: 2.5,
            circleRadius: 5,
        }}/>
        </maps_1.default.ShapeSource>

        <maps_1.default.ShapeSource id="trail-end-source" shape={endGeojson}>
          <maps_1.default.CircleLayer id="trail-end-point" style={{
            circleColor: '#FFFFFF',
            circleStrokeColor: '#D85A30',
            circleStrokeWidth: 3,
            circleRadius: 7,
        }}/>
        </maps_1.default.ShapeSource>
      </maps_1.default.MapView>

      <react_native_1.View style={[styles.mapControls, { bottom: mapControlsBottom }]}>
        <react_native_1.Pressable style={styles.controlButton} onPress={zoomIn}>
          <vector_icons_1.Ionicons name="add" size={24} color="#2C2418"/>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={styles.controlButton} onPress={zoomOut}>
          <vector_icons_1.Ionicons name="remove" size={24} color="#2C2418"/>
        </react_native_1.Pressable>
        <react_native_1.Pressable style={[styles.controlButton, pitch > 0 && styles.controlButtonActive]} onPress={toggle3D}>
          <vector_icons_1.Ionicons name="cube-outline" size={20} color={pitch > 0 ? "#fff" : "#2C2418"}/>
        </react_native_1.Pressable>
      </react_native_1.View>

      <react_native_1.View style={[styles.topBar, { paddingTop: Math.max(12, insets.top + 8) }]}>
        <react_native_1.View style={styles.brandPill}>
          <react_native_1.View style={styles.brandDot}/>
          <react_native_1.Text style={styles.brandText}>Trail Creator</react_native_1.Text>
        </react_native_1.View>

        <react_native_1.View style={styles.topActions}>
          {!isDrawing && !isRecordingTrail && !isFinished ? (<>
              <react_native_1.Pressable style={[styles.iconButton, styles.primaryIconButton]} onPress={begin}>
                <vector_icons_1.Ionicons name="git-compare-outline" size={18} color="#fff"/>
                <react_native_1.Text style={styles.primaryIconText}>Draw trail</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Pressable style={[styles.iconButton, styles.recordIconButton]} onPress={function () { return void beginRecordingTrail(); }}>
                <vector_icons_1.Ionicons name="radio-outline" size={18} color="#fff"/>
                <react_native_1.Text style={styles.primaryIconText}>Record walk</react_native_1.Text>
              </react_native_1.Pressable>
            </>) : null}

          {isDrawing ? (<>
              <react_native_1.Pressable style={styles.iconButton} onPress={undo} disabled={!canUndo}>
                <vector_icons_1.Ionicons name="arrow-undo-outline" size={18} color={canUndo ? '#2C2418' : '#B0A090'}/>
                <react_native_1.Text style={[styles.iconText, !canUndo && styles.iconTextDisabled]}>Undo</react_native_1.Text>
              </react_native_1.Pressable>

              <react_native_1.Pressable style={[styles.iconButton, isLoop && styles.loopIconButton]} onPress={function () { return setIsLoop(function (current) { return !current; }); }}>
                <vector_icons_1.Ionicons name="sync-outline" size={18} color={isLoop ? '#FFFFFF' : '#2C2418'}/>
                <react_native_1.Text style={[styles.iconText, isLoop && styles.loopText]}>Loop</react_native_1.Text>
              </react_native_1.Pressable>

              <react_native_1.Pressable style={[styles.iconButton, !canMarkEnd && styles.iconButtonDisabled]} onPress={function () {
                if (canMarkEnd) {
                    setDrawingStage('end');
                }
            }} disabled={!canMarkEnd}>
                <vector_icons_1.Ionicons name="flag-outline" size={18} color={canMarkEnd ? '#2C2418' : '#B0A090'}/>
                <react_native_1.Text style={[styles.iconText, !canMarkEnd && styles.iconTextDisabled]}>Set end</react_native_1.Text>
              </react_native_1.Pressable>

              <react_native_1.Pressable style={[styles.iconButton, styles.dangerIconButton]} onPress={clear}>
                <vector_icons_1.Ionicons name="trash-outline" size={18} color="#BB2823"/>
                <react_native_1.Text style={[styles.iconText, styles.dangerText]}>Clear</react_native_1.Text>
              </react_native_1.Pressable>
            </>) : null}

          {isRecordingTrail ? (<>
              <react_native_1.Pressable style={[styles.iconButton, styles.recordIconButton]} onPress={function () { return void finishRecordedTrail(); }}>
                <vector_icons_1.Ionicons name="checkmark-circle-outline" size={18} color="#fff"/>
                <react_native_1.Text style={styles.primaryIconText}>Finish</react_native_1.Text>
              </react_native_1.Pressable>
              <react_native_1.Pressable style={[styles.iconButton, styles.dangerIconButton]} onPress={clear}>
                <vector_icons_1.Ionicons name="close-circle-outline" size={18} color="#BB2823"/>
                <react_native_1.Text style={[styles.iconText, styles.dangerText]}>Cancel</react_native_1.Text>
              </react_native_1.Pressable>
            </>) : null}

          {isFinished ? (<react_native_1.Pressable style={[styles.iconButton, styles.dangerIconButton]} onPress={clear}>
              <vector_icons_1.Ionicons name="refresh-outline" size={18} color="#BB2823"/>
              <react_native_1.Text style={[styles.iconText, styles.dangerText]}>Start over</react_native_1.Text>
            </react_native_1.Pressable>) : null}
        </react_native_1.View>
      </react_native_1.View>

      {shouldShowTrailInfoPanel && (<react_native_1.View style={[styles.bottomPanelWrap, { paddingBottom: panelBottomPadding }]}>
          <react_native_1.View style={[styles.bottomPanel, isTrailInfoCollapsed ? styles.bottomPanelCollapsed : { maxHeight: Math.max(260, windowHeight * 0.72) }]}>
            <react_native_1.Pressable accessibilityRole="button" accessibilityLabel={isTrailInfoCollapsed ? 'Expand trail info panel' : 'Collapse trail info panel'} style={styles.panelHeaderButton} onPress={function () { return setIsTrailInfoCollapsed(function (current) { return !current; }); }}>
              <react_native_1.View style={styles.panelHandle}/>
              <react_native_1.View style={styles.panelHeaderRow}>
                <react_native_1.View style={{ flex: 1 }}>
                  <react_native_1.Text style={styles.panelTitle}>{isDrawing || isRecordingTrail ? stageTitle : 'Trail details'}</react_native_1.Text>
                  <react_native_1.Text style={styles.panelSubtitle}>{stageSummary}</react_native_1.Text>
                </react_native_1.View>
                {isCalculating ? <react_native_1.ActivityIndicator /> : null}
                <react_native_1.View style={styles.collapseButton}>
                  <vector_icons_1.Ionicons name={isTrailInfoCollapsed ? 'chevron-up' : 'chevron-down'} size={20} color="#2C2418"/>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.Pressable>

            {!isTrailInfoCollapsed ? (<react_native_1.ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.bottomPanelScrollContent}>
              {calcError ? <react_native_1.Text style={styles.errorText}>{calcError}</react_native_1.Text> : null}

              {isRecordingTrail ? (<react_native_1.View style={styles.drawingActionsRow}>
                  <react_native_1.Pressable style={[styles.secondaryActionButton, routeCoordinates.length < 2 && styles.secondaryActionButtonDisabled]} disabled={routeCoordinates.length < 2 || isCalculating} onPress={function () { return void finishRecordedTrail(); }}>
                    <vector_icons_1.Ionicons name="checkmark-circle-outline" size={16} color={routeCoordinates.length >= 2 ? '#2C2418' : '#B0A090'}/>
                    <react_native_1.Text style={[styles.secondaryActionText, routeCoordinates.length < 2 && styles.iconTextDisabled]}>
                      Finish recording
                    </react_native_1.Text>
                  </react_native_1.Pressable>
                </react_native_1.View>) : isDrawing ? (<react_native_1.View style={styles.drawingActionsRow}>
                  <react_native_1.Pressable style={[styles.secondaryActionButton, !canFinish && styles.secondaryActionButtonDisabled]} disabled={!canFinish} onPress={function () { return void fetchTrail(); }}>
                    <vector_icons_1.Ionicons name="sparkles-outline" size={16} color={canFinish ? '#2C2418' : '#B0A090'}/>
                    <react_native_1.Text style={[styles.secondaryActionText, !canFinish && styles.iconTextDisabled]}>
                      Build route
                    </react_native_1.Text>
                  </react_native_1.Pressable>
                </react_native_1.View>) : null}

              {stats ? (<react_native_1.View style={styles.statsGrid}>
                  <react_native_1.View style={styles.statCard}>
                    <react_native_1.Text style={styles.statValue}>{(stats.length_meters / 1000).toFixed(2)}</react_native_1.Text>
                    <react_native_1.Text style={styles.statLabel}>km</react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.View style={styles.statCard}>
                    <react_native_1.Text style={styles.statValue}>{Math.round(stats.elevation_gain_meters)}</react_native_1.Text>
                    <react_native_1.Text style={styles.statLabel}>m gain</react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.View style={styles.statCard}>
                    <react_native_1.Text style={styles.statValue}>{formatDuration(stats.estimated_duration_minutes)}</react_native_1.Text>
                    <react_native_1.Text style={styles.statLabel}>time</react_native_1.Text>
                  </react_native_1.View>
                  <react_native_1.View style={[styles.badge, { backgroundColor: difficultyTone(stats.difficulty).bg }]}>
                    <react_native_1.View style={[styles.badgeDot, { backgroundColor: difficultyTone(stats.difficulty).dot }]}/>
                    <react_native_1.Text style={[styles.badgeText, { color: difficultyTone(stats.difficulty).fg }]}>
                      {stats.difficulty}
                    </react_native_1.Text>
                  </react_native_1.View>
                </react_native_1.View>) : null}

              {isFinished ? (<>
                  <react_native_1.View style={styles.formRow}>
                    <react_native_1.Text style={styles.inputLabel}>Trail name</react_native_1.Text>
                    <react_native_1.TextInput value={name} onChangeText={setName} placeholder={isLoop ? 'e.g. Wadi Qelt Loop' : 'e.g. Wadi Qelt Traverse'} placeholderTextColor="#9E8E80" style={styles.input}/>
                  </react_native_1.View>
                  <react_native_1.View style={styles.formRow}>
                    <react_native_1.Text style={styles.inputLabel}>Description</react_native_1.Text>
                    <react_native_1.TextInput value={description} onChangeText={setDescription} placeholder="Notes, tips, best season, water sources..." placeholderTextColor="#9E8E80" style={[styles.input, styles.textarea]} multiline/>
                  </react_native_1.View>
                  <react_native_1.View style={styles.formRow}>
                    <react_native_1.Text style={styles.inputLabel}>Region/City</react_native_1.Text>
                    <react_native_1.TextInput value={region} onChangeText={setRegion} placeholder={isRegionLoading ? 'Deriving area and city from start point...' : 'e.g. Old City - Nablus'} placeholderTextColor="#9E8E80" style={styles.input}/>
                  </react_native_1.View>
                  <react_native_1.View style={styles.formRow}>
                    <react_native_1.Text style={styles.inputLabel}>Features</react_native_1.Text>
                    <react_native_1.View style={styles.featureInputRow}>
                      <react_native_1.TextInput value={featureDraft} onChangeText={setFeatureDraft} onSubmitEditing={addFeature} placeholder="Add a feature, e.g. spring, ruins, viewpoint" placeholderTextColor="#9E8E80" returnKeyType="done" style={[styles.input, styles.featureInput]}/>
                      <react_native_1.Pressable accessibilityLabel="Add feature" disabled={!featureDraft.trim()} onPress={addFeature} style={[styles.featureAddButton, !featureDraft.trim() && styles.featureAddButtonDisabled]}>
                        <vector_icons_1.Ionicons name="add" size={22} color="#fff"/>
                      </react_native_1.Pressable>
                    </react_native_1.View>
                    <react_native_1.View style={styles.featuresContainer}>
                      {features.length ? (features.map(function (feature) { return (<react_native_1.Pressable key={feature} style={[styles.featureChip, styles.featureChipSelected]} onPress={function () { return removeFeature(feature); }} accessibilityLabel={"Remove ".concat(feature)}>
                            <react_native_1.Text style={[styles.featureChipText, styles.featureChipTextSelected]}>
                              {feature}
                            </react_native_1.Text>
                            <vector_icons_1.Ionicons name="close" size={14} color="#fff"/>
                          </react_native_1.Pressable>); })) : (<react_native_1.View style={styles.emptyFeaturesBox}>
                          <react_native_1.Text style={styles.emptyFeaturesText}>
                            Add features manually, or keep the AI-generated labels after route analysis.
                          </react_native_1.Text>
                        </react_native_1.View>)}
                    </react_native_1.View>
                  </react_native_1.View>

                  <react_native_1.View style={styles.formRow}>
                    <react_native_1.Text style={styles.inputLabel}>Trail photo</react_native_1.Text>
                    <react_native_1.View style={styles.photoRow}>
                      {trailImage ? (<react_native_1.Image source={{ uri: trailImage }} style={styles.photoPreview}/>) : (<react_native_1.View style={styles.photoPlaceholder}>
                          <react_native_1.Text style={styles.photoPlaceholderText}>No photo selected</react_native_1.Text>
                        </react_native_1.View>)}
                      <react_native_1.View style={styles.photoActions}>
                        <react_native_1.Pressable style={styles.photoButton} onPress={function () { return __awaiter(_this, void 0, void 0, function () {
                        var uri;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    setIsPickingImage(true);
                                    return [4 /*yield*/, pickTrailImage()];
                                case 1:
                                    uri = _a.sent();
                                    setIsPickingImage(false);
                                    if (uri)
                                        setTrailImage(uri);
                                    return [2 /*return*/];
                            }
                        });
                    }); }}>
                          <react_native_1.Text style={styles.photoButtonText}>
                            {isPickingImage ? 'Picking...' : 'Select photo'}
                          </react_native_1.Text>
                        </react_native_1.Pressable>
                        {trailImage ? (<react_native_1.Pressable style={[styles.photoButton, styles.photoRemoveButton]} onPress={function () { return setTrailImage(null); }}>
                            <react_native_1.Text style={[styles.photoButtonText, styles.photoRemoveButtonText]}>Remove</react_native_1.Text>
                          </react_native_1.Pressable>) : null}
                      </react_native_1.View>
                    </react_native_1.View>
                  </react_native_1.View>

                  {saveError ? <react_native_1.Text style={styles.errorText}>{saveError}</react_native_1.Text> : null}
                  {saveSuccess ? <react_native_1.Text style={styles.successText}>{saveSuccess}</react_native_1.Text> : null}

                  <react_native_1.Pressable style={[styles.saveButton, (!stats || Boolean(savingMode)) && { opacity: 0.7 }]} disabled={!stats || Boolean(savingMode)} onPress={function () { return void save('draft'); }}>
                    {savingMode === 'draft' ? (<react_native_1.ActivityIndicator color="#fff"/>) : (<>
                        <vector_icons_1.Ionicons name="document-text-outline" size={18} color="#fff"/>
                        <react_native_1.Text style={styles.saveButtonText}>Save draft</react_native_1.Text>
                      </>)}
                  </react_native_1.Pressable>
                  <react_native_1.Pressable style={[styles.publishButton, (!stats || Boolean(savingMode)) && { opacity: 0.7 }]} disabled={!stats || Boolean(savingMode)} onPress={function () { return void save('published'); }}>
                    {savingMode === 'published' ? (<react_native_1.ActivityIndicator color="#fff"/>) : (<>
                        <vector_icons_1.Ionicons name="cloud-upload-outline" size={18} color="#fff"/>
                        <react_native_1.Text style={styles.saveButtonText}>Publish</react_native_1.Text>
                      </>)}
                  </react_native_1.Pressable>
                </>) : (<react_native_1.Text style={styles.hint}>
                  {isRecordingTrail
                        ? 'Keep this screen open while you walk. The trail line updates from GPS points, then you can finish and save it as a draft or publish it.'
                        : 'Tap once to place the start, add as many middle waypoints as you need, switch to end mode, then tap the ending point. Turn on loop to close the route back to the start.'}
                </react_native_1.Text>)}
              </react_native_1.ScrollView>) : null}
          </react_native_1.View>
        </react_native_1.View>)}
    </react_native_1.View>);
}
var styles = react_native_1.StyleSheet.create({
    root: { flex: 1, backgroundColor: '#EAE2CC' },
    map: __assign({}, react_native_1.StyleSheet.absoluteFillObject),
    mapControls: {
        position: 'absolute',
        right: 12,
        flexDirection: 'column',
        gap: 8,
    },
    controlButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.10)',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 12,
        elevation: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    controlButtonActive: {
        backgroundColor: '#1D9E75',
        borderColor: 'rgba(29,158,117,0.3)',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 12,
        paddingBottom: 10,
        gap: 10,
    },
    brandPill: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.10)',
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 18,
        elevation: 8,
    },
    brandDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1D9E75' },
    brandText: { color: '#2C2418', fontWeight: '900', fontSize: 14 },
    topActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    iconButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.12)',
    },
    primaryIconButton: {
        backgroundColor: '#0F5A38',
        borderColor: 'rgba(15,90,56,0.35)',
    },
    recordIconButton: {
        backgroundColor: '#630E13',
        borderColor: 'rgba(99,14,19,0.32)',
    },
    dangerIconButton: {
        backgroundColor: 'rgba(255,255,255,0.94)',
        borderColor: 'rgba(187,40,35,0.22)',
    },
    loopIconButton: {
        backgroundColor: '#630E13',
        borderColor: 'rgba(99,14,19,0.28)',
    },
    iconButtonDisabled: {
        opacity: 0.65,
    },
    iconText: { fontSize: 12, fontWeight: '800', color: '#2C2418' },
    iconTextDisabled: { color: '#B0A090' },
    primaryIconText: { fontSize: 12, fontWeight: '900', color: '#fff' },
    loopText: { color: '#fff' },
    dangerText: { color: '#BB2823' },
    bottomPanelWrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 12,
    },
    bottomPanel: {
        backgroundColor: 'rgba(255,255,255,0.96)',
        borderRadius: 18,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.10)',
        shadowColor: '#000',
        shadowOpacity: 0.14,
        shadowOffset: { width: 0, height: -8 },
        shadowRadius: 22,
        elevation: 14,
    },
    bottomPanelScrollContent: {
        paddingTop: 4,
        paddingBottom: 4,
    },
    bottomPanelCollapsed: {
        paddingTop: 10,
        paddingBottom: 10,
    },
    panelHeaderButton: {
        gap: 8,
    },
    panelHandle: {
        alignSelf: 'center',
        width: 44,
        height: 4,
        borderRadius: 999,
        backgroundColor: 'rgba(44,36,24,0.18)',
    },
    panelHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    panelTitle: { fontSize: 14, fontWeight: '900', color: '#2C2418' },
    panelSubtitle: { marginTop: 3, fontSize: 11, color: '#8A7A6A', fontWeight: '700' },
    collapseButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F7F3E7',
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    drawingActionsRow: { marginBottom: 10 },
    secondaryActionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 11,
        borderRadius: 14,
        backgroundColor: '#F7F3E7',
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.08)',
    },
    secondaryActionButtonDisabled: {
        opacity: 0.65,
    },
    secondaryActionText: {
        color: '#2C2418',
        fontWeight: '800',
        fontSize: 13,
    },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8, marginBottom: 10 },
    statCard: {
        flexGrow: 1,
        minWidth: 88,
        backgroundColor: '#F7F3E7',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.06)',
    },
    statValue: { fontSize: 16, fontWeight: '900', color: '#2C2418' },
    statLabel: { marginTop: 2, fontSize: 11, fontWeight: '800', color: '#8A7A6A' },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.06)',
    },
    badgeDot: { width: 10, height: 10, borderRadius: 5 },
    badgeText: { fontSize: 12, fontWeight: '900' },
    formRow: { marginTop: 10 },
    inputLabel: { fontSize: 12, fontWeight: '900', color: '#2C2418', marginBottom: 6 },
    input: {
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.12)',
        color: '#2C2418',
        fontSize: 14,
        fontWeight: '600',
    },
    inputDisabled: {
        backgroundColor: '#F5F2EA',
        color: '#8A7A6A',
    },
    textarea: { minHeight: 86, textAlignVertical: 'top' },
    featureInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    featureInput: {
        flex: 1,
        minWidth: 0,
    },
    featureAddButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#0F5A38',
        justifyContent: 'center',
        alignItems: 'center',
    },
    featureAddButtonDisabled: {
        opacity: 0.45,
    },
    featuresContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    featureChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        maxWidth: '100%',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F7F3E7',
        borderWidth: 1,
        borderColor: 'rgba(44,36,24,0.12)',
    },
    photoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
    photoPreview: {
        width: 100,
        height: 100,
        borderRadius: 16,
        backgroundColor: '#EFF7F1',
        borderWidth: 1,
        borderColor: 'rgba(15,90,56,0.18)',
    },
    photoPlaceholder: {
        width: 100,
        height: 100,
        borderRadius: 16,
        backgroundColor: '#F1FAF4',
        borderWidth: 1,
        borderColor: 'rgba(15,90,56,0.18)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 10,
    },
    photoPlaceholderText: {
        fontSize: 12,
        color: '#8A7A6A',
        textAlign: 'center',
    },
    photoActions: { flex: 1, justifyContent: 'center', gap: 10 },
    photoButton: {
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: '#0F5A38',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 120,
    },
    photoButtonText: {
        color: '#fff',
        fontWeight: '900',
        fontSize: 12,
    },
    photoRemoveButton: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: 'rgba(15,90,56,0.18)',
    },
    photoRemoveButtonText: {
        color: '#0F5A38',
    },
    featureChipSelected: {
        backgroundColor: '#0F5A38',
        borderColor: 'rgba(15,90,56,0.3)',
    },
    featureChipText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#2C2418',
    },
    featureChipTextSelected: {
        color: '#fff',
    },
    emptyFeaturesBox: {
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: '#F7F0E8',
        borderWidth: 1,
        borderColor: '#E2D4C2',
    },
    emptyFeaturesText: {
        color: '#7E6F5F',
        fontSize: 13,
        lineHeight: 18,
    },
    saveButton: {
        marginTop: 12,
        backgroundColor: '#630E13',
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    publishButton: {
        marginTop: 10,
        backgroundColor: '#0F5A38',
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    saveButtonText: { color: '#fff', fontWeight: '900', fontSize: 14 },
    hint: { marginTop: 10, fontSize: 10, color: '#8A7A6A', fontWeight: '700' },
    errorText: { marginTop: 8, fontSize: 11, color: '#BB2823', fontWeight: '800' },
    successText: { marginTop: 8, fontSize: 11, color: '#1D9E75', fontWeight: '900' },
});
