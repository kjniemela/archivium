import { HttpStatusCode } from 'axios';

export class AssertionError extends Error {}

export class RequestError extends Error {
  readonly code: number = HttpStatusCode.InternalServerError;
  readonly data: unknown;

  constructor(msgOrError?: string | Error, { cause, code, data }: { cause?: Error, code?: number, data?: unknown } = {}) {
    if (msgOrError instanceof Error) {
      cause = msgOrError;
      msgOrError = msgOrError.message;
    }

    super(msgOrError, { cause });

    if (code) {
      this.code = code;
    }
    if (data) {
      this.data = data;
    }

    this.name = this.constructor.name;
  }
}

export class ModelError extends RequestError {
  constructor(msgOrError?: string | Error, { cause, data }: { cause?: Error, data?: unknown } = {}) {
    super(msgOrError, { cause, data });
  }
}

export class RateLimitError extends ModelError {
  readonly code: number = HttpStatusCode.TooManyRequests;
  declare readonly data: Date;

  constructor(tryAgain?: Date) {
    super('Rate limit exceeded, try again at:', { data: tryAgain });
  }
}

export class ValidationError extends ModelError {
  readonly code: number = HttpStatusCode.BadRequest;
}

export class UnauthorizedError extends ModelError {
  readonly code: number = HttpStatusCode.Unauthorized;
}

export class PremiumOnlyError extends ModelError {
  readonly code: number = HttpStatusCode.PaymentRequired;
}

export class ForbiddenError extends ModelError {
  readonly code: number = HttpStatusCode.Forbidden;
}

export class NotFoundError extends ModelError {
  readonly code: number = HttpStatusCode.NotFound;
}

export class InsufficientStorageError extends ModelError {
  readonly code: number = HttpStatusCode.InsufficientStorage;
}
