// ====================================
// APPOINTMENT CONTROLLER
// ====================================
const db = require('../config/db');
const { successResponse, errorResponse, formatDate, formatTime } = require('../utils/response.helper');

// Create appointment
const createAppointment = async (req, res) => {
    try {
        const {
            patientId,
            patientName,
            patientMobile,
            patientAge,
            patientGender,
            date,
            time,
            doctorId,
            reason,
            fee
        } = req.body;

        // Validate required fields
        if (!date || !time || !doctorId) {
            return errorResponse(res, 'Date, time and doctor are required', 400);
        }

        if (!patientId && (!patientName || !patientMobile)) {
            return errorResponse(res, 'Patient name and mobile are required for new patients', 400);
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
            const [existingPatient] = await db.query(
                'SELECT id FROM patients WHERE mobile = ?',
                [patientMobile]
            );

            if (existingPatient.length > 0) {
                finalPatientId = existingPatient[0].id;
            } else {
                // Create new patient
                const [newPatient] = await db.query(
                    `INSERT INTO patients (name, mobile, age, gender, registered_date, created_by)
                     VALUES (?, ?, ?, ?, CURRENT_DATE, ?)`,
                    [patientName, patientMobile, patientAge || null, patientGender || 'Male', req.user.id]
                );
                finalPatientId = newPatient.insertId;
            }
        }

        const feeAmount = fee != null && fee !== '' ? parseFloat(fee) : 0;

        // Create appointment
        const [result] = await db.query(
            `INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, fee, status, created_by)
             VALUES (?, ?, ?, ?, ?, ?, 'Waiting', ?)`,
            [finalPatientId, doctorId, formattedDate, formattedTime, reason || null, feeAmount, req.user.id]
        );

        // Update patient's total visits and last visit
        await db.query(
            `UPDATE patients SET total_visits = total_visits + 1, last_visit = ? WHERE id = ?`,
            [formattedDate, finalPatientId]
        );

        // If fee > 0: Create payment + invoice at booking time (patient pays when booking)
        if (feeAmount > 0) {
            try {
                await db.query(`
                    INSERT INTO payments (appointment_id, patient_id, doctor_id, amount, payment_date, payment_method, status, created_by)
                    VALUES (?, ?, ?, ?, ?, 'Cash', 'Completed', ?)
                `, [result.insertId, finalPatientId, doctorId, feeAmount, formattedDate, req.user.id]);

                const [invCount] = await db.query('SELECT COUNT(*) as c FROM invoices');
                const invoiceNumber = `INV-${String(invCount[0].c + 1).padStart(6, '0')}`;
                await db.query(`
                    INSERT INTO invoices (invoice_number, appointment_id, patient_id, doctor_id, amount, invoice_date, status)
                    VALUES (?, ?, ?, ?, ?, ?, 'Generated')
                `, [invoiceNumber, result.insertId, finalPatientId, doctorId, feeAmount, formattedDate]);
            } catch (e) { /* ignore if payments/invoices tables missing */ }
        }

        // Get created appointment with details
        const [appointment] = await db.query(`
            SELECT a.*,
                   p.name as patient_name, p.mobile as patient_mobile, p.age as patient_age, p.gender as patient_gender,
                   d.name as doctor_name, d.specialization,
                   u.name as created_by_name, u.role as created_by_role
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN users u ON a.created_by = u.id
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

// Update appointment status
const updateAppointmentStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return errorResponse(res, 'Status is required', 400);
        }

        const validStatuses = ['Scheduled', 'Waiting', 'Completed', 'Cancelled'];
        if (!validStatuses.includes(status)) {
            return errorResponse(res, 'Invalid status', 400);
        }

        await db.query('UPDATE appointments SET status = ? WHERE id = ?', [status, id]);

        successResponse(res, { status }, 'Appointment status updated successfully');

    } catch (error) {
        console.error('Update Status Error:', error);
        errorResponse(res, 'Failed to update status', 500, error.message);
    }
};

// Get available doctors (for dropdown) - includes consultation_fee
const getAvailableDoctors = async (req, res) => {
    try {
        const [doctors] = await db.query(
            'SELECT id, name, specialization, COALESCE(consultation_fee, 0) as consultation_fee FROM doctors WHERE status = "Active" ORDER BY name'
        );

        successResponse(res, doctors, 'Doctors fetched successfully');

    } catch (error) {
        console.error('Get Doctors Error:', error);
        errorResponse(res, 'Failed to fetch doctors', 500, error.message);
    }
};

module.exports = {
    createAppointment,
    updateAppointmentStatus,
    getAvailableDoctors
};
