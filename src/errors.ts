import { HttpStatusCode } from "axios";

export class RequestError extends Error {
  readonly CODE: number = HttpStatusCode.InternalServerError;

  constructor(msg?: string, code?: number) {
    super(msg);
    if (code) {
      this.CODE = code;
    }
  }
}

export class ModelError extends RequestError {
  constructor(msg?: string) {
    super(msg);
  }
}

export class ValidationError extends ModelError {
  readonly CODE: number = HttpStatusCode.BadRequest;
}

export class UnauthorizedError extends ModelError {
  readonly CODE: number = HttpStatusCode.Unauthorized;
}

export class PremiumOnlyError extends ModelError {
  readonly CODE: number = HttpStatusCode.PaymentRequired;
}

export class ForbiddenError extends ModelError {
  readonly CODE: number = HttpStatusCode.Forbidden;
}

export class NotFoundError extends ModelError {
  readonly CODE: number = HttpStatusCode.NotFound;
}


