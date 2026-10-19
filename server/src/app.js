import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import env from './config/env.js';
import { ApiError, errorHandler, notFound } from './middleware/errorHandler.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import v1Routes from './routes/index.js';
import logger from './utils/logger.js';

const app = express();

app.disable('x-powered-by');
// Behind Nginx on the VPS this must match the number of proxies so req.ip (rate limits, audit logs) is the real client.
app.set('trust proxy', env.trustProxy);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'same-site' },
}));

const allowedOrigins = new Set(env.corsOrigins);
app.use(cors({
  origin(origin, callback) {
    // Requests without an Origin header (same-origin GETs, server-to-server, curl) are allowed;
    // browsers always send Origin on cross-origin and state-changing requests.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    // Logged so a misconfigured DOMAIN/CORS_ORIGINS is obvious in `pm2 logs`.
    logger.warn('Rejected request from origin not in CORS_ORIGINS', { origin, allowed: [...allowedOrigins] });
    return callback(new ApiError(403, `Origin not allowed: ${origin}`, { code: 'CORS_REJECTED' }));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 600,
}));

// Image uploads (branding, student and profile photos) arrive as base64 data URLs up to 1.5 MB; everything else stays at 1 MB.
const imageJson = express.json({ limit: '3mb' });
const PHOTO_UPLOAD_PATH = /^\/api\/v1\/(students\/\d+\/photo|auth\/me\/photo)$/;
app.use('/api/v1/system/branding', imageJson);
app.use((req, res, next) => (PHOTO_UPLOAD_PATH.test(req.path) ? imageJson(req, res, next) : next()));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.use('/api', apiLimiter);
app.use('/api/v1', v1Routes);

app.use(notFound);
app.use(errorHandler);

export default app;
