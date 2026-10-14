import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { parsePagination } from '../../utils/pagination.js';
import { isValidIsoDate, optionalId, parseId } from '../../utils/validator.js';
import * as audit from './audit.service.js';

const router = Router();

router.use(authorize(ROLES.ADMIN));

router.get('/', asyncHandler(async (req, res) => {
  const { action, targetTable, dateFrom, dateTo, ipAddress, search } = req.query;
  if ((dateFrom && !isValidIsoDate(dateFrom)) || (dateTo && !isValidIsoDate(dateTo))) throw ApiError.badRequest('Invalid date filter');
  if (action && !/^[a-z_]+(\.[a-z_]*)?$/.test(action)) throw ApiError.badRequest('Invalid action filter');
  if (targetTable && !/^[a-z_]+$/.test(targetTable)) throw ApiError.badRequest('Invalid table filter');
  if (ipAddress && !/^[0-9a-fA-F:.]{3,45}$/.test(ipAddress)) throw ApiError.badRequest('Invalid IP address filter');
  const data = await audit.listLogs({
    userId: optionalId(req.query.userId, 'userId'),
    action,
    targetTable,
    dateFrom,
    dateTo,
    ipAddress,
    search: typeof search === 'string' ? search.trim().slice(0, 100) : '',
  }, parsePagination(req.query, { defaultPageSize: 50, maxPageSize: 500 }));
  res.json({ success: true, data });
}));

router.get('/facets', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await audit.listFacets() });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  res.json({ success: true, data: await audit.getLog(parseId(req.params.id)) });
}));

export default router;
