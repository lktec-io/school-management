import env from '../config/env.js';
import logger from '../utils/logger.js';

export class ApiError extends Error {
  constructor(statusCode, message, { code, details } = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code || defaultCodeFor(statusCode);
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details) {
    return new ApiError(400, message, { code: 'VALIDATION_ERROR', details });
  }

  static unauthorized(message = 'Authentication required') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'You do not have permission to perform this action') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Resource not found') {
    return new ApiError(404, message);
  }

  static conflict(message, details) {
    return new ApiError(409, message, { details });
  }
}

function defaultCodeFor(statusCode) {
  const codes = {
    400: 'BAD_REQUEST',
    401: 'UNAUTHORIZED',
    403: 'FORBIDDEN',
    404: 'NOT_FOUND',
    409: 'CONFLICT',
    413: 'PAYLOAD_TOO_LARGE',
    423: 'LOCKED',
    429: 'TOO_MANY_REQUESTS',
  };
  return codes[statusCode] || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'ERROR');
}

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

/** Translate low-level library errors into safe, meaningful API errors. */
function normalizeError(error) {
  if (error instanceof ApiError) return error;

  if (error.type === 'entity.parse.failed') {
    return new ApiError(400, 'Malformed JSON in request body', { code: 'INVALID_JSON' });
  }
  if (error.type === 'entity.too.large') {
    return new ApiError(413, 'Request body is too large');
  }

  switch (error.code) {
    case 'ER_DUP_ENTRY':
      return new ApiError(409, 'A record with the same unique value already exists', { code: 'DUPLICATE_ENTRY' });
    case 'ER_NO_REFERENCED_ROW':
    case 'ER_NO_REFERENCED_ROW_2':
      return new ApiError(400, 'A referenced record does not exist', { code: 'INVALID_REFERENCE' });
    case 'ER_ROW_IS_REFERENCED':
    case 'ER_ROW_IS_REFERENCED_2':
      return new ApiError(409, 'This record is in use by other records and cannot be removed', { code: 'RECORD_IN_USE' });
    case 'ER_CHECK_CONSTRAINT_VIOLATED':
      return new ApiError(400, 'The submitted values violate a data rule', { code: 'CONSTRAINT_VIOLATION' });
    case 'ER_DATA_TOO_LONG':
      return new ApiError(400, 'One of the submitted values is too long', { code: 'VALUE_TOO_LONG' });
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(error, req, res, next) {
  const normalized = normalizeError(error);
  const statusCode = normalized ? normalized.statusCode : 500;

  if (statusCode >= 500 || !normalized) {
    logger.error('Unhandled request error', {
      method: req.method,
      path: req.originalUrl,
      userId: req.user?.id,
      error: error.message,
      stack: env.isProduction ? undefined : error.stack,
    });
  }

  const body = {
    success: false,
    error: {
      code: normalized ? normalized.code : 'INTERNAL_ERROR',
      message: normalized ? normalized.message : 'An unexpected error occurred. Please try again later.',
    },
  };
  if (normalized?.details) body.error.details = normalized.details;
  if (!env.isProduction && !normalized) body.error.debug = error.message;

  if (res.headersSent) return;
  res.status(statusCode).json(body);
}
