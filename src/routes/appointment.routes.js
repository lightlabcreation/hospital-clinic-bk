// ====================================
// APPOINTMENT ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const appointmentController = require('../controllers/appointment.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Apply auth middleware to all routes
router.use(authenticateToken);

// Create appointment
router.post('/', appointmentController.createAppointment);

// Update appointment status
router.patch('/:id/status', appointmentController.updateAppointmentStatus);

// Get available doctors
router.get('/doctors/available', appointmentController.getAvailableDoctors);

module.exports = router;
