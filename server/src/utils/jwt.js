import jwt from 'jsonwebtoken';
import env from '../config/env.js';

const ALGORITHM = 'HS256';

export function signAccessToken(user) {
  return jwt.sign(
    { role: user.role, tv: user.token_version },
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

export function setSessionCookie(res, token) {
  res.cookie(env.cookie.name, token, sessionCookieOptions());
}

export function clearSessionCookie(res) {
  const { maxAge, ...options } = sessionCookieOptions();
  res.clearCookie(env.cookie.name, options);
}
