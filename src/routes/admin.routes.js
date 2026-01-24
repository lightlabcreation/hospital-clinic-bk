// ====================================
// ADMIN ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/role.middleware');
const { uploadSingle, handleUploadError } = require('../middleware/upload.middleware');

// Apply auth middleware to all routes
router.use(authenticateToken);
router.use(isAdmin);

// Dashboard
router.get('/dashboard/stats', adminController.getDashboardStats);

// Doctor Management
router.get('/doctors', adminController.getAllDoctors);
router.post('/doctors', adminController.addDoctor);
router.put('/doctors/:id', adminController.updateDoctor);
router.delete('/doctors/:id', adminController.deleteDoctor);
router.patch('/doctors/:id/status', adminController.toggleDoctorStatus);
router.get('/doctors/:doctorId/patients', adminController.getDoctorPatients);

// Staff Management
router.get('/staff', adminController.getAllStaff);
router.post('/staff', adminController.addStaff);
router.put('/staff/:id', adminController.updateStaff);
router.delete('/staff/:id', adminController.deleteStaff);
router.patch('/staff/:id/status', adminController.toggleStaffStatus);
router.get('/staff/:staffId/patients', adminController.getStaffPatients);

// Clinic Settings
router.get('/settings', adminController.getClinicSettings);
router.put('/settings', adminController.updateClinicSettings);
router.post('/settings/upload', uploadSingle('file'), handleUploadError, adminController.uploadClinicFile);

// Patients (Read Only)
router.get('/patients', adminController.getAllPatients);

// Appointments (Read Only)
router.get('/appointments', adminController.getAllAppointments);

module.exports = router;
