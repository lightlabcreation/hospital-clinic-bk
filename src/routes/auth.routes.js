// ====================================
// AUTH ROUTES
// ====================================
const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticateToken } = require('../middleware/auth.middleware');

// Public Routes
router.post('/login', authController.login);

// Protected Routes
router.get('/me', authenticateToken, authController.getMe);
router.post('/logout', authenticateToken, authController.logout);
router.put('/profile', authenticateToken, authController.updateProfile);
router.post('/change-password', authenticateToken, authController.changePassword);

module.exports = router;
