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

        // Get total appointments (all-time)
        const [appointmentsCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments'
        );

        // Get total payments (completed only)
        const [paymentsTotal] = await db.query(
            'SELECT COALESCE(SUM(fee), 0) as total FROM appointments WHERE status = "Completed"'
        );

        // Get clinic settings
        const [settings] = await db.query('SELECT clinic_name FROM clinic_settings LIMIT 1');

        successResponse(res, {
            totalDoctors: doctorsCount[0].total,
            totalStaff: staffCount[0].total,
            totalPatients: patientsCount[0].total,
            totalAppointments: appointmentsCount[0].total,
            totalPayments: paymentsTotal[0].total,
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
        const { name, mobile, email, specialization, consultation_fee, username, password, status = 'Active' } = req.body;

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

        const feeAmount = consultation_fee != null ? parseFloat(consultation_fee) : 0;
        // Create doctor profile
        const [doctorResult] = await db.query(
            `INSERT INTO doctors (user_id, name, mobile, email, specialization, consultation_fee, username, status)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userResult.insertId, name, mobile, email, specialization || 'General Medicine', feeAmount, username, status]
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
        const { name, mobile, email, specialization, consultation_fee, username, password, status } = req.body;

        // Check if doctor exists
        const [existing] = await db.query('SELECT * FROM doctors WHERE id = ?', [id]);
        if (existing.length === 0) {
            return errorResponse(res, 'Doctor not found', 404);
        }

        const feeAmount = consultation_fee != null ? parseFloat(consultation_fee) : undefined;
        const updateFields = ['name = ?', 'mobile = ?', 'email = ?', 'specialization = ?', 'username = ?', 'status = ?'];
        const updateParams = [name, mobile, email, specialization, username, status];
        if (feeAmount !== undefined) {
            updateFields.push('consultation_fee = ?');
            updateParams.push(feeAmount);
        }
        updateParams.push(id);
        await db.query(
            `UPDATE doctors SET ${updateFields.join(', ')} WHERE id = ?`,
            updateParams
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

// Get doctor's patients
const getDoctorPatients = async (req, res) => {
    try {
        const { doctorId } = req.params;
        const { search, page = 1, limit = 50 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        // Verify doctor exists
        const [doctor] = await db.query('SELECT id, name FROM doctors WHERE id = ?', [doctorId]);
        if (doctor.length === 0) {
            return errorResponse(res, 'Doctor not found', 404);
        }

        // Get patients who have appointments with this doctor
        let query = `
            SELECT p.*,
                   COUNT(DISTINCT a.id) as totalAppointments,
                   MAX(a.appointment_date) as lastAppointmentDate,
                   (SELECT c.diagnosis FROM consultations c
                    INNER JOIN appointments ap ON c.appointment_id = ap.id
                    WHERE ap.patient_id = p.id AND ap.doctor_id = ?
                    ORDER BY c.id DESC LIMIT 1) as lastDiagnosis
            FROM patients p
            INNER JOIN appointments a ON p.id = a.patient_id
            WHERE a.doctor_id = ?
        `;
        const params = [doctorId, doctorId];

        if (search) {
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` GROUP BY p.id`;

        // Get total count - build count query separately
        let countQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM patients p
            INNER JOIN appointments a ON p.id = a.patient_id
            WHERE a.doctor_id = ?
        `;
        const countParams = [doctorId];
        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await db.query(countQuery, countParams);

        query += ` ORDER BY lastAppointmentDate DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [patients] = await db.query(query, params);

        successResponse(res, {
            doctor: doctor[0],
            patients,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Doctor patients fetched successfully');

    } catch (error) {
        console.error('Get Doctor Patients Error:', error);
        errorResponse(res, 'Failed to fetch doctor patients', 500, error.message);
    }
};

// Get staff's patients (patients added by this staff member)
const getStaffPatients = async (req, res) => {
    try {
        const { staffId } = req.params;
        const { search, page = 1, limit = 50 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        // Get staff user_id
        const [staff] = await db.query('SELECT id, name, user_id FROM staff WHERE id = ?', [staffId]);
        if (staff.length === 0) {
            return errorResponse(res, 'Staff not found', 404);
        }

        const staffUserId = staff[0].user_id;
        if (!staffUserId) {
            return errorResponse(res, 'Staff user account not found', 404);
        }

        // Get patients who have appointments created by this staff
        let query = `
            SELECT p.*,
                   COUNT(DISTINCT a.id) as totalAppointments,
                   MAX(a.appointment_date) as lastAppointmentDate,
                   COUNT(DISTINCT a.doctor_id) as doctorsSeen
            FROM patients p
            INNER JOIN appointments a ON p.id = a.patient_id
            WHERE a.created_by = ?
        `;
        const params = [staffUserId];

        if (search) {
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        query += ` GROUP BY p.id`;

        // Get total count - build count query separately
        let countQuery = `
            SELECT COUNT(DISTINCT p.id) as total
            FROM patients p
            INNER JOIN appointments a ON p.id = a.patient_id
            WHERE a.created_by = ?
        `;
        const countParams = [staffUserId];
        if (search) {
            countQuery += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            countParams.push(`%${search}%`, `%${search}%`);
        }
        const [countResult] = await db.query(countQuery, countParams);

        query += ` ORDER BY lastAppointmentDate DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [patients] = await db.query(query, params);

        successResponse(res, {
            staff: staff[0],
            patients,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Staff patients fetched successfully');

    } catch (error) {
        console.error('Get Staff Patients Error:', error);
        errorResponse(res, 'Failed to fetch staff patients', 500, error.message);
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
            SELECT s.*, u.email
            FROM staff s
            LEFT JOIN users u ON s.user_id = u.id
            WHERE 1=1
        `;
        const params = [];

        if (search) {
            query += ` AND (s.name LIKE ? OR s.mobile LIKE ? OR u.email LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        // Get total count
        const countQuery = query.replace('SELECT s.*, u.email', 'SELECT COUNT(*) as total');
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
        const { name, mobile, email, password, status = 'Active' } = req.body;

        if (!name || !mobile || !email || !password) {
            return errorResponse(res, 'All fields are required', 400);
        }

        // Check if email already exists
        const [existingUser] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser.length > 0) {
            return errorResponse(res, 'Email already exists', 400);
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user account with email
        const [userResult] = await db.query(
            'INSERT INTO users (email, password, name, role, status) VALUES (?, ?, ?, ?, ?)',
            [email, hashedPassword, name, 'STAFF', status]
        );

        // Create staff profile (email is stored in users table, staff has username for backward compatibility)
        const [staffResult] = await db.query(
            'INSERT INTO staff (user_id, name, mobile, username, status) VALUES (?, ?, ?, ?, ?)',
            [userResult.insertId, name, mobile, email, status]
        );

        // Get created staff with email from users table
        const [newStaff] = await db.query(
            'SELECT s.*, u.email FROM staff s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?',
            [staffResult.insertId]
        );

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
        const { name, mobile, email, password, status } = req.body;

        // Validate required fields
        if (!name || !mobile || !email) {
            return errorResponse(res, 'Name, mobile, and email are required', 400);
        }

        // Validate status if provided
        if (status && !['Active', 'Inactive'].includes(status)) {
            return errorResponse(res, 'Status must be either "Active" or "Inactive"', 400);
        }

        const [existing] = await db.query('SELECT * FROM staff WHERE id = ?', [id]);
        if (existing.length === 0) {
            return errorResponse(res, 'Staff not found', 404);
        }

        // Use existing status if not provided
        const finalStatus = status || existing[0].status || 'Active';

        // Update staff table (username stores the email for backward compatibility)
        await db.query(
            'UPDATE staff SET name = ?, mobile = ?, username = ?, status = ? WHERE id = ?',
            [name, mobile, email, finalStatus, id]
        );

        // Update user account (email is stored here)
        if (existing[0].user_id) {
            let userUpdateQuery = 'UPDATE users SET name = ?, email = ?, status = ?';
            let userParams = [name, email, finalStatus];

            if (password && password.trim() !== '') {
                const hashedPassword = await bcrypt.hash(password, 10);
                userUpdateQuery += ', password = ?';
                userParams.push(hashedPassword);
            }

            userUpdateQuery += ' WHERE id = ?';
            userParams.push(existing[0].user_id);

            await db.query(userUpdateQuery, userParams);
        }

        // Get updated staff with email from users table
        const [updatedStaff] = await db.query(
            'SELECT s.*, u.email FROM staff s LEFT JOIN users u ON s.user_id = u.id WHERE s.id = ?',
            [id]
        );

        if (updatedStaff.length === 0) {
            return errorResponse(res, 'Failed to retrieve updated staff', 500);
        }

        successResponse(res, updatedStaff[0], 'Staff updated successfully');

    } catch (error) {
        console.error('Update Staff Error:', error);
        console.error('Error Stack:', error.stack);

        // Handle specific database errors
        if (error.code === 'ER_DUP_ENTRY') {
            if (error.message.includes('username')) {
                return errorResponse(res, 'Username/Email already exists. Please use a different email.', 400);
            }
            return errorResponse(res, 'Duplicate entry. This email or username already exists.', 400);
        }

        if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            return errorResponse(res, 'Referenced user not found', 400);
        }

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
        const {
            clinic_name,
            address,
            phone,
            email,
            print_header,
            print_header_footer,
            // Print layout preferences
            header_margin_top,
            header_margin_bottom,
            footer_margin_top,
            footer_margin_bottom,
            page_margin_left,
            page_margin_right
        } = req.body;

        // Build dynamic update query
        const updateFields = []
        const updateValues = []

        if (clinic_name !== undefined) {
            updateFields.push('clinic_name = ?')
            updateValues.push(clinic_name)
        }
        if (address !== undefined) {
            updateFields.push('address = ?')
            updateValues.push(address)
        }
        if (phone !== undefined) {
            updateFields.push('phone = ?')
            updateValues.push(phone)
        }
        if (email !== undefined) {
            updateFields.push('email = ?')
            updateValues.push(email)
        }
        if (print_header !== undefined) {
            updateFields.push('print_header = ?')
            updateValues.push(print_header)
        }
        if (print_header_footer !== undefined) {
            updateFields.push('print_header_footer = ?')
            updateValues.push(print_header_footer)
        }
        // Print layout preferences
        if (header_margin_top !== undefined) {
            updateFields.push('header_margin_top = ?')
            updateValues.push(header_margin_top)
        }
        if (header_margin_bottom !== undefined) {
            updateFields.push('header_margin_bottom = ?')
            updateValues.push(header_margin_bottom)
        }
        if (footer_margin_top !== undefined) {
            updateFields.push('footer_margin_top = ?')
            updateValues.push(footer_margin_top)
        }
        if (footer_margin_bottom !== undefined) {
            updateFields.push('footer_margin_bottom = ?')
            updateValues.push(footer_margin_bottom)
        }
        if (page_margin_left !== undefined) {
            updateFields.push('page_margin_left = ?')
            updateValues.push(page_margin_left)
        }
        if (page_margin_right !== undefined) {
            updateFields.push('page_margin_right = ?')
            updateValues.push(page_margin_right)
        }

        if (updateFields.length === 0) {
            return errorResponse(res, 'No fields to update', 400);
        }

        updateValues.push(1) // WHERE id = 1

        await db.query(
            `UPDATE clinic_settings SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
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
                   d.name as doctor_name, d.specialization, COALESCE(a.fee, 0) as fee
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
            if (date === 'today') {
                query += ` AND a.appointment_date = CURRENT_DATE`;
            } else {
                query += ` AND a.appointment_date = ?`;
                params.push(date);
            }
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
    getDoctorPatients,
    getAllStaff,
    addStaff,
    updateStaff,
    deleteStaff,
    toggleStaffStatus,
    getStaffPatients,
    getClinicSettings,
    updateClinicSettings,
    uploadClinicFile,
    getAllPatients,
    getAllAppointments
};
