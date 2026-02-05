// ====================================
// DOCTOR ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const doctorController = require('../controllers/doctor.controller');
const { authenticateToken } = require('../middleware/auth.middleware');
const { authorizeRoles } = require('../middleware/role.middleware');
const { uploadSingle, handleUploadError } = require('../middleware/upload.middleware');

// Apply auth middleware to all routes
router.use(authenticateToken);
router.use(authorizeRoles('DOCTOR', 'ADMIN', 'STAFF'));

// Current doctor profile (for self-booking)
router.get('/me', doctorController.getCurrentDoctor);

// Dashboard
router.get('/dashboard', doctorController.getDashboardStats);

// Appointments
router.get('/appointments/today', doctorController.getTodayAppointments);
router.get('/appointments', doctorController.getAppointments);
router.get('/payments', doctorController.getPayments);

// Consultation
router.get('/consultation/:appointmentId', doctorController.getConsultationData);
router.post('/consultation/:appointmentId', doctorController.saveConsultation);
router.get('/consultation/:consultationId/media', doctorController.getConsultationMedia);
router.get('/consultation/:consultationId/media/:mediaId/file', doctorController.getConsultationMediaFile);
router.post('/consultation/:consultationId/media', uploadSingle('file'), handleUploadError, doctorController.uploadConsultationMedia);
router.delete('/consultation/:consultationId/media/:mediaId', doctorController.deleteConsultationMedia);
router.get('/consultation/:consultationId/print', doctorController.getPrintData);
router.get('/patient/:patientId/print', doctorController.getPrintDataByPatient);

// Patient History
router.get('/patients', doctorController.getAllPatients);
router.get('/patients/history', doctorController.getPatientHistory);
router.get('/patients/:patientId/full-history', doctorController.getPatientFullHistory);

// Recent Consultations (for print selection)
router.get('/consultations/recent', doctorController.getRecentConsultations);

// Reports & Images
router.get('/reports', doctorController.getReports);
router.post('/reports', uploadSingle('file'), handleUploadError, doctorController.uploadReport);
router.get('/reports/:id/download', doctorController.downloadReport);
router.delete('/reports/:id', doctorController.deleteReport);

// Templates
router.get('/templates', doctorController.getTemplates);
router.post('/templates', doctorController.addTemplate);
router.delete('/templates/:id', doctorController.deleteTemplate);

// Print Preferences (Doctors can update print layout settings)
router.put('/print-preferences', doctorController.updatePrintPreferences);

// Speech Transcription (Optional - for backend processing)
router.post('/speech/transcribe', doctorController.transcribeSpeech);

module.exports = router;
