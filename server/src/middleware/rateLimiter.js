import { rateLimit } from 'express-rate-limit';
import env from '../config/env.js';

function limitHandler(message) {
  return (req, res, next, options) => {
    res.status(options.statusCode).json({
      success: false,
      error: { code: 'TOO_MANY_REQUESTS', message },
    });
  };
}

/** Applied to every /api request. */
export const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: limitHandler('Too many requests. Please slow down and try again shortly.'),
});

/** Brute-force protection for the login endpoint; successful sign-ins do not count. */
export const loginLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: env.rateLimit.loginMax,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler(
    `Too many sign-in attempts. Please wait ${Math.ceil(env.rateLimit.windowMs / 60000)} minutes before trying again.`,
  ),
});

/** Throttles sensitive authenticated actions such as password changes. */
export const sensitiveActionLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) => (req.user ? `user:${req.user.id}` : `ip:${req.ip}`),
  handler: limitHandler('Too many attempts. Please try again later.'),
});
