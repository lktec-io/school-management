import { Router } from 'express';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { getSummary } from './dashboard.service.js';

const router = Router();

router.get('/summary', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await getSummary(req.user) });
}));

export default router;
