import { Router } from 'express';
import { authorize, ROLES } from '../../middleware/auth.js';
import { sensitiveActionLimiter } from '../../middleware/rateLimiter.js';
import * as c from './finance.controller.js';

const router = Router();

const finance = authorize(ROLES.ADMIN, ROLES.ACCOUNTANT);
const headmaster = authorize(ROLES.ADMIN);
// Parents may read their own children's statements and receipts (enforced in the controller/service).
const financeOrParent = authorize(ROLES.ADMIN, ROLES.ACCOUNTANT, ROLES.PARENT);

router.get('/overview', finance, c.overview);
router.get('/summary', finance, c.summary);
router.get('/defaulters', finance, c.defaulters);
router.get('/students/:id/statement', financeOrParent, c.studentStatement);

router.get('/fee-types', finance, c.listFeeTypes);
router.post('/fee-types', finance, c.createFeeType);
router.put('/fee-types/:id', finance, c.updateFeeType);
router.delete('/fee-types/:id', finance, c.deleteFeeType);

router.get('/fee-structures', finance, c.listStructures);
router.post('/fee-structures', finance, c.createStructures);
router.post('/fee-structures/copy', finance, c.copyStructures);
router.put('/fee-structures/:id', finance, c.updateStructure);
router.delete('/fee-structures/:id', finance, c.deleteStructure);
router.get('/fee-structures/:id/allocations', finance, c.listAllocations);
router.put('/fee-structures/:id/allocations', finance, c.setAllocations);

// Waivers change what a family owes, so only the Headmaster may grant or revoke them.
router.get('/discounts', finance, c.listDiscounts);
router.post('/discounts', headmaster, c.createDiscount);
router.post('/discounts/:id/revoke', headmaster, c.revokeDiscount);

router.get('/payments', finance, c.listPayments);
router.post('/payments', finance, c.recordPayment);
router.get('/payments/:id', financeOrParent, c.getPayment);
router.post('/payments/:id/reverse', finance, sensitiveActionLimiter, c.reversePayment);
router.get('/payments/:id/receipt-pdf', financeOrParent, c.receiptPdf);

router.get('/expenses', finance, c.listExpenses);
router.post('/expenses', finance, c.createExpense);
router.post('/expenses/:id/void', finance, sensitiveActionLimiter, c.voidExpense);

export default router;
