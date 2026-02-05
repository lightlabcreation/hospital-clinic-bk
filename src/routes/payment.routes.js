// ====================================
// PAYMENT & INVOICE ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/payment.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

router.use(authenticateToken);
router.use(authorizeRoles('ADMIN', 'STAFF', 'DOCTOR'));

router.get('/payments/list', paymentController.getPaymentInvoiceList);
router.get('/payments', paymentController.getAllPayments);
router.get('/payments/range', paymentController.getPaymentsByDateRange);
router.post('/payments', paymentController.recordPayment);
router.post('/payments/sync', paymentController.syncPaymentsFromAppointments);

router.get('/invoices', paymentController.getAllInvoices);
router.post('/invoices/generate', paymentController.generateInvoice);
router.get('/invoices/:id', paymentController.getInvoiceById);

module.exports = router;
