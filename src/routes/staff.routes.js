// ====================================
// STAFF ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staff.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');

// Apply auth middleware to all routes
router.use(authenticateToken);
router.use(authorizeRoles('STAFF', 'ADMIN'));

// Dashboard
router.get('/dashboard', staffController.getDashboardStats);

// Patients
router.get('/patients', staffController.getAllPatients);
router.post('/patients', staffController.addPatient);

// Appointments
router.get('/appointments', staffController.getAllAppointments);

// Available Doctors (for dropdown)
router.get('/doctors/available', staffController.getAvailableDoctors);

module.exports = router;
