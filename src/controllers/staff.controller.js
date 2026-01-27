// ====================================
// STAFF CONTROLLER
// ====================================
const db = require('../config/db');
const { successResponse, errorResponse, paginate, formatDate, formatTime } = require('../utils/response.helper');

// ====================================
// DASHBOARD
// ====================================
const getDashboardStats = async (req, res) => {
    try {
        // Today's date
        const today = new Date().toISOString().split('T')[0];

        // Get today's total appointments across the clinic
        const [totalAppointments] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE appointment_date = ?',
            [today]
        );

        // Get total waiting count across the clinic
        const [waitingCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE appointment_date = ? AND status = "Waiting"',
            [today]
        );

        // Get total completed count across the clinic
        const [completedCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE appointment_date = ? AND status = "Completed"',
            [today]
        );

        // Get total patients in the clinic
        const [totalPatients] = await db.query(
            'SELECT COUNT(*) as total FROM patients'
        );

        // Get total appointments (all time)
        const [totalAppointmentsAllTime] = await db.query(
            'SELECT COUNT(*) as total FROM appointments'
        );

        // Get recent appointments (today's overall)
        const [recentAppointments] = await db.query(`
            SELECT a.id, a.appointment_time as time, a.status, a.appointment_date as date,
                   p.name as patient, d.name as doctor
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.appointment_date = ?
            ORDER BY a.appointment_time DESC
            LIMIT 8
        `, [today]);

        // Get recent patients added to the clinic
        const [recentPatients] = await db.query(`
            SELECT p.id, p.name, p.mobile, p.age, p.gender, p.registered_date,
                   (SELECT COUNT(*) FROM appointments WHERE patient_id = p.id) as appointmentCount,
                   (SELECT MAX(appointment_date) FROM appointments WHERE patient_id = p.id) as lastAppointmentDate
            FROM patients p
            ORDER BY p.created_at DESC
            LIMIT 8
        `);

        successResponse(res, {
            stats: {
                totalAppointments: totalAppointments[0].total,
                waiting: waitingCount[0].total,
                completed: completedCount[0].total,
                totalPatients: totalPatients[0].total,
                totalAppointmentsAllTime: totalAppointmentsAllTime[0].total
            },
            recentAppointments,
            recentPatients
        }, 'Dashboard data fetched successfully');

    } catch (error) {
        console.error('Staff Dashboard Error:', error);
        errorResponse(res, 'Failed to fetch dashboard data', 500, error.message);
    }
};

// ====================================
// PATIENT MANAGEMENT
// ====================================

// Search patient by mobile
const searchPatientByMobile = async (req, res) => {
    try {
        const { mobile } = req.query;

        if (!mobile) {
            return errorResponse(res, 'Mobile number is required', 400);
        }

        const [patients] = await db.query(
            'SELECT * FROM patients WHERE mobile = ?',
            [mobile]
        );

        if (patients.length > 0) {
            successResponse(res, {
                found: true,
                patient: patients[0]
            }, 'Patient found');
        } else {
            successResponse(res, {
                found: false,
                patient: null
            }, 'Patient not found');
        }

    } catch (error) {
        console.error('Search Patient Error:', error);
        errorResponse(res, 'Failed to search patient', 500, error.message);
    }
};

// Get all patients
const getAllPatients = async (req, res) => {
    try {
        const { search, page = 1, limit = 20 } = req.query;
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
            total: countResult[0].total
        }, 'Patients fetched successfully');

    } catch (error) {
        console.error('Get Patients Error:', error);
        errorResponse(res, 'Failed to fetch patients', 500, error.message);
    }
};

// Add new patient
const addPatient = async (req, res) => {
    try {
        const { name, mobile, age, gender, address } = req.body;

        if (!name || !mobile) {
            return errorResponse(res, 'Name and mobile are required', 400);
        }

        // Validate mobile number - must be exactly 10 digits
        const mobileDigits = mobile.toString().replace(/\D/g, ''); // Remove non-digits
        if (mobileDigits.length !== 10) {
            return errorResponse(res, 'Mobile number must be exactly 10 digits', 400);
        }

        // Check if mobile already exists
        const [existing] = await db.query('SELECT id FROM patients WHERE mobile = ?', [mobileDigits]);
        if (existing.length > 0) {
            return errorResponse(res, 'Patient with this mobile number already exists', 400);
        }

        const [result] = await db.query(
            `INSERT INTO patients (name, mobile, age, gender, address, registered_date)
             VALUES (?, ?, ?, ?, ?, CURRENT_DATE)`,
            [name, mobileDigits, age || null, gender || 'Male', address || null]
        );

        const [newPatient] = await db.query('SELECT * FROM patients WHERE id = ?', [result.insertId]);

        successResponse(res, newPatient[0], 'Patient added successfully', 201);

    } catch (error) {
        console.error('Add Patient Error:', error);
        errorResponse(res, 'Failed to add patient', 500, error.message);
    }
};

// ====================================
// APPOINTMENT MANAGEMENT
// ====================================

// Get all appointments (for staff)
const getAllAppointments = async (req, res) => {
    try {
        const { date, search, status, page = 1, limit = 20 } = req.query;
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

        // Filter by date
        if (date === 'today') {
            query += ` AND a.appointment_date = CURRENT_DATE`;
        } else if (date) {
            query += ` AND a.appointment_date = ?`;
            params.push(date);
        }

        // Filter by search
        if (search) {
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        // Filter by status
        if (status && status !== 'All') {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        const countQuery = query.replace(/SELECT a\.\*,[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
        const [countResult] = await db.query(countQuery, params);

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [appointments] = await db.query(query, params);

        successResponse(res, {
            appointments,
            total: countResult[0].total
        }, 'Appointments fetched successfully');

    } catch (error) {
        console.error('Get Appointments Error:', error);
        errorResponse(res, 'Failed to fetch appointments', 500, error.message);
    }
};

// Get available doctors
const getAvailableDoctors = async (req, res) => {
    try {
        const [doctors] = await db.query(
            'SELECT id, name, specialization FROM doctors WHERE status = "Active" ORDER BY name'
        );

        successResponse(res, doctors, 'Doctors fetched successfully');

    } catch (error) {
        console.error('Get Doctors Error:', error);
        errorResponse(res, 'Failed to fetch doctors', 500, error.message);
    }
};

// Create appointment
const createAppointment = async (req, res) => {
    try {
        let {
            patientId,
            patientName,
            patientMobile,
            patientAge,
            patientGender,
            date,
            time,
            doctorId,
            reason
        } = req.body;

        // Validate required fields
        if (!date || !time || !doctorId) {
            return errorResponse(res, 'Date, time and doctor are required', 400);
        }

        if (!patientId && (!patientName || !patientMobile)) {
            return errorResponse(res, 'Patient name and mobile are required for new patients', 400);
        }

        // Validate and clean mobile number if provided (for new patients)
        if (patientMobile) {
            const mobileDigits = patientMobile.toString().replace(/\D/g, ''); // Remove non-digits
            if (mobileDigits.length !== 10) {
                return errorResponse(res, 'Mobile number must be exactly 10 digits', 400);
            }
            // Use cleaned mobile number
            patientMobile = mobileDigits;
        }

        // Format date and time
        const formattedDate = formatDate(date);
        const formattedTime = formatTime(time);

        // Check for duplicate appointment (same doctor, same date, same time)
        const [duplicate] = await db.query(
            `SELECT id FROM appointments
             WHERE doctor_id = ? AND appointment_date = ? AND appointment_time = ?
             AND status != 'Cancelled'`,
            [doctorId, formattedDate, formattedTime]
        );

        if (duplicate.length > 0) {
            return errorResponse(res, 'This time slot is already booked for this doctor', 400);
        }

        let finalPatientId = patientId;

        // If no patientId, check if patient exists or create new
        if (!patientId) {
            // Clean mobile number
            const mobileDigits = patientMobile.toString().replace(/\D/g, '');

            const [existingPatient] = await db.query(
                'SELECT id FROM patients WHERE mobile = ?',
                [mobileDigits]
            );

            if (existingPatient.length > 0) {
                finalPatientId = existingPatient[0].id;
            } else {
                // Create new patient
                const [newPatient] = await db.query(
                    `INSERT INTO patients (name, mobile, age, gender, registered_date)
                     VALUES (?, ?, ?, ?, CURRENT_DATE)`,
                    [patientName, mobileDigits, patientAge || null, patientGender || 'Male']
                );
                finalPatientId = newPatient.insertId;
            }
        }

        // Create appointment
        const [result] = await db.query(
            `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status, created_by)
             VALUES (?, ?, ?, ?, ?, 'Waiting', ?)`,
            [finalPatientId, doctorId, formattedDate, formattedTime, reason || null, req.user.id]
        );

        // Update patient's total visits and last visit
        await db.query(
            `UPDATE patients SET total_visits = total_visits + 1, last_visit = ? WHERE id = ?`,
            [formattedDate, finalPatientId]
        );

        // Get created appointment with details
        const [appointment] = await db.query(`
            SELECT a.*,
                   p.name as patient_name, p.mobile as patient_mobile, p.age as patient_age, p.gender as patient_gender,
                   d.name as doctor_name, d.specialization
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.id = ?
        `, [result.insertId]);

        // Get patient data
        const [patient] = await db.query('SELECT * FROM patients WHERE id = ?', [finalPatientId]);

        successResponse(res, {
            appointment: appointment[0],
            patient: patient[0]
        }, 'Appointment booked successfully', 201);

    } catch (error) {
        console.error('Create Appointment Error:', error);
        errorResponse(res, 'Failed to create appointment', 500, error.message);
    }
};

module.exports = {
    getDashboardStats,
    searchPatientByMobile,
    getAllPatients,
    addPatient,
    getAllAppointments,
    getAvailableDoctors,
    createAppointment
};
