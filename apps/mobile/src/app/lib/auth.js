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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.signup = signup;
exports.login = login;
exports.refresh = refresh;
exports.logout = logout;
exports.me = me;
exports.getApiBaseUrl = getApiBaseUrl;
exports.persistSession = persistSession;
exports.getStoredSession = getStoredSession;
exports.clearStoredSession = clearStoredSession;
exports.getAccessToken = getAccessToken;
// Updated to share API base URL logic and store auth sessions securely for automatic mobile API authentication.
var expo_constants_1 = require("expo-constants");
var react_native_1 = require("react-native");
var SecureStore = require("expo-secure-store");
var DEFAULT_API_URL = react_native_1.Platform.select({
    android: 'http://10.0.2.2:3001',
    default: 'http://localhost:3001',
});
var DEFAULT_API_PORT = '3001';
function getExpoExtraApiUrl() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var candidates = [
        {
            source: 'expoConfig.extra.apiUrl',
            value: (_b = (_a = expo_constants_1.default.expoConfig) === null || _a === void 0 ? void 0 : _a.extra) === null || _b === void 0 ? void 0 : _b.apiUrl,
        },
        {
            source: 'manifest.extra.apiUrl',
            value: (_d = (_c = expo_constants_1.default.manifest) === null || _c === void 0 ? void 0 : _c.extra) === null || _d === void 0 ? void 0 : _d.apiUrl,
        },
        {
            source: 'manifest2.extra.apiUrl',
            value: (_f = (_e = expo_constants_1.default.manifest2) === null || _e === void 0 ? void 0 : _e.extra) === null || _f === void 0 ? void 0 : _f.apiUrl,
        },
        {
            source: 'manifest2.extra.expoClient.extra.apiUrl',
            value: (_k = (_j = (_h = (_g = expo_constants_1.default.manifest2) === null || _g === void 0 ? void 0 : _g.extra) === null || _h === void 0 ? void 0 : _h.expoClient) === null || _j === void 0 ? void 0 : _j.extra) === null || _k === void 0 ? void 0 : _k.apiUrl,
        },
        {
            source: 'process.env.EXPO_PUBLIC_API_URL',
            value: process.env.EXPO_PUBLIC_API_URL,
        },
    ];
    var resolved = candidates.find(function (candidate) { return typeof candidate.value === 'string' && candidate.value.trim().length > 0; });
    if (__DEV__) {
        console.log('[auth] API URL candidates:', candidates.map(function (candidate) { return ({
            source: candidate.source,
            value: typeof candidate.value === 'string' ? candidate.value : null,
        }); }));
    }
    return typeof (resolved === null || resolved === void 0 ? void 0 : resolved.value) === 'string' ? resolved.value.trim() : '';
}
function getExpoExtraApiPort() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    var candidates = [
        (_b = (_a = expo_constants_1.default.expoConfig) === null || _a === void 0 ? void 0 : _a.extra) === null || _b === void 0 ? void 0 : _b.apiPort,
        (_d = (_c = expo_constants_1.default.manifest) === null || _c === void 0 ? void 0 : _c.extra) === null || _d === void 0 ? void 0 : _d.apiPort,
        (_f = (_e = expo_constants_1.default.manifest2) === null || _e === void 0 ? void 0 : _e.extra) === null || _f === void 0 ? void 0 : _f.apiPort,
        (_k = (_j = (_h = (_g = expo_constants_1.default.manifest2) === null || _g === void 0 ? void 0 : _g.extra) === null || _h === void 0 ? void 0 : _h.expoClient) === null || _j === void 0 ? void 0 : _j.extra) === null || _k === void 0 ? void 0 : _k.apiPort,
        process.env.EXPO_PUBLIC_API_PORT,
    ];
    var resolved = candidates.find(function (candidate) { return typeof candidate === 'string' && candidate.trim().length > 0; });
    return typeof resolved === 'string' ? resolved.trim() : DEFAULT_API_PORT;
}
function getHostFromUrl(value) {
    if (!value) {
        return '';
    }
    try {
        return new URL(value).hostname;
    }
    catch (_a) {
        return '';
    }
}
function getExpoDevHost() {
    var _a, _b, _c, _d, _e, _f;
    var candidates = [
        (_a = expo_constants_1.default.expoConfig) === null || _a === void 0 ? void 0 : _a.hostUri,
        (_b = expo_constants_1.default.expoGoConfig) === null || _b === void 0 ? void 0 : _b.debuggerHost,
        (_c = expo_constants_1.default.expoGoConfig) === null || _c === void 0 ? void 0 : _c.hostUri,
        expo_constants_1.default.linkingUri,
        (_d = expo_constants_1.default.manifest) === null || _d === void 0 ? void 0 : _d.debuggerHost,
        (_e = expo_constants_1.default.manifest) === null || _e === void 0 ? void 0 : _e.hostUri,
    ];
    for (var _i = 0, candidates_1 = candidates; _i < candidates_1.length; _i++) {
        var candidate = candidates_1[_i];
        if (typeof candidate !== 'string' || candidate.trim().length === 0) {
            continue;
        }
        var directHost = getHostFromUrl(candidate);
        if (directHost) {
            return directHost;
        }
        var hostWithPort = candidate.replace(/^[^:]+:\/\//, '').split('/')[0];
        var host = (_f = hostWithPort.split(':')[0]) === null || _f === void 0 ? void 0 : _f.trim();
        if (host) {
            return host;
        }
    }
    return '';
}
function getAutoDetectedApiUrl() {
    var host = getExpoDevHost();
    if (!host) {
        return '';
    }
    var protocol = host === 'localhost' || host === '127.0.0.1' ? 'http' : 'http';
    return "".concat(protocol, "://").concat(host, ":").concat(getExpoExtraApiPort());
}
var EXPLICIT_API_URL = getExpoExtraApiUrl() || ((_a = process.env.EXPO_PUBLIC_API_URL) === null || _a === void 0 ? void 0 : _a.trim());
var AUTO_DETECTED_API_URL = getAutoDetectedApiUrl();
var API_BASE_URL = (EXPLICIT_API_URL || AUTO_DETECTED_API_URL || DEFAULT_API_URL || 'http://localhost:3001').replace(/\/$/, '');
var IS_USING_FALLBACK_API_URL = !EXPLICIT_API_URL;
var AUTH_SESSION_KEY = 'traces.auth.session';
var activeSession = null;
if (__DEV__ && IS_USING_FALLBACK_API_URL) {
    console.warn("[auth] EXPO_PUBLIC_API_URL is not set. Using ".concat(API_BASE_URL, ". ") +
        'This is auto-detected from the Expo dev host when available.');
}
if (__DEV__) {
    console.log("[auth] API base URL: ".concat(API_BASE_URL));
}
function getErrorMessage(payload) {
    var _a, _b, _c;
    if ((payload === null || payload === void 0 ? void 0 : payload.error) && payload.error !== 'Validation failed') {
        return payload.error;
    }
    var formError = (_b = (_a = payload === null || payload === void 0 ? void 0 : payload.details) === null || _a === void 0 ? void 0 : _a.formErrors) === null || _b === void 0 ? void 0 : _b.find(Boolean);
    if (formError) {
        return formError;
    }
    var fieldError = ((_c = payload === null || payload === void 0 ? void 0 : payload.details) === null || _c === void 0 ? void 0 : _c.fieldErrors)
        ? Object.values(payload.details.fieldErrors).flat().find(Boolean)
        : null;
    if (fieldError) {
        return fieldError;
    }
    if (payload === null || payload === void 0 ? void 0 : payload.error) {
        return payload.error;
    }
    return 'Authentication request failed.';
}
function request(path, init) {
    return __awaiter(this, void 0, void 0, function () {
        var response, error_1, hint, payload;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, fetch("".concat(getApiBaseUrl()).concat(path), __assign(__assign({}, init), { headers: __assign({ 'Content-Type': 'application/json' }, ((_a = init.headers) !== null && _a !== void 0 ? _a : {})) }))];
                case 1:
                    response = _b.sent();
                    return [3 /*break*/, 3];
                case 2:
                    error_1 = _b.sent();
                    if (error_1 instanceof TypeError) {
                        hint = IS_USING_FALLBACK_API_URL
                            ? "If auto-detection misses, set EXPO_PUBLIC_API_URL manually, for example http://192.168.1.X:".concat(getExpoExtraApiPort(), ".")
                            : 'Check that the API is running and reachable from this device.';
                        throw new Error("Couldn't reach ".concat(getApiBaseUrl(), ". ").concat(hint));
                    }
                    throw error_1;
                case 3: return [4 /*yield*/, response.json().catch(function () { return null; })];
                case 4:
                    payload = (_b.sent());
                    if (!response.ok) {
                        throw new Error(getErrorMessage(payload));
                    }
                    return [2 /*return*/, payload];
            }
        });
    });
}
function signup(payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, request('/api/auth/signup', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })];
        });
    });
}
function login(payload) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, request('/api/auth/login', {
                    method: 'POST',
                    body: JSON.stringify(payload),
                })];
        });
    });
}
function refresh(refreshToken) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, request('/api/auth/refresh', {
                    method: 'POST',
                    body: JSON.stringify({ refreshToken: refreshToken }),
                })];
        });
    });
}
function logout() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, request('/api/auth/logout', {
                        method: 'POST',
                    })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function me() {
    return __awaiter(this, void 0, void 0, function () {
        var token;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, getAccessToken()];
                case 1:
                    token = _a.sent();
                    return [2 /*return*/, request('/api/auth/me', {
                            method: 'GET',
                            headers: token ? { Authorization: "Bearer ".concat(token) } : undefined,
                        })];
            }
        });
    });
}
function getApiBaseUrl() {
    return API_BASE_URL;
}
function persistSession(session) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    activeSession = session;
                    if (!!session) return [3 /*break*/, 2];
                    return [4 /*yield*/, SecureStore.deleteItemAsync(AUTH_SESSION_KEY)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
                case 2: return [4 /*yield*/, SecureStore.setItemAsync(AUTH_SESSION_KEY, JSON.stringify(session))];
                case 3:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getStoredSession() {
    return __awaiter(this, void 0, void 0, function () {
        var rawValue, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, SecureStore.getItemAsync(AUTH_SESSION_KEY)];
                case 1:
                    rawValue = _b.sent();
                    if (!rawValue) {
                        activeSession = null;
                        return [2 /*return*/, null];
                    }
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 3, , 5]);
                    activeSession = JSON.parse(rawValue);
                    return [2 /*return*/, activeSession];
                case 3:
                    _a = _b.sent();
                    activeSession = null;
                    return [4 /*yield*/, SecureStore.deleteItemAsync(AUTH_SESSION_KEY)];
                case 4:
                    _b.sent();
                    return [2 /*return*/, null];
                case 5: return [2 /*return*/];
            }
        });
    });
}
function clearStoredSession() {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    activeSession = null;
                    return [4 /*yield*/, SecureStore.deleteItemAsync(AUTH_SESSION_KEY)];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    });
}
function getAccessToken() {
    return __awaiter(this, void 0, void 0, function () {
        var session, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!(activeSession !== null && activeSession !== void 0)) return [3 /*break*/, 1];
                    _a = activeSession;
                    return [3 /*break*/, 3];
                case 1: return [4 /*yield*/, getStoredSession()];
                case 2:
                    _a = _c.sent();
                    _c.label = 3;
                case 3:
                    session = _a;
                    return [2 /*return*/, (_b = session === null || session === void 0 ? void 0 : session.token) !== null && _b !== void 0 ? _b : null];
            }
        });
    });
}
