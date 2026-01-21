// ====================================
// ADMIN CONTROLLER
// ====================================
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const { successResponse, errorResponse, paginate } = require('../utils/response.helper');

// ====================================
// DASHBOARD STATS
// ====================================
const getDashboardStats = async (req, res) => {
    try {
        // Get total doctors
        const [doctorsCount] = await db.query(
            'SELECT COUNT(*) as total FROM doctors WHERE status = "Active"'
        );

        // Get total staff
        const [staffCount] = await db.query(
            'SELECT COUNT(*) as total FROM staff WHERE status = "Active"'
        );

        // Get total patients
        const [patientsCount] = await db.query(
            'SELECT COUNT(*) as total FROM patients'
        );

        // Get today's appointments
        const [todayAppointments] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE appointment_date = CURRENT_DATE'
        );

        // Get clinic settings
        const [settings] = await db.query('SELECT clinic_name FROM clinic_settings LIMIT 1');

        successResponse(res, {
            totalDoctors: doctorsCount[0].total,
            totalStaff: staffCount[0].total,
            totalPatients: patientsCount[0].total,
            todayAppointments: todayAppointments[0].total,
            clinicStatus: 'Active',
            clinicName: settings[0]?.clinic_name || 'My Clinic'
        }, 'Dashboard stats fetched successfully');

    } catch (error) {
        console.error('Dashboard Stats Error:', error);
        errorResponse(res, 'Failed to fetch dashboard stats', 500, error.message);
    }
};

// ====================================
// DOCTOR MANAGEMENT
// ====================================

// Get all doctors
const getAllDoctors = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        let query = `
            SELECT d.*, u.email as user_email
            FROM doctors d
            LEFT JOIN users u ON d.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (d.name LIKE ? OR d.mobile LIKE ? OR d.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Get total count
        const countQuery = query.replace('SELECT d.*, u.email as user_email', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countQuery, params);

        // Add pagination
        query += ` ORDER BY d.created_at DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [doctors] = await db.query(query, params);

        successResponse(res, {
            doctors,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Doctors fetched successfully');

    } catch (error) {
        console.error('Get Doctors Error:', error);
        errorResponse(res, 'Failed to fetch doctors', 500, error.message);
    }
};

// Add new doctor
const addDoctor = async (req, res) => {
    try {
        const { name, mobile, email, specialization, username, password, status = 'Active' } = req.body;

        // Validate required fields
        if (!name || !mobile || !email || !username || !password) {
            return errorResponse(res, 'All fields are required', 400);
        }

        // Check if username already exists
        const [existingUser] = await db.query(
            'SELECT id FROM doctors WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUser.length > 0) {
            return errorResponse(res, 'Username or email already exists', 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user account
        const [userResult] = await db.query(
            'INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, name, 'DOCTOR', status]
        );

        // Create doctor profile
        const [doctorResult] = await db.query(
            `INSERT INTO doctors (user_id, name, mobile, email, specialization, username, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userResult.insertId, name, mobile, email, specialization || 'General Medicine', username, status]
        );

        // Get created doctor
        const [newDoctor] = await db.query('SELECT * FROM doctors WHERE id = ?', [doctorResult.insertId]);

        successResponse(res, newDoctor[0], 'Doctor added successfully', 201);

    } catch (error) {
        console.error('Add Doctor Error:', error);
        errorResponse(res, 'Failed to add doctor', 500, error.message);
    }
};

// Update doctor
const updateDoctor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, email, specialization, username, password, status } = req.body;

        // Check if doctor exists
        const [existing] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
        if (existing.length === 0) {
            return errorResponse(res, 'Doctor not found', 404);
        }

        // Update doctor
        await db.query(
            `UPDATE doctors SET name = ?, mobile = ?, email = ?, specialization = ?, username = ?, status = ?
             WHERE id = ?`,
            [name, mobile, email, specialization, username, status, id]
        );

        // Update user account
        if (existing[0].user_id) {
            let userUpdateQuery = 'UPDATE users SET email = ?, name = ?, status = ?';
            let userParams = [email, name, status];

            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                userUpdateQuery += ', password = ?';
                userParams.push(hashedPassword);
            }

            userUpdateQuery += ' WHERE id = ?';
            userParams.push(existing[0].user_id);

            await db.query(userUpdateQuery, userParams);
        }

        // Get updated doctor
        const [updatedDoctor] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);

        successResponse(res, updatedDoctor[0], 'Doctor updated successfully');

    } catch (error) {
        console.error('Update Doctor Error:', error);
        errorResponse(res, 'Failed to update doctor', 500, error.message);
    }
};

// Delete doctor
const deleteDoctor = async (req, res) => {
    try {
        const { id } = req.params;

        // Get doctor
        const [doctor] = await db.query('SELECT user_id FROM doctors WHERE id = ?', [id]);
        if (doctor.length === 0) {
            return errorResponse(res, 'Doctor not found', 404);
        }

        // Delete doctor
        await db.query('DELETE FROM doctors WHERE id = ?', [id]);

        // Delete user account
        if (doctor[0].user_id) {
            await db.query('DELETE FROM users WHERE id = ?', [doctor[0].user_id]);
        }

        successResponse(res, null, 'Doctor deleted successfully');

    } catch (error) {
        console.error('Delete Doctor Error:', error);
        errorResponse(res, 'Failed to delete doctor', 500, error.message);
    }
};

// Toggle doctor status
const toggleDoctorStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.query('UPDATE doctors SET status = ? WHERE id = ?', [status, id]);

        // Also update user status
        const [doctor] = await db.query('SELECT user_id FROM doctors WHERE id = ?', [id]);
        if (doctor[0]?.user_id) {
            await db.query('UPDATE users SET status = ? WHERE id = ?', [status, doctor[0].user_id]);
        }

        successResponse(res, { status }, 'Doctor status updated successfully');

    } catch (error) {
        console.error('Toggle Doctor Status Error:', error);
        errorResponse(res, 'Failed to update status', 500, error.message);
    }
};

// ====================================
// STAFF MANAGEMENT
// ====================================

// Get all staff
const getAllStaff = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        let query = `
            SELECT s.*, u.email as user_email
            FROM staff s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (s.name LIKE ? OR s.mobile LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        // Get total count
        const countQuery = query.replace('SELECT s.*, u.email as user_email', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countQuery, params);

        // Add pagination
        query += ` ORDER BY s.created_at DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [staff] = await db.query(query, params);

        successResponse(res, {
            staff,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Staff fetched successfully');

    } catch (error) {
        console.error('Get Staff Error:', error);
        errorResponse(res, 'Failed to fetch staff', 500, error.message);
    }
};

// Add new staff
const addStaff = async (req, res) => {
    try {
        const { name, mobile, username, password, status = 'Active' } = req.body;

        if (!name || !mobile || !username || !password) {
            return errorResponse(res, 'All fields are required', 400);
        }

        // Check if username already exists
        const [existingStaff] = await db.query('SELECT id FROM staff WHERE username = ?', [username]);
        if (existingStaff.length > 0) {
            return errorResponse(res, 'Username already exists', 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Generate email from username
        const email = `${username}@clinic.com`;

        // Create user account
        const [userResult] = await db.query(
            'INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, name, 'STAFF', status]
        );

        // Create staff profile
        const [staffResult] = await db.query(
            'INSERT INTO staff (user_id, name, mobile, username, status) VALUES (?, ?, ?, ?, ?)',
            [userResult.insertId, name, mobile, username, status]
        );

        // Get created staff
        const [newStaff] = await db.query('SELECT * FROM staff WHERE id = ?', [staffResult.insertId]);

        successResponse(res, newStaff[0], 'Staff added successfully', 201);

    } catch (error) {
        console.error('Add Staff Error:', error);
        errorResponse(res, 'Failed to add staff', 500, error.message);
    }
};

// Update staff
const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, mobile, username, password, status } = req.body;

        const [existing] = await db.query('SELECT * FROM staff WHERE id = ?', [id]);
        if (existing.length === 0) {
            return errorResponse(res, 'Staff not found', 404);
        }

        await db.query(
            'UPDATE staff SET name = ?, mobile = ?, username = ?, status = ? WHERE id = ?',
            [name, mobile, username, status, id]
        );

        // Update user account
        if (existing[0].user_id) {
            let userUpdateQuery = 'UPDATE users SET name = ?, status = ?';
            let userParams = [name, status];

            if (password) {
                const hashedPassword = await bcrypt.hash(password, 10);
                userUpdateQuery += ', password = ?';
                userParams.push(hashedPassword);
            }

            userUpdateQuery += ' WHERE id = ?';
            userParams.push(existing[0].user_id);

            await db.query(userUpdateQuery, userParams);
        }

        const [updatedStaff] = await db.query('SELECT * FROM staff WHERE id = ?', [id]);

        successResponse(res, updatedStaff[0], 'Staff updated successfully');

    } catch (error) {
        console.error('Update Staff Error:', error);
        errorResponse(res, 'Failed to update staff', 500, error.message);
    }
};

// Delete staff
const deleteStaff = async (req, res) => {
    try {
        const { id } = req.params;

        const [staff] = await db.query('SELECT user_id FROM staff WHERE id = ?', [id]);
        if (staff.length === 0) {
            return errorResponse(res, 'Staff not found', 404);
        }

        await db.query('DELETE FROM staff WHERE id = ?', [id]);

        if (staff[0].user_id) {
            await db.query('DELETE FROM users WHERE id = ?', [staff[0].user_id]);
        }

        successResponse(res, null, 'Staff deleted successfully');

    } catch (error) {
        console.error('Delete Staff Error:', error);
        errorResponse(res, 'Failed to delete staff', 500, error.message);
    }
};

// Toggle staff status
const toggleStaffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        await db.query('UPDATE staff SET status = ? WHERE id = ?', [status, id]);

        const [staff] = await db.query('SELECT user_id FROM staff WHERE id = ?', [id]);
        if (staff[0]?.user_id) {
            await db.query('UPDATE users SET status = ? WHERE id = ?', [status, staff[0].user_id]);
        }

        successResponse(res, { status }, 'Staff status updated successfully');

    } catch (error) {
        console.error('Toggle Staff Status Error:', error);
        errorResponse(res, 'Failed to update status', 500, error.message);
    }
};

// ====================================
// CLINIC SETTINGS
// ====================================

// Get clinic settings
const getClinicSettings = async (req, res) => {
    try {
        const [settings] = await db.query('SELECT * FROM clinic_settings LIMIT 1');

        if (settings.length === 0) {
            // Create default settings
            await db.query(
                'INSERT INTO clinic_settings (clinic_name) VALUES (?)',
                ['My Clinic']
            );
            const [newSettings] = await db.query('SELECT * FROM clinic_settings LIMIT 1');
            return successResponse(res, newSettings[0], 'Settings fetched successfully');
        }

        successResponse(res, settings[0], 'Settings fetched successfully');

    } catch (error) {
        console.error('Get Settings Error:', error);
        errorResponse(res, 'Failed to fetch settings', 500, error.message);
    }
};

// Update clinic settings
const updateClinicSettings = async (req, res) => {
    try {
        const { clinic_name, address, phone, email, print_header_footer } = req.body;

        await db.query(
            `UPDATE clinic_settings SET
             clinic_name = ?, address = ?, phone = ?, email = ?, print_header_footer = ?
             WHERE id = 1`,
            [clinic_name, address, phone, email, print_header_footer]
        );

        const [settings] = await db.query('SELECT * FROM clinic_settings LIMIT 1');

        successResponse(res, settings[0], 'Settings updated successfully');

    } catch (error) {
        console.error('Update Settings Error:', error);
        errorResponse(res, 'Failed to update settings', 500, error.message);
    }
};

// Upload logo/signature
const uploadClinicFile = async (req, res) => {
    try {
        if (!req.file) {
            return errorResponse(res, 'No file uploaded', 400);
        }

        const { type } = req.body; // 'logo' or 'signature'
        const fileUrl = `/uploads/images/${req.file.filename}`;

        const field = type === 'signature' ? 'signature_url' : 'logo_url';

        await db.query(
            `UPDATE clinic_settings SET ${field} = ? WHERE id = 1`,
            [fileUrl]
        );

        successResponse(res, { url: fileUrl }, 'File uploaded successfully');

    } catch (error) {
        console.error('Upload File Error:', error);
        errorResponse(res, 'Failed to upload file', 500, error.message);
    }
};

// ====================================
// PATIENTS (Admin View - Read Only)
// ====================================
const getAllPatients = async (req, res) => {
    try {
        const { search, page = 1, limit = 10 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        let query = 'SELECT * FROM patients WHERE 1=1';
        const params = [];

        if (search) {
            query += ` AND (name LIKE ? OR mobile LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countQuery, params);

        query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [patients] = await db.query(query, params);

        successResponse(res, {
            patients,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Patients fetched successfully');

    } catch (error) {
        console.error('Get Patients Error:', error);
        errorResponse(res, 'Failed to fetch patients', 500, error.message);
    }
};

// ====================================
// APPOINTMENTS (Admin View - Read Only)
// ====================================
const getAllAppointments = async (req, res) => {
    try {
        const { search, status, date, page = 1, limit = 10 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        let query = `
            SELECT a.*,
                   p.name as patient_name, p.mobile as patient_mobile, p.age as patient_age, p.gender as patient_gender,
                   d.name as doctor_name, d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ? OR d.name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        if (status && status !== 'All') {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        if (date) {
            query += ` AND a.appointment_date = ?`;
            params.push(date);
        }

        const countQuery = query.replace(/SELECT a\.\*,[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
        const [countResult] = await db.query(countQuery, params);

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [appointments] = await db.query(query, params);

        successResponse(res, {
            appointments,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Appointments fetched successfully');

    } catch (error) {
        console.error('Get Appointments Error:', error);
        errorResponse(res, 'Failed to fetch appointments', 500, error.message);
    }
};

module.exports = {
    getDashboardStats,
    getAllDoctors,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    toggleDoctorStatus,
    getAllStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    toggleStaffStatus,
    getClinicSettings,
    updateClinicSettings,
    uploadClinicFile,
    getAllPatients,
    getAllAppointments
};
