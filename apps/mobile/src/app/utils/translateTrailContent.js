"use strict";
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
exports.translateTrailContentToArabic = translateTrailContentToArabic;
var ARABIC_TEXT_PATTERN = /[\u0600-\u06FF]/;
var TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single';
function hasArabicText(value) {
    return ARABIC_TEXT_PATTERN.test(value);
}
function translateTextToArabic(value) {
    return __awaiter(this, void 0, void 0, function () {
        var text, params, response, json, translated;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    text = value.trim();
                    if (!text || hasArabicText(text)) {
                        return [2 /*return*/, text];
                    }
                    params = new URLSearchParams({
                        client: 'gtx',
                        sl: 'auto',
                        tl: 'ar',
                        dt: 't',
                        q: text,
                    });
                    return [4 /*yield*/, fetch("".concat(TRANSLATE_URL, "?").concat(params.toString()))];
                case 1:
                    response = _a.sent();
                    if (!response.ok) {
                        throw new Error("Translation failed with status ".concat(response.status));
                    }
                    return [4 /*yield*/, response.json()];
                case 2:
                    json = (_a.sent());
                    translated = Array.isArray(json)
                        && Array.isArray(json[0])
                        ? json[0]
                            .map(function (part) { return Array.isArray(part) && typeof part[0] === 'string' ? part[0] : ''; })
                            .join('')
                            .trim()
                        : '';
                    return [2 /*return*/, translated || text];
            }
        });
    });
}
function translateOptionalText(value) {
    return __awaiter(this, void 0, void 0, function () {
        var text;
        return __generator(this, function (_a) {
            text = value === null || value === void 0 ? void 0 : value.trim();
            return [2 /*return*/, text ? translateTextToArabic(text) : undefined];
        });
    });
}
function translateTrailContentToArabic(input) {
    return __awaiter(this, void 0, void 0, function () {
        var _a, nameAr, descriptionAr, regionAr, featuresAr, error_1;
        var _b, _c, _d, _e;
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    _f.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Promise.all([
                            translateTextToArabic(input.name),
                            translateOptionalText(input.description),
                            translateOptionalText(input.region),
                            Promise.all(((_b = input.features) !== null && _b !== void 0 ? _b : []).map(translateTextToArabic)),
                        ])];
                case 1:
                    _a = _f.sent(), nameAr = _a[0], descriptionAr = _a[1], regionAr = _a[2], featuresAr = _a[3];
                    return [2 /*return*/, {
                            nameAr: nameAr,
                            descriptionAr: descriptionAr,
                            regionAr: regionAr,
                            featuresAr: featuresAr,
                        }];
                case 2:
                    error_1 = _f.sent();
                    console.warn('Trail Arabic translation failed:', error_1);
                    return [2 /*return*/, {
                            nameAr: input.name.trim(),
                            descriptionAr: ((_c = input.description) === null || _c === void 0 ? void 0 : _c.trim()) || undefined,
                            regionAr: ((_d = input.region) === null || _d === void 0 ? void 0 : _d.trim()) || undefined,
                            featuresAr: (_e = input.features) !== null && _e !== void 0 ? _e : [],
                        }];
                case 3: return [2 /*return*/];
            }
        });
    });
}
