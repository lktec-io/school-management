import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { parsePagination } from '../../utils/pagination.js';
import { parseId, validator } from '../../utils/validator.js';
import * as usersService from './users.service.js';

const ROLES = ['admin', 'accountant', 'teacher', 'parent'];
const STATUSES = ['active', 'inactive', 'suspended'];

function validateUser(body, { partial = false } = {}) {
  const v = validator(body, { partial })
    .string('fullName', { required: true, min: 3, max: 150 })
    .email('email')
    .phone('phone')
    .oneOf('role', ROLES, { required: true });
  if (partial) v.oneOf('status', STATUSES);
  else v.rule('email', (data) => (data.email || data.phone ? null : 'An email or phone number is required'));
  return v.result();
}

export const listUsers = asyncHandler(async (req, res) => {
  const { role, status, search } = req.query;
  if (role && !ROLES.includes(role)) throw ApiError.badRequest('Invalid role filter');
  if (status && !STATUSES.includes(status)) throw ApiError.badRequest('Invalid status filter');
  const result = await usersService.listUsers(
    { role, status, search: typeof search === 'string' ? search.trim().slice(0, 100) : '' },
    parsePagination(req.query, { defaultPageSize: 50, maxPageSize: 200 }),
  );
  res.json({ success: true, data: result });
});

export const createUser = asyncHandler(async (req, res) => {
  const result = await usersService.createUser(validateUser(req.body), auditContext(req));
  res.status(201).json({ success: true, data: result });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await usersService.updateUser(
    parseId(req.params.id),
    validateUser(req.body, { partial: true }),
    req.user,
    auditContext(req),
  );
  res.json({ success: true, data: user });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await usersService.resetPassword(parseId(req.params.id), req.user, auditContext(req));
  res.json({ success: true, data: result });
});
