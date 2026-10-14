import { ApiError, asyncHandler } from '../../middleware/errorHandler.js';
import { auditContext } from '../../utils/audit.js';
import { optionalId, parseId } from '../../utils/validator.js';
import * as academics from './academics.service.js';
import * as calendar from './calendar.service.js';
import * as v from './academics.validation.js';

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data });
const removed = (res, message) => res.status(200).json({ success: true, message });

// Calendar ------------------------------------------------------------------

export const getCurrent = asyncHandler(async (req, res) => ok(res, await calendar.getCurrentPeriod()));

export const listYears = asyncHandler(async (req, res) => ok(res, await calendar.listYears()));

export const createYear = asyncHandler(async (req, res) => {
  ok(res, await calendar.createYear(v.validateYear(req.body), auditContext(req)), 201);
});

export const updateYear = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  ok(res, await calendar.updateYear(id, v.validateYear(req.body, { partial: true }), auditContext(req)));
});

export const deleteYear = asyncHandler(async (req, res) => {
  await calendar.deleteYear(parseId(req.params.id), auditContext(req));
  removed(res, 'Academic year deleted');
});

export const setCurrentYear = asyncHandler(async (req, res) => {
  ok(res, await calendar.setCurrentYear(parseId(req.params.id), auditContext(req)));
});

export const createTerm = asyncHandler(async (req, res) => {
  ok(res, await calendar.createTerm(v.validateTerm(req.body), auditContext(req)), 201);
});

export const updateTerm = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  ok(res, await calendar.updateTerm(id, v.validateTerm(req.body, { partial: true }), auditContext(req)));
});

export const deleteTerm = asyncHandler(async (req, res) => {
  await calendar.deleteTerm(parseId(req.params.id), auditContext(req));
  removed(res, 'Term deleted');
});

export const setCurrentTerm = asyncHandler(async (req, res) => {
  ok(res, await calendar.setCurrentTerm(parseId(req.params.id), auditContext(req)));
});

// Classes & streams ---------------------------------------------------------

export const listClasses = asyncHandler(async (req, res) => {
  ok(res, await academics.listClasses({ includeInactive: req.query.includeInactive === 'true' }));
});

export const createClass = asyncHandler(async (req, res) => {
  ok(res, await academics.createClass(v.validateClass(req.body), auditContext(req)), 201);
});

export const updateClass = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  ok(res, await academics.updateClass(id, v.validateClass(req.body, { partial: true }), auditContext(req)));
});

export const deleteClass = asyncHandler(async (req, res) => {
  await academics.deleteClass(parseId(req.params.id), auditContext(req));
  removed(res, 'Class deleted');
});

export const createStream = asyncHandler(async (req, res) => {
  ok(res, await academics.createStream(v.validateStream(req.body), auditContext(req)), 201);
});

export const updateStream = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  ok(res, await academics.updateStream(id, v.validateStream(req.body, { partial: true }), auditContext(req)));
});

export const deleteStream = asyncHandler(async (req, res) => {
  await academics.deleteStream(parseId(req.params.id), auditContext(req));
  removed(res, 'Stream deleted');
});

// Subjects ------------------------------------------------------------------

export const listSubjects = asyncHandler(async (req, res) => {
  const { level } = req.query;
  if (level && !v.LEVELS.includes(level)) throw ApiError.badRequest('Invalid level filter');
  ok(res, await academics.listSubjects({ level, includeInactive: req.query.includeInactive === 'true' }));
});

export const createSubject = asyncHandler(async (req, res) => {
  ok(res, await academics.createSubject(v.validateSubject(req.body), auditContext(req)), 201);
});

export const updateSubject = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  ok(res, await academics.updateSubject(id, v.validateSubject(req.body, { partial: true }), auditContext(req)));
});

export const deleteSubject = asyncHandler(async (req, res) => {
  await academics.deleteSubject(parseId(req.params.id), auditContext(req));
  removed(res, 'Subject deleted');
});

// Teacher assignments -------------------------------------------------------

export const listAssignments = asyncHandler(async (req, res) => {
  const filters = {
    academicYearId: optionalId(req.query.academicYearId, 'academicYearId'),
    teacherId: optionalId(req.query.teacherId, 'teacherId'),
    classId: optionalId(req.query.classId, 'classId'),
    subjectId: optionalId(req.query.subjectId, 'subjectId'),
  };
  // Teachers only ever see their own teaching load.
  if (req.user.role === 'teacher') filters.teacherId = req.user.id;
  ok(res, await academics.listAssignments(filters));
});

export const createAssignment = asyncHandler(async (req, res) => {
  ok(res, await academics.createAssignment(v.validateAssignment(req.body), auditContext(req)), 201);
});

export const updateAssignment = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  ok(res, await academics.updateAssignment(id, v.validateAssignmentUpdate(req.body), auditContext(req)));
});

export const deleteAssignment = asyncHandler(async (req, res) => {
  await academics.deleteAssignment(parseId(req.params.id), auditContext(req));
  removed(res, 'Assignment removed');
});
