// ====================================
// EXPRESS APP CONFIGURATION
// ====================================
const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// ====================================
// MIDDLEWARE
// ====================================
app.use(
    cors({
      origin: [
        process.env.FRONTEND_URL,
        "http://localhost:3000",
       "https://clinic-pro-new.netlify.app"
      ],
      credentials: true
    })
  );
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// ====================================
// IMPORT ROUTES
// ====================================
const authRoutes = require('./routes/auth.routes');
const adminRoutes = require('./routes/admin.routes');
const staffRoutes = require('./routes/staff.routes');
const doctorRoutes = require('./routes/doctor.routes');
const patientRoutes = require('./routes/patient.routes');
const appointmentRoutes = require('./routes/appointment.routes');
const paymentRoutes = require('./routes/payment.routes');

// ====================================
// USE ROUTES
// ====================================
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api', paymentRoutes);

// ====================================
// HEALTH CHECK ROUTE
// ====================================
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        message: 'Hospital Clinic API is running',
        timestamp: new Date().toISOString()
    });
});

// ====================================
// ERROR HANDLING MIDDLEWARE
// ====================================
app.use((err, req, res, next) => {
    console.error('Error:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Something went wrong!',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
});

// ====================================
// 404 HANDLER
// ====================================
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`
    });
});

module.exports = app;
