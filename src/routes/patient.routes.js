// ====================================
// PATIENT ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const patientController = require('../controllers/patient.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Apply auth middleware to all routes
router.use(authenticateToken);

// Search patient by mobile
router.get('/search', patientController.searchByMobile);

// Get patient by ID
router.get('/:id', patientController.getPatientById);

module.exports = router;
