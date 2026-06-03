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
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTrail = normalizeTrail;
exports.createTrail = createTrail;
exports.checkDuplicateTrail = checkDuplicateTrail;
exports.uploadTrailPhoto = uploadTrailPhoto;
exports.pingTrails = pingTrails;
exports.getTrails = getTrails;
exports.getTrailById = getTrailById;
exports.getTrailElevationProfile = getTrailElevationProfile;
exports.updateTrail = updateTrail;
exports.deleteTrail = deleteTrail;
exports.publishTrail = publishTrail;
exports.getTrailStats = getTrailStats;
exports.analyzeTrailRoute = analyzeTrailRoute;
exports.searchTrails = searchTrails;
exports.searchOrGenerateTrail = searchOrGenerateTrail;
exports.getNearbyTrails = getNearbyTrails;
exports.addTrailReview = addTrailReview;
exports.recalculateTrailReviewStats = recalculateTrailReviewStats;
exports.getTrailReviews = getTrailReviews;
exports.deleteTrailReview = deleteTrailReview;
exports.addTrailCondition = addTrailCondition;
exports.getTrailConditions = getTrailConditions;
exports.saveBookmark = saveBookmark;
exports.removeBookmark = removeBookmark;
exports.getBookmarks = getBookmarks;
exports.getSavedTrails = getSavedTrails;
exports.getBookmarkStatus = getBookmarkStatus;
// Updated to centralize typed frontend access for trail, review, condition, bookmark, and nearby APIs with mobile-friendly normalization.
var client_1 = require("./client");
function createClientRequestId() {
    return "".concat(Date.now(), "-").concat(Math.random().toString(36).slice(2));
}
function normalizeDifficulty(value) {
    switch ((value !== null && value !== void 0 ? value : '').toLowerCase()) {
        case 'moderate':
            return 'Moderate';
        case 'hard':
            return 'Hard';
        case 'expert':
            return 'Expert';
        default:
            return 'Easy';
    }
}
var WEST_BANK_LNG_MIN = 34;
var WEST_BANK_LNG_MAX = 36.8;
var WEST_BANK_LAT_MIN = 29;
var WEST_BANK_LAT_MAX = 33.8;
function isLikelyWestBankLngLat(point) {
    var lng = point[0], lat = point[1];
    return lng >= WEST_BANK_LNG_MIN && lng <= WEST_BANK_LNG_MAX && lat >= WEST_BANK_LAT_MIN && lat <= WEST_BANK_LAT_MAX;
}
function isLikelyWestBankLatLng(point) {
    var lat = point[0], lng = point[1];
    return lat >= WEST_BANK_LAT_MIN && lat <= WEST_BANK_LAT_MAX && lng >= WEST_BANK_LNG_MIN && lng <= WEST_BANK_LNG_MAX;
}
function normalizeRoutePoint(point) {
    if (isLikelyWestBankLatLng(point) && !isLikelyWestBankLngLat(point)) {
        return [point[1], point[0]];
    }
    return point;
}
function normalizeRouteCoordinates(routeCoordinates) {
    if (!Array.isArray(routeCoordinates)) {
        return undefined;
    }
    return routeCoordinates.map(normalizeRoutePoint);
}
function toApiDifficulty(value) {
    return value.toLowerCase();
}
function normalizeTrail(trail) {
    var _a;
    return __assign(__assign({}, trail), { difficulty: normalizeDifficulty(trail.difficulty), images: Array.isArray(trail.images) ? trail.images : [], features: Array.isArray(trail.features) ? trail.features : [], featuresAr: Array.isArray(trail.featuresAr) ? trail.featuresAr : [], tags: Array.isArray(trail.tags) ? trail.tags : [], image: trail.image || ((_a = trail.images) === null || _a === void 0 ? void 0 : _a[0]) || 'https://images.unsplash.com/photo-1511497584788-876760111969?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&w=800', checkpointNote: trail.checkpointNote || undefined, routeCoordinates: normalizeRouteCoordinates(trail.routeCoordinates), status: typeof trail.status === 'string' ? trail.status : undefined, isPublic: typeof trail.isPublic === 'boolean' ? trail.isPublic : typeof trail.is_public === 'boolean' ? trail.is_public : undefined, publishedAt: typeof trail.publishedAt === 'string' ? trail.publishedAt : typeof trail.published_at === 'string' ? trail.published_at : null, userId: typeof trail.userId === 'string' ? trail.userId : typeof trail.user_id === 'string' ? trail.user_id : null });
}
function createTrail(payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)('/api/trails', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })];
        });
    });
}
function checkDuplicateTrail(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/check-duplicate', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, response), { matches: Array.isArray(response.matches) ? response.matches : [] })];
            }
        });
    });
}
function uploadTrailPhoto(trailId, uri) {
    return __awaiter(this, void 0, void 0, function () {
        var filename, match, type, formData;
        var _a;
        return __generator(this, function (_b) {
            filename = (_a = uri.split('/').pop()) !== null && _a !== void 0 ? _a : "trail-".concat(Date.now(), ".jpg");
            match = filename.match(/\.([a-zA-Z0-9]+)$/);
            type = match ? "image/".concat(match[1].toLowerCase()) : 'image/jpeg';
            formData = new FormData();
            formData.append('photo', {
                uri: uri,
                name: filename,
                type: type,
            });
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(trailId, "/photos"), {
                    method: 'POST',
                    body: formData,
                })];
        });
    });
}
function pingTrails() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)('/api/trails/ping')];
        });
    });
}
function getTrails(page, limit) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails', {}, { page: page, limit: limit })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data.map(normalizeTrail)];
            }
        });
    });
}
function getTrailById(id) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)("/api/trails/".concat(id))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, normalizeTrail(response.data)];
            }
        });
    });
}
function getTrailElevationProfile(id_1) {
    return __awaiter(this, arguments, void 0, function (id, params) {
        var response;
        if (params === void 0) { params = {}; }
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/elevation-profile"), {}, params)];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
function updateTrail(id, payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(id), {
                    method: 'PATCH',
                    body: JSON.stringify(payload),
                })];
        });
    });
}
function deleteTrail(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(id), { method: 'DELETE' })];
        });
    });
}
function publishTrail(id) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/publish"), {
                    method: 'PATCH',
                })];
        });
    });
}
function getTrailStats(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/calculate', {
                        method: 'POST',
                        body: JSON.stringify(payload),
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
function analyzeTrailRoute(payload) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/analyze-route', {
                        method: 'POST',
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-store',
                        },
                        body: JSON.stringify(payload),
                    }, { _request_id: createClientRequestId() })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, __assign(__assign({}, response.data), { ai_labels: Array.isArray(response.data.ai_labels) ? response.data.ai_labels : [] })];
            }
        });
    });
}
function searchTrails(params) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/search', {}, {
                        q: params.q,
                        difficulty: params.difficulty && params.difficulty !== 'all' ? toApiDifficulty(params.difficulty) : undefined,
                        minLength: params.minLength,
                        maxLength: params.maxLength,
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data.map(normalizeTrail)];
            }
        });
    });
}
function searchOrGenerateTrail(description) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/search-or-generate', {
                        method: 'POST',
                        cache: 'no-store',
                        headers: {
                            'Cache-Control': 'no-store',
                        },
                        body: JSON.stringify({ description: description.trim() }),
                    }, { _request_id: createClientRequestId() })];
                case 1:
                    response = _b.sent();
                    return [2 /*return*/, __assign(__assign({}, response.data), { existing_trails: Array.isArray(response.data.existing_trails) ? response.data.existing_trails : [], generated_trail: response.data.generated_trail
                                ? __assign(__assign({}, response.data.generated_trail), { coordinates: (_a = normalizeRouteCoordinates(response.data.generated_trail.coordinates)) !== null && _a !== void 0 ? _a : [], labels: Array.isArray(response.data.generated_trail.labels) ? response.data.generated_trail.labels : [] }) : null })];
            }
        });
    });
}
function getNearbyTrails(params) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/nearby', {}, params)];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data.map(normalizeTrail)];
            }
        });
    });
}
function addTrailReview(id, payload) {
    return __awaiter(this, void 0, void 0, function () {
        var formData_1;
        var _a;
        return __generator(this, function (_b) {
            if ((_a = payload.photos) === null || _a === void 0 ? void 0 : _a.length) {
                formData_1 = new FormData();
                formData_1.append('rating', String(payload.rating));
                formData_1.append('content', payload.content);
                if (payload.title) {
                    formData_1.append('title', payload.title);
                }
                payload.photos.forEach(function (photo) {
                    formData_1.append('photos', photo);
                });
                return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/reviews"), {
                        method: 'POST',
                        body: formData_1,
                    })];
            }
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/reviews"), {
                    method: 'POST',
                    body: JSON.stringify(__assign({ rating: payload.rating, content: payload.content }, (payload.title ? { title: payload.title } : {}))),
                })];
        });
    });
}
function recalculateTrailReviewStats(id) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/reviews/recalculate"), {
                        method: 'POST',
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
function getTrailReviews(id) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/reviews"))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
function deleteTrailReview(reviewId) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/reviews/".concat(reviewId), { method: 'DELETE' })];
        });
    });
}
function addTrailCondition(id, payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/conditions"), {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })];
        });
    });
}
function getTrailConditions(id) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)("/api/trails/".concat(id, "/conditions"))];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, response.data];
            }
        });
    });
}
function saveBookmark(payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(payload.trailId, "/save"), {
                    method: 'POST',
                    body: JSON.stringify({ list_type: payload.type, notes: payload.notes }),
                })];
        });
    });
}
function removeBookmark(payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(payload.trailId, "/save"), {
                    method: 'DELETE',
                    body: JSON.stringify({ list_type: payload.type }),
                })];
        });
    });
}
function getBookmarks(params) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/saved', {}, {
                        list_type: params.type,
                        page: params.page,
                        limit: params.limit,
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, {
                            items: response.data.map(function (item) { return ({
                                saved_id: item.saved_id,
                                trailId: item.id,
                                type: params.type,
                                notes: item.notes,
                                savedAt: item.saved_at,
                            }); }),
                            pagination: response.pagination,
                        }];
            }
        });
    });
}
function getSavedTrails(params) {
    return __awaiter(this, void 0, void 0, function () {
        var response;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, (0, client_1.apiRequest)('/api/trails/saved', {}, {
                        list_type: params.type,
                        page: params.page,
                        limit: params.limit,
                    })];
                case 1:
                    response = _a.sent();
                    return [2 /*return*/, {
                            items: response.data.map(function (item) { return ({
                                trail: normalizeTrail(item),
                                savedAt: item.saved_at,
                                notes: item.notes,
                                savedId: item.saved_id,
                                type: params.type,
                            }); }),
                            pagination: response.pagination,
                        }];
            }
        });
    });
}
function getBookmarkStatus(trailId, type) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, (0, client_1.apiRequest)("/api/trails/".concat(trailId, "/saved-status"), {}, { list_type: type })];
        });
    });
}
