"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
exports.ApiError = void 0;
exports.apiRequest = apiRequest;
exports.apiTextRequest = apiTextRequest;
// Updated to provide a shared mobile API client that uses the env base URL and automatically attaches the stored auth token.
var auth_1 = require("../lib/auth");
var ApiError = /** @class */ (function (_super) {
    __extends(ApiError, _super);
    function ApiError(message, status) {
        var _this = _super.call(this, message) || this;
        _this.name = 'ApiError';
        _this.status = status;
        return _this;
    }
    return ApiError;
}(Error));
exports.ApiError = ApiError;
function buildUrl(path, query) {
    var url = new URL("".concat((0, auth_1.getApiBaseUrl)()).concat(path));
    if (query) {
        Object.entries(query).forEach(function (_a) {
            var key = _a[0], value = _a[1];
            if (value == null || value === '') {
                return;
            }
            url.searchParams.set(key, String(value));
        });
    }
    return url.toString();
}
function getErrorMessage(payload, fallback) {
    var _a;
    if (typeof (payload === null || payload === void 0 ? void 0 : payload.details) === 'string' && payload.details) {
        return payload.details;
    }
    if ((payload === null || payload === void 0 ? void 0 : payload.error) && payload.error !== 'Validation failed') {
        return payload.error;
    }
    var formError = (payload === null || payload === void 0 ? void 0 : payload.details) && typeof payload.details !== 'string'
        ? (_a = payload.details.formErrors) === null || _a === void 0 ? void 0 : _a.find(Boolean)
        : null;
    if (formError) {
        return formError;
    }
    var fieldError = (payload === null || payload === void 0 ? void 0 : payload.details) && typeof payload.details !== 'string' && payload.details.fieldErrors
        ? Object.values(payload.details.fieldErrors).flat().find(Boolean)
        : null;
    if (fieldError) {
        return fieldError;
    }
    if (payload === null || payload === void 0 ? void 0 : payload.error) {
        return payload.error;
    }
    return fallback;
}
function apiRequest(path_1) {
    return __awaiter(this, arguments, void 0, function (path, init, query) {
        var token, headers, hasBody, isFormDataBody, response, payload;
        var _a;
        if (init === void 0) { init = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, auth_1.getAccessToken)()];
                case 1:
                    token = _b.sent();
                    headers = new Headers((_a = init.headers) !== null && _a !== void 0 ? _a : {});
                    hasBody = init.body != null;
                    isFormDataBody = typeof FormData !== 'undefined' && init.body instanceof FormData;
                    if (hasBody && !isFormDataBody && !headers.has('Content-Type')) {
                        headers.set('Content-Type', 'application/json');
                    }
                    if (token && !headers.has('Authorization')) {
                        headers.set('Authorization', "Bearer ".concat(token));
                    }
                    return [4 /*yield*/, fetch(buildUrl(path, query), __assign(__assign({}, init), { headers: headers }))];
                case 2:
                    response = _b.sent();
                    return [4 /*yield*/, response.json().catch(function () { return null; })];
                case 3:
                    payload = (_b.sent());
                    if (!response.ok) {
                        throw new ApiError(getErrorMessage(payload, 'Request failed.'), response.status);
                    }
                    return [2 /*return*/, payload];
            }
        });
    });
}
function apiTextRequest(path_1) {
    return __awaiter(this, arguments, void 0, function (path, init, query) {
        var token, headers, response, body, payload;
        var _a;
        if (init === void 0) { init = {}; }
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0: return [4 /*yield*/, (0, auth_1.getAccessToken)()];
                case 1:
                    token = _b.sent();
                    headers = new Headers((_a = init.headers) !== null && _a !== void 0 ? _a : {});
                    if (token && !headers.has('Authorization')) {
                        headers.set('Authorization', "Bearer ".concat(token));
                    }
                    return [4 /*yield*/, fetch(buildUrl(path, query), __assign(__assign({}, init), { headers: headers }))];
                case 2:
                    response = _b.sent();
                    return [4 /*yield*/, response.text()];
                case 3:
                    body = _b.sent();
                    if (!response.ok) {
                        payload = null;
                        try {
                            payload = JSON.parse(body);
                        }
                        catch (_c) {
                            payload = body ? { error: body } : null;
                        }
                        throw new ApiError(getErrorMessage(payload, 'Request failed.'), response.status);
                    }
                    return [2 /*return*/, body];
            }
        });
    });
}
