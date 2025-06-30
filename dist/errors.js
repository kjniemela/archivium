"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.ForbiddenError = exports.PremiumOnlyError = exports.UnauthorizedError = exports.ValidationError = exports.ModelError = exports.RequestError = void 0;
const axios_1 = require("axios");
class RequestError extends Error {
    CODE = axios_1.HttpStatusCode.InternalServerError;
    constructor(msg, code) {
        super(msg);
        if (code) {
            this.CODE = code;
        }
    }
}
exports.RequestError = RequestError;
class ModelError extends RequestError {
    constructor(msg) {
        super(msg);
    }
}
exports.ModelError = ModelError;
class ValidationError extends ModelError {
    CODE = axios_1.HttpStatusCode.BadRequest;
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends ModelError {
    CODE = axios_1.HttpStatusCode.Unauthorized;
}
exports.UnauthorizedError = UnauthorizedError;
class PremiumOnlyError extends ModelError {
    CODE = axios_1.HttpStatusCode.PaymentRequired;
}
exports.PremiumOnlyError = PremiumOnlyError;
class ForbiddenError extends ModelError {
    CODE = axios_1.HttpStatusCode.Forbidden;
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ModelError {
    CODE = axios_1.HttpStatusCode.NotFound;
}
exports.NotFoundError = NotFoundError;
