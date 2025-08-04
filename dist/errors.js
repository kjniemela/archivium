"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotFoundError = exports.ForbiddenError = exports.PremiumOnlyError = exports.UnauthorizedError = exports.ValidationError = exports.RateLimitError = exports.ModelError = exports.RequestError = void 0;
const axios_1 = require("axios");
class RequestError extends Error {
    code = axios_1.HttpStatusCode.InternalServerError;
    data;
    constructor(msgOrError, { cause, code, data } = {}) {
        if (msgOrError instanceof Error) {
            super(msgOrError.message, { cause: msgOrError });
        }
        else {
            super(msgOrError);
        }
        if (code) {
            this.code = code;
        }
        if (data) {
            this.data = data;
        }
    }
}
exports.RequestError = RequestError;
class ModelError extends RequestError {
    constructor(msgOrError, { cause, data } = {}) {
        super(msgOrError, { cause, data });
    }
}
exports.ModelError = ModelError;
class RateLimitError extends ModelError {
    code = axios_1.HttpStatusCode.TooManyRequests;
    constructor(tryAgain) {
        super('Rate limit exceeded, try again at:', { data: tryAgain });
    }
}
exports.RateLimitError = RateLimitError;
class ValidationError extends ModelError {
    code = axios_1.HttpStatusCode.BadRequest;
}
exports.ValidationError = ValidationError;
class UnauthorizedError extends ModelError {
    code = axios_1.HttpStatusCode.Unauthorized;
}
exports.UnauthorizedError = UnauthorizedError;
class PremiumOnlyError extends ModelError {
    code = axios_1.HttpStatusCode.PaymentRequired;
}
exports.PremiumOnlyError = PremiumOnlyError;
class ForbiddenError extends ModelError {
    code = axios_1.HttpStatusCode.Forbidden;
}
exports.ForbiddenError = ForbiddenError;
class NotFoundError extends ModelError {
    code = axios_1.HttpStatusCode.NotFound;
}
exports.NotFoundError = NotFoundError;
