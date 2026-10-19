import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const ALGORITHM = 'HS256';

/** `remember` (rem claim) decides whether the session cookie outlives the browser window. */
export function signAccessToken(user, { remember = true } = {}) {
  return jwt.sign(
    { role: user.role, tv: user.token_version, rem: remember ? 1 : 0 },
    env.auth.jwtSecret,
    {
      algorithm: ALGORITHM,
      subject: String(user.id),
      issuer: env.auth.jwtIssuer,
      audience: env.auth.jwtAudience,
      expiresIn: env.auth.jwtExpiresInMinutes * 60,
    },
  );
}

export function verifyAccessToken(token) {
  const payload = jwt.verify(token, env.auth.jwtSecret, {
    algorithms: [ALGORITHM],
    issuer: env.auth.jwtIssuer,
    audience: env.auth.jwtAudience,
  });
  return { ...payload, sub: Number.parseInt(payload.sub, 10) };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookie.secure,
    sameSite: env.cookie.sameSite,
    domain: env.cookie.domain,
    path: '/',
    maxAge: env.auth.jwtExpiresInMinutes * 60 * 1000,
  };
}

/**
 * persistent = "Remember me": the cookie lives as long as the token. Otherwise it is a browser-session
 * cookie (no maxAge) that disappears when the browser closes — safer on shared school computers.
 */
export function setSessionCookie(res, token, { persistent = true } = {}) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.cookie(env.cookie.name, token, persistent ? { ...options, maxAge } : options);
}

export function clearSessionCookie(res) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(env.cookie.name, options);
}
