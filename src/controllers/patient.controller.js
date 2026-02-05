// ====================================
// PATIENT CONTROLLER
// ====================================
const db = require('../config/db');
const { successResponse, errorResponse } = require('../utils/response.helper');

// Search patient by mobile (used in appointment booking)
const searchByMobile = async (req, res) => {
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

// Add new patient (for Staff and Doctor - walk-in registration)
const addPatient = async (req, res) => {
    try {
        const { name, mobile, age, gender, address } = req.body;

        if (!name || !mobile) {
            return errorResponse(res, 'Name and mobile are required', 400);
        }

        const mobileDigits = mobile.toString().replace(/\D/g, '');
        if (mobileDigits.length !== 10) {
            return errorResponse(res, 'Mobile number must be exactly 10 digits', 400);
        }

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

// Get patient by ID
const getPatientById = async (req, res) => {
    try {
        const { id } = req.params;

        const [patients] = await db.query('SELECT * FROM patients WHERE id = ?', [id]);

        if (patients.length === 0) {
            return errorResponse(res, 'Patient not found', 404);
        }

        // Get visit history
        const [history] = await db.query(`
            SELECT c.*, a.appointment_date, a.appointment_time, a.reason,
                   d.name as doctor_name
            FROM consultations c
            JOIN appointments a ON c.appointment_id = a.id
            JOIN doctors d ON c.doctor_id = d.id
            WHERE c.patient_id = ?
            ORDER BY c.created_at DESC
        `, [id]);

        successResponse(res, {
            patient: patients[0],
            history
        }, 'Patient fetched successfully');

    } catch (error) {
        console.error('Get Patient Error:', error);
        errorResponse(res, 'Failed to fetch patient', 500, error.message);
    }
};

module.exports = {
    searchByMobile,
    getPatientById,
    addPatient
};
