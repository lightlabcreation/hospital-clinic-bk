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
    getPatientById
};
