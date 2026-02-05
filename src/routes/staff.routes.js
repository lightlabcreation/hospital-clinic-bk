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
router.use(authorizeRoles('STAFF', 'ADMIN', 'DOCTOR'));

// Dashboard
router.get('/dashboard', staffController.getDashboardStats);

// Patients
router.get('/patients', staffController.getAllPatients);
router.post('/patients', staffController.addPatient);
router.put('/patients/:id', staffController.updatePatient);
router.delete('/patients/:id', staffController.deletePatient);

// Appointments
router.get('/appointments', staffController.getAllAppointments);

// Doctors
router.get('/doctors/available', staffController.getAvailableDoctors);
router.get('/doctors', staffController.getAllDoctors);

// Clinic Settings (for printing)
router.get('/settings', staffController.getClinicSettings);

module.exports = router;
