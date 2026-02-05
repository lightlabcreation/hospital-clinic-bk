// ====================================
// DOCTOR CONTROLLER
// ====================================
const db = require('../config/db');
const { successResponse, errorResponse, paginate } = require('../utils/response.helper');

// Helper function to get doctor ID from user
const getDoctorId = async (userId) => {
    const [doctors] = await db.query('SELECT id FROM doctors WHERE user_id = ?', [userId]);
    return doctors.length > 0 ? doctors[0].id : null;
};

// ====================================
// GET CURRENT DOCTOR PROFILE (for doctor self-booking)
// ====================================
const getCurrentDoctor = async (req, res) => {
    try {
        if (req.user.role !== 'DOCTOR') {
            return errorResponse(res, 'Doctor only', 403);
        }
        const [doctors] = await db.query(
            'SELECT id, name, specialization, COALESCE(consultation_fee, 0) as consultation_fee FROM doctors WHERE user_id = ?',
            [req.user.id]
        );
        if (doctors.length === 0) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }
        successResponse(res, doctors[0], 'Current doctor fetched successfully');
    } catch (error) {
        console.error('Get Current Doctor Error:', error);
        errorResponse(res, 'Failed to fetch doctor profile', 500, error.message);
    }
};

// ====================================
// DASHBOARD
// ====================================
const getDashboardStats = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        const today = new Date().toISOString().split('T')[0];

        // 1. Total Earnings (Completed Payments)
        const [earnings] = await db.query(
            'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE doctor_id = ? AND status = "Completed"',
            [doctorId]
        );

        // 2. All-time Total Appointments
        const [totalAppointments] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ?',
            [doctorId]
        );

        // 3. All-time Pending (Waiting)
        const [pendingCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND status = "Waiting"',
            [doctorId]
        );

        // 4. All-time Completed
        const [completedCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND status = "Completed"',
            [doctorId]
        );

        // 5. Today's Appointments (Keep for specific view if needed, or replace)
        const [todayCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
            [doctorId, today]
        );

        // Optional: Global clinic stats for context
        const [globalToday] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE appointment_date = ?',
            [today]
        );

        // Get next appointments (All for today, not just waiting, to avoid appearing empty if already completed)
        const [nextAppointments] = await db.query(`
            SELECT a.id, a.appointment_time as time, a.reason, a.status,
                   p.id as patient_id, p.name as patient, p.age, p.gender
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = ?
            ORDER BY a.status DESC, a.appointment_time ASC
            LIMIT 8
        `, [doctorId, today]);

        successResponse(res, {
            stats: {
                totalEarnings: earnings[0]?.total || 0,
                totalAppointments: totalAppointments[0]?.total || 0,
                pending: pendingCount[0]?.total || 0,
                completed: completedCount[0]?.total || 0,
                todayTotal: todayCount[0]?.total || 0,
                globalToday: globalToday[0]?.total || 0
            },
            nextAppointments: nextAppointments || []
        }, 'Dashboard data fetched successfully');

    } catch (error) {
        console.error('Doctor Dashboard Error:', error);
        errorResponse(res, 'Failed to fetch dashboard data', 500, error.message);
    }
};

// ====================================
// TODAY'S APPOINTMENTS
// ====================================
const getTodayAppointments = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        const { page = 1, limit = 10, search, status } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);
        const today = new Date().toISOString().split('T')[0];

        let query = `
            SELECT a.*,
                   p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile,
                   p.age as patient_age, p.gender as patient_gender
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = ?
        `;
        const params = [doctorId, today];

        if (search) {
            query += ` AND (p.name LIKE ?)`;
            params.push(`%${search}%`);
        }

        if (status && status !== 'All') {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        // Get total count
        const countQuery = query.replace(/SELECT a\.\*,[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
        const [countResult] = await db.query(countQuery, params);

        // Add pagination
        query += ` ORDER BY a.appointment_time ASC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [appointments] = await db.query(query, params);

        // Get total pending for today (regardless of pagination)
        const [pendingResult] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = "Waiting"',
            [doctorId, today]
        );

        successResponse(res, {
            appointments,
            total: countResult[0].total,
            pending: pendingResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Today appointments fetched successfully');

    } catch (error) {
        console.error('Get Today Appointments Error:', error);
        errorResponse(res, 'Failed to fetch appointments', 500, error.message);
    }
};

// ====================================
// GET APPOINTMENTS (with filters)
// ====================================
const getAppointments = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        const { date, status, search, page = 1, limit = 10 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        let query = `
            SELECT a.*,
                   p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile,
                   p.age as patient_age, p.gender as patient_gender,
                   d.name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.doctor_id = ?
        `;
        const params = [doctorId];

        if (date) {
            query += ` AND a.appointment_date = ?`;
            params.push(date);
        }

        if (status && status !== 'All') {
            query += ` AND a.status = ?`;
            params.push(status);
        }

        if (search) {
            query += ` AND p.name LIKE ?`;
            params.push(`%${search}%`);
        }

        // Get total count
        const countQuery = query.replace(/SELECT a\.\*,[\s\S]*?FROM/, 'SELECT COUNT(*) as total FROM');
        const [countResult] = await db.query(countQuery, params);

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC LIMIT ? OFFSET ?`;
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

// ====================================
// CONSULTATION - GET DATA
// ====================================
const getConsultationData = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        // For ADMIN and STAFF, allow access to any appointment. For DOCTOR, check doctor profile
        let doctorId = null;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
            doctorId = await getDoctorId(req.user.id);
            if (!doctorId) {
                return errorResponse(res, 'Doctor profile not found', 404);
            }
        }

        // Get appointment with patient details
        let query = `
            SELECT a.*,
                   p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile,
                   p.age as patient_age, p.gender as patient_gender, p.address, p.blood_group
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = ?
        `;
        const params = [appointmentId];

        // Only filter by doctor_id if not ADMIN
        if (doctorId) {
            query += ` AND a.doctor_id = ?`;
            params.push(doctorId);
        }

        const [appointments] = await db.query(query, params);

        if (appointments.length === 0) {
            return errorResponse(res, 'Appointment not found', 404);
        }

        const appointment = appointments[0];

        // Get patient's previous consultations (history)
        const [history] = await db.query(`
            SELECT c.*, a.appointment_date as date, a.appointment_time as time,
                   d.name as doctor_name
            FROM consultations c
            JOIN appointments a ON c.appointment_id = a.id
            JOIN doctors d ON c.doctor_id = d.id
            WHERE c.patient_id = ? AND c.id != (
                SELECT id FROM consultations WHERE appointment_id = ? LIMIT 1
            )
            ORDER BY a.appointment_date DESC, a.appointment_time DESC, c.id DESC
            LIMIT 10
        `, [appointment.patient_id, appointmentId]);

        // Get any existing consultation for this appointment
        const [existingConsultation] = await db.query(
            'SELECT * FROM consultations WHERE appointment_id = ?',
            [appointmentId]
        );

        // Get media files for existing consultation
        let mediaFiles = [];
        if (existingConsultation.length > 0 && existingConsultation[0].id) {
            const [media] = await db.query(
                'SELECT * FROM consultation_media WHERE consultation_id = ? ORDER BY id DESC',
                [existingConsultation[0].id]
            );
            mediaFiles = media;
        }

        successResponse(res, {
            patient: {
                id: appointment.patient_id,
                name: appointment.patient_name,
                mobile: appointment.patient_mobile,
                age: appointment.patient_age,
                gender: appointment.patient_gender,
                address: appointment.address,
                bloodGroup: appointment.blood_group
            },
            appointment: {
                id: appointment.id,
                date: appointment.appointment_date,
                time: appointment.appointment_time,
                reason: appointment.reason,
                status: appointment.status
            },
            history: history.map(h => ({
                id: h.id,
                date: h.date,
                visit: h.visit_number > 1 ? 'Follow-up' : 'Initial Consultation',
                doctor: h.doctor_name,
                notes: {
                    chiefComplaints: h.chief_complaints,
                    diagnosis: h.diagnosis,
                    treatmentPlan: h.treatment_plan
                }
            })),
            existingConsultation: existingConsultation[0] || null,
            mediaFiles: mediaFiles
        }, 'Consultation data fetched successfully');

    } catch (error) {
        console.error('Get Consultation Data Error:', error);
        errorResponse(res, 'Failed to fetch consultation data', 500, error.message);
    }
};

// ====================================
// CONSULTATION - SAVE/FINALIZE
// ====================================
const saveConsultation = async (req, res) => {
    try {
        const { appointmentId } = req.params;

        // For ADMIN and STAFF, allow access to any appointment. For DOCTOR, check doctor profile
        let doctorId = null;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
            doctorId = await getDoctorId(req.user.id);
            if (!doctorId) {
                return errorResponse(res, 'Doctor profile not found', 404);
            }
        }

        const {
            chiefComplaints,
            comorbidities,
            imagingFindings,
            diagnosis,
            treatmentPlan,
            followUpNotes,
            vitals
        } = req.body;

        // Get appointment details - for ADMIN and STAFF, get appointment without doctor_id check
        let query = 'SELECT patient_id, doctor_id FROM appointments WHERE id = ?';
        const params = [appointmentId];

        if (doctorId) {
            query += ' AND doctor_id = ?';
            params.push(doctorId);
        }

        const [appointments] = await db.query(query, params);

        if (appointments.length === 0) {
            return errorResponse(res, 'Appointment not found', 404);
        }

        const patientId = appointments[0].patient_id;
        // For ADMIN, use doctor_id from appointment. For DOCTOR, use their own doctor_id
        const finalDoctorId = doctorId || appointments[0].doctor_id;

        // Get visit number
        const [visitCount] = await db.query(
            'SELECT COUNT(*) as count FROM consultations WHERE patient_id = ?',
            [patientId]
        );
        const visitNumber = visitCount[0].count + 1;

        // Check if consultation exists for this appointment
        const [existing] = await db.query(
            'SELECT id FROM consultations WHERE appointment_id = ?',
            [appointmentId]
        );

        let consultationId;

        if (existing.length > 0) {
            // Update existing consultation
            await db.query(`
                UPDATE consultations SET
                    chief_complaints = ?,
                    comorbidities = ?,
                    imaging_findings = ?,
                    diagnosis = ?,
                    treatment_plan = ?,
                    follow_up_notes = ?,
                    vitals = ?
                WHERE id = ?
            `, [
                chiefComplaints,
                comorbidities,
                imagingFindings,
                diagnosis,
                treatmentPlan,
                followUpNotes,
                JSON.stringify(vitals),
                existing[0].id
            ]);
            consultationId = existing[0].id;
        } else {
            // Create new consultation
            const [result] = await db.query(`
                INSERT INTO consultations
                (appointment_id, patient_id, doctor_id, visit_number,
                 chief_complaints, comorbidities, imaging_findings,
                 diagnosis, treatment_plan, follow_up_notes, vitals)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                appointmentId,
                patientId,
                finalDoctorId,
                visitNumber,
                chiefComplaints,
                comorbidities,
                imagingFindings,
                diagnosis,
                treatmentPlan,
                followUpNotes,
                JSON.stringify(vitals)
            ]);
            consultationId = result.insertId;
        }

        // Mark appointment as completed
        const [aptForFee] = await db.query('SELECT fee, appointment_date FROM appointments WHERE id = ?', [appointmentId]);
        await db.query(
            'UPDATE appointments SET status = "Completed" WHERE id = ?',
            [appointmentId]
        );

        // Create payment record if appointment has fee
        if (aptForFee[0]?.fee > 0) {
            try {
                const [existing] = await db.query('SELECT id FROM payments WHERE appointment_id = ?', [appointmentId]);
                if (existing.length === 0) {
                    await db.query(`
                        INSERT INTO payments (appointment_id, patient_id, doctor_id, amount, payment_date, payment_method, status, created_by)
                        VALUES (?, ?, ?, ?, ?, 'Cash', 'Completed', ?)
                    `, [appointmentId, patientId, finalDoctorId, aptForFee[0].fee, aptForFee[0].appointment_date, req.user?.id]);
                }
            } catch (e) { /* ignore if payments table doesn't exist */ }
        }

        // Update patient's last visit
        await db.query(
            'UPDATE patients SET last_visit = CURRENT_DATE WHERE id = ?',
            [patientId]
        );

        // Get saved consultation
        const [consultation] = await db.query(
            'SELECT * FROM consultations WHERE id = ?',
            [consultationId]
        );

        successResponse(res, {
            consultation: consultation[0]
        }, 'Consultation saved successfully');

    } catch (error) {
        console.error('Save Consultation Error:', error);
        errorResponse(res, 'Failed to save consultation', 500, error.message);
    }
};

// ====================================
// CONSULTATION - GET MEDIA FILES
// ====================================
const getConsultationMedia = async (req, res) => {
    try {
        const { consultationId } = req.params;

        const [mediaFiles] = await db.query(
            'SELECT * FROM consultation_media WHERE consultation_id = ? ORDER BY uploaded_at DESC, id DESC',
            [consultationId]
        );

        successResponse(res, mediaFiles, 'Media files fetched successfully');

    } catch (error) {
        console.error('Get Consultation Media Error:', error);
        errorResponse(res, 'Failed to fetch media files', 500, error.message);
    }
};

// ====================================
// CONSULTATION - UPLOAD MEDIA
// ====================================
const uploadConsultationMedia = async (req, res) => {
    try {
        const { consultationId } = req.params;
        const doctorId = await getDoctorId(req.user.id);

        if (!req.file) {
            return errorResponse(res, 'No file uploaded', 400);
        }

        // Get patient ID from consultation
        const [consultation] = await db.query(
            'SELECT patient_id FROM consultations WHERE id = ?',
            [consultationId]
        );

        if (consultation.length === 0) {
            return errorResponse(res, 'Consultation not found', 404);
        }

        // Determine correct file path based on file type (matches upload middleware)
        const folder = req.file.mimetype.startsWith('image/') ? 'images' :
            req.file.mimetype === 'application/pdf' ? 'documents' : 'others';
        const fileUrl = `/uploads/${folder}/${req.file.filename}`;
        const fileType = req.file.mimetype.includes('pdf') ? 'PDF' : 'IMAGE';

        const [result] = await db.query(`
            INSERT INTO consultation_media
            (consultation_id, patient_id, file_name, file_type, file_url, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [consultationId, consultation[0].patient_id, req.file.originalname, fileType, fileUrl, req.user.id]);

        // Get the inserted record
        const [insertedFile] = await db.query(
            'SELECT * FROM consultation_media WHERE id = ?',
            [result.insertId]
        );

        successResponse(res, {
            id: result.insertId,
            fileId: result.insertId,
            file_url: fileUrl,
            fileUrl: fileUrl,
            file_name: req.file.originalname,
            fileName: req.file.originalname,
            file_type: fileType,
            fileType: fileType,
            consultation_id: consultationId,
            ...insertedFile[0]
        }, 'File uploaded successfully');

    } catch (error) {
        console.error('Upload Media Error:', error);
        errorResponse(res, 'Failed to upload file', 500, error.message);
    }
};

// ====================================
// PATIENT HISTORY
// ====================================
const getPatientHistory = async (req, res) => {
    try {
        // For ADMIN and STAFF, allow access to all patients. For DOCTOR, check doctor profile
        let doctorId = null;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
            doctorId = await getDoctorId(req.user.id);
            if (!doctorId) {
                return errorResponse(res, 'Doctor profile not found', 404);
            }
        }

        const { search, mobile, page = 1, limit = 20 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        // Get patients - for ADMIN show all, for DOCTOR show only their patients
        let query = `
            SELECT DISTINCT p.*,
                   (SELECT diagnosis FROM consultations WHERE patient_id = p.id ORDER BY id DESC LIMIT 1) as lastCondition,
                   (SELECT COUNT(*) FROM consultations WHERE patient_id = p.id${doctorId ? ' AND doctor_id = ?' : ''}) as totalVisits,
                   (SELECT MAX(id) FROM consultations WHERE patient_id = p.id) as lastVisitDate
            FROM patients p
        `;
        const params = [];

        // For totalVisits subquery, add doctorId param if needed
        if (doctorId) {
            // We'll need to handle this in the subquery separately
            query = `
                SELECT DISTINCT p.*,
                       (SELECT diagnosis FROM consultations WHERE patient_id = p.id ORDER BY id DESC LIMIT 1) as lastCondition,
                       (SELECT COUNT(*) FROM consultations WHERE patient_id = p.id AND doctor_id = ?) as totalVisits,
                       (SELECT MAX(id) FROM consultations WHERE patient_id = p.id) as lastVisitDate
                FROM patients p
            `;
            params.push(doctorId);
        }

        // Join consultations only if not ADMIN or if searching by doctor
        if (doctorId) {
            query += ` JOIN consultations c ON p.id = c.patient_id WHERE c.doctor_id = ?`;
            params.push(doctorId);
        } else {
            query += ` LEFT JOIN consultations c ON p.id = c.patient_id WHERE 1=1`;
        }

        // Add mobile filter if provided
        if (mobile) {
            query += ` AND p.mobile = ?`;
            params.push(mobile);
        }

        // Add search filter if provided
        if (search) {
            query += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }

        // Get total count
        let countQuery = query.replace('SELECT DISTINCT p.*, (SELECT diagnosis FROM consultations WHERE patient_id = p.id ORDER BY id DESC LIMIT 1) as lastCondition, (SELECT COUNT(*) FROM consultations WHERE patient_id = p.id' + (doctorId ? ' AND doctor_id = ?' : '') + ') as totalVisits, (SELECT MAX(id) FROM consultations WHERE patient_id = p.id) as lastVisitDate', 'SELECT COUNT(DISTINCT p.id) as total');

        // Clean up the count query specifically to avoid subquery complications if they were in the select list
        // A safer way is to use the FROM clause and WHERE clause parts of the original query
        // But since we built the query dynamically, let's reconstruct a simpler count query

        let simpleCountQuery = `SELECT COUNT(DISTINCT p.id) as total FROM patients p`;
        const simpleCountParams = [];

        if (doctorId) {
            simpleCountQuery += ` JOIN consultations c ON p.id = c.patient_id WHERE c.doctor_id = ?`;
            simpleCountParams.push(doctorId);
        } else {
            simpleCountQuery += ` LEFT JOIN consultations c ON p.id = c.patient_id WHERE 1=1`;
        }

        if (mobile) {
            simpleCountQuery += ` AND p.mobile = ?`;
            simpleCountParams.push(mobile);
        }

        if (search) {
            simpleCountQuery += ` AND (p.name LIKE ? OR p.mobile LIKE ?)`;
            simpleCountParams.push(`%${search}%`, `%${search}%`);
        }

        const [countResult] = await db.query(simpleCountQuery, simpleCountParams);


        query += ` ORDER BY lastVisitDate DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [patients] = await db.query(query, params);

        // Get latest appointment ID for each patient
        const patientsWithAppointments = await Promise.all(
            patients.map(async (patient) => {
                let appointmentQuery = `
                    SELECT a.id as appointment_id
                    FROM appointments a
                    WHERE a.patient_id = ?
                `;
                const appointmentParams = [patient.id];

                if (doctorId) {
                    appointmentQuery += ` AND a.doctor_id = ?`;
                    appointmentParams.push(doctorId);
                }

                appointmentQuery += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 1`;

                const [appointments] = await db.query(appointmentQuery, appointmentParams);
                return {
                    ...patient,
                    latestAppointmentId: appointments[0]?.appointment_id || null
                };
            })
        );

        successResponse(res, {
            patients: patientsWithAppointments,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Patient history fetched successfully');

    } catch (error) {
        console.error('Get Patient History Error:', error);
        errorResponse(res, 'Failed to fetch patient history', 500, error.message);
    }
};

// ====================================
// PATIENT FULL HISTORY
// ====================================
const getPatientFullHistory = async (req, res) => {
    try {
        const { patientId } = req.params;

        // Get patient details
        const [patients] = await db.query('SELECT * FROM patients WHERE id = ?', [patientId]);

        if (patients.length === 0) {
            return errorResponse(res, 'Patient not found', 404);
        }

        // Get all consultations
        const [consultations] = await db.query(`
            SELECT c.*, a.appointment_date, a.appointment_time, a.reason,
                   d.name as doctor_name, d.specialization
            FROM consultations c
            JOIN appointments a ON c.appointment_id = a.id
            JOIN doctors d ON c.doctor_id = d.id
            WHERE c.patient_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC, c.id DESC
        `, [patientId]);

        successResponse(res, {
            patient: patients[0],
            consultations
        }, 'Patient full history fetched successfully');

    } catch (error) {
        console.error('Get Full History Error:', error);
        errorResponse(res, 'Failed to fetch full history', 500, error.message);
    }
};

// ====================================
// REPORTS & IMAGES
// ====================================
const getReports = async (req, res) => {
    try {
        const { patientId, page = 1, limit = 10 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        // For ADMIN and STAFF, allow access to all reports. For DOCTOR, check doctor profile
        let doctorId = null;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
            doctorId = await getDoctorId(req.user.id);
            if (!doctorId) {
                return errorResponse(res, 'Doctor profile not found', 404);
            }
        }

        let query = `
            SELECT cm.*, p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile
            FROM consultation_media cm
            JOIN patients p ON cm.patient_id = p.id
            WHERE 1=1
        `;
        const params = [];

        if (patientId) {
            query += ` AND cm.patient_id = ?`;
            params.push(patientId);
        }

        // Filter by doctor's patients if not ADMIN/STAFF
        if (doctorId) {
            query += ` AND EXISTS (
                SELECT 1 FROM appointments a 
                JOIN consultations c ON a.id = c.appointment_id 
                WHERE a.patient_id = cm.patient_id AND c.doctor_id = ?
            )`;
            params.push(doctorId);
        }

        // Get total count
        const countQuery = query.replace('SELECT cm.*, p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile', 'SELECT COUNT(*) as total');
        const [countResult] = await db.query(countQuery, params);

        query += ` ORDER BY cm.uploaded_at DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [reports] = await db.query(query, params);

        successResponse(res, {
            reports,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Reports fetched successfully');

    } catch (error) {
        console.error('Get Reports Error:', error);
        errorResponse(res, 'Failed to fetch reports', 500, error.message);
    }
};

const uploadReport = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const { patientId, reportType, visitId, description } = req.body;

        if (!req.file) {
            return errorResponse(res, 'No file uploaded', 400);
        }

        const folder = req.file.mimetype.includes('pdf') ? 'documents' : 'images';
        const fileUrl = `/uploads/${folder}/${req.file.filename}`;

        const [result] = await db.query(`
            INSERT INTO consultation_media
            (patient_id, file_name, file_type, file_url, description, visit_id, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [patientId, req.file.originalname, reportType || 'Other', fileUrl, description, visitId, req.user.id]);

        const [report] = await db.query('SELECT * FROM consultation_media WHERE id = ?', [result.insertId]);

        successResponse(res, report[0], 'Report uploaded successfully');

    } catch (error) {
        console.error('Upload Report Error:', error);
        errorResponse(res, 'Failed to upload report', 500, error.message);
    }
};

const downloadReport = async (req, res) => {
    try {
        const { id } = req.params;
        const fs = require('fs');
        const path = require('path');

        // Get report from database
        const [reports] = await db.query('SELECT * FROM consultation_media WHERE id = ?', [id]);

        if (reports.length === 0) {
            return errorResponse(res, 'Report not found', 404);
        }

        const report = reports[0];

        // Check if user has access (for DOCTOR role, verify they have access to this patient)
        if (req.user.role === 'DOCTOR') {
            const doctorId = await getDoctorId(req.user.id);
            if (doctorId) {
                const [accessCheck] = await db.query(`
                    SELECT 1 FROM appointments a 
                    JOIN consultations c ON a.id = c.appointment_id 
                    WHERE a.patient_id = ? AND c.doctor_id = ?
                `, [report.patient_id, doctorId]);

                if (accessCheck.length === 0) {
                    return errorResponse(res, 'Access denied', 403);
                }
            }
        }

        // Construct file path - handle both /uploads/... and direct paths
        let fileRelativePath = report.file_url;
        if (fileRelativePath.startsWith('/uploads/')) {
            fileRelativePath = fileRelativePath.replace('/uploads/', '');
        } else if (fileRelativePath.startsWith('uploads/')) {
            fileRelativePath = fileRelativePath.replace('uploads/', '');
        }

        // Use process.cwd() for absolute path to project root
        const filePath = path.join(process.cwd(), 'uploads', fileRelativePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found at path:', filePath);
            console.error('Current Working Directory:', process.cwd());
            return errorResponse(res, 'File not found on server. This can happen if the server was restarted and files were not persisted.', 404);
        }

        // Set headers for download with proper content type
        const fileName = report.file_name || 'report';
        const fileExt = path.extname(fileName).toLowerCase();

        // Determine content type based on file extension
        let contentType = 'application/octet-stream';
        if (fileExt === '.pdf') {
            contentType = 'application/pdf';
        } else if (['.jpg', '.jpeg'].includes(fileExt)) {
            contentType = 'image/jpeg';
        } else if (fileExt === '.png') {
            contentType = 'image/png';
        } else if (fileExt === '.gif') {
            contentType = 'image/gif';
        } else if (fileExt === '.webp') {
            contentType = 'image/webp';
        }

        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader('Content-Type', contentType);

        // Send file
        res.sendFile(path.resolve(filePath));

    } catch (error) {
        console.error('Download Report Error:', error);
        errorResponse(res, 'Failed to download report', 500, error.message);
    }
};

const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;

        await db.query('DELETE FROM consultation_media WHERE id = ?', [id]);

        successResponse(res, null, 'Report deleted successfully');

    } catch (error) {
        console.error('Delete Report Error:', error);
        errorResponse(res, 'Failed to delete report', 500, error.message);
    }
};

// ====================================
// CONSULTATION - DELETE MEDIA
// ====================================
// ====================================
// CONSULTATION - GET MEDIA FILE (AUTHENTICATED)
// ====================================
const getConsultationMediaFile = async (req, res) => {
    try {
        const { consultationId, mediaId } = req.params;
        const fs = require('fs');
        const path = require('path');

        // Get media file from database
        const [mediaFiles] = await db.query(
            'SELECT * FROM consultation_media WHERE id = ? AND consultation_id = ?',
            [mediaId, consultationId]
        );

        if (mediaFiles.length === 0) {
            return errorResponse(res, 'Media file not found', 404);
        }

        const mediaFile = mediaFiles[0];

        // Verify user has access to this consultation
        const doctorId = await getDoctorId(req.user.id);
        const [consultation] = await db.query(
            'SELECT * FROM consultations WHERE id = ?',
            [consultationId]
        );

        if (consultation.length === 0) {
            return errorResponse(res, 'Consultation not found', 404);
        }

        // For DOCTOR role, verify they have access to this consultation
        if (req.user.role === 'DOCTOR' && doctorId) {
            if (consultation[0].doctor_id !== doctorId) {
                return errorResponse(res, 'Access denied', 403);
            }
        }

        // Construct file path
        let fileRelativePath = mediaFile.file_url;
        if (fileRelativePath.startsWith('/uploads/')) {
            fileRelativePath = fileRelativePath.replace('/uploads/', '');
        } else if (fileRelativePath.startsWith('uploads/')) {
            fileRelativePath = fileRelativePath.replace('uploads/', '');
        }

        const filePath = path.join(process.cwd(), 'uploads', fileRelativePath);

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            console.error('File not found at path:', filePath);
            return errorResponse(res, 'File not found on server', 404);
        }

        // Determine content type
        const contentType = mediaFile.file_type === 'PDF'
            ? 'application/pdf'
            : 'image/jpeg'; // Default to jpeg for images

        // Set headers and send file
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${mediaFile.file_name}"`);
        res.sendFile(filePath);

    } catch (error) {
        console.error('Get Consultation Media File Error:', error);
        errorResponse(res, 'Failed to fetch media file', 500, error.message);
    }
};

const deleteConsultationMedia = async (req, res) => {
    try {
        const { consultationId, mediaId } = req.params;
        const doctorId = await getDoctorId(req.user.id);

        // Verify consultation belongs to doctor
        const [consultation] = await db.query(
            'SELECT * FROM consultations WHERE id = ? AND doctor_id = ?',
            [consultationId, doctorId]
        );

        if (consultation.length === 0) {
            return errorResponse(res, 'Consultation not found or access denied', 404);
        }

        // Delete media file
        await db.query('DELETE FROM consultation_media WHERE id = ? AND consultation_id = ?', [mediaId, consultationId]);

        successResponse(res, null, 'Media file deleted successfully');

    } catch (error) {
        console.error('Delete Consultation Media Error:', error);
        errorResponse(res, 'Failed to delete media file', 500, error.message);
    }
};

// ====================================
// TEMPLATES
// ====================================
const getTemplates = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const { fieldType } = req.query;

        let query = 'SELECT * FROM templates WHERE doctor_id = ?';
        const params = [doctorId];

        if (fieldType) {
            query += ' AND field_type = ?';
            params.push(fieldType);
        }

        query += ' ORDER BY id DESC';

        const [templates] = await db.query(query, params);

        successResponse(res, { templates }, 'Templates fetched successfully');

    } catch (error) {
        console.error('Get Templates Error:', error);
        errorResponse(res, 'Failed to fetch templates', 500, error.message);
    }
};

const addTemplate = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);
        const { fieldType, name, content } = req.body;

        if (!fieldType || !name || !content) {
            return errorResponse(res, 'Field type, name and content are required', 400);
        }

        const [result] = await db.query(
            'INSERT INTO templates (doctor_id, field_type, name, content) VALUES (?, ?, ?, ?)',
            [doctorId, fieldType, name, content]
        );

        const [template] = await db.query('SELECT * FROM templates WHERE id = ?', [result.insertId]);

        successResponse(res, template[0], 'Template added successfully', 201);

    } catch (error) {
        console.error('Add Template Error:', error);
        errorResponse(res, 'Failed to add template', 500, error.message);
    }
};

const deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const doctorId = await getDoctorId(req.user.id);

        await db.query('DELETE FROM templates WHERE id = ? AND doctor_id = ?', [id, doctorId]);

        successResponse(res, null, 'Template deleted successfully');

    } catch (error) {
        console.error('Delete Template Error:', error);
        errorResponse(res, 'Failed to delete template', 500, error.message);
    }
};

// ====================================
// GET RECENT CONSULTATIONS (for print selection)
// ====================================
const getRecentConsultations = async (req, res) => {
    try {
        // For ADMIN and STAFF, allow access to all consultations. For DOCTOR, check doctor profile
        let doctorId = null;
        if (req.user.role !== 'ADMIN' && req.user.role !== 'STAFF') {
            doctorId = await getDoctorId(req.user.id);
            if (!doctorId) {
                return errorResponse(res, 'Doctor profile not found', 404);
            }
        }

        const { limit = 50 } = req.query;

        // Get recent consultations with patient and appointment details
        let query = `
            SELECT c.id as consultation_id, c.created_at,
                   a.id as appointment_id, a.appointment_date, a.appointment_time, a.reason,
                   p.id as patient_id, p.name as patient_name, p.age as patient_age, p.gender as patient_gender,
                   d.name as doctor_name, d.specialization
            FROM consultations c
            JOIN appointments a ON c.appointment_id = a.id
            JOIN patients p ON c.patient_id = p.id
            JOIN doctors d ON c.doctor_id = d.id
            WHERE 1=1
        `;
        const params = [];

        // Filter by doctor_id if not ADMIN/STAFF
        if (doctorId) {
            query += ` AND c.doctor_id = ?`;
            params.push(doctorId);
        }

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time DESC, c.id DESC LIMIT ?`;
        params.push(parseInt(limit));

        const [consultations] = await db.query(query, params);

        successResponse(res, {
            consultations: consultations.map(c => ({
                id: c.consultation_id,
                appointmentId: c.appointment_id,
                patientName: c.patient_name,
                patientAge: c.patient_age,
                patientGender: c.patient_gender,
                doctorName: c.doctor_name,
                date: c.appointment_date,
                time: c.appointment_time,
                reason: c.reason,
                createdAt: c.created_at
            }))
        }, 'Recent consultations fetched successfully');

    } catch (error) {
        console.error('Get Recent Consultations Error:', error);
        errorResponse(res, 'Failed to fetch consultations', 500, error.message);
    }
};

// ====================================
// PRINT CONSULTATION
// ====================================


// ====================================
// UPDATE PRINT PREFERENCES
// ====================================
const updatePrintPreferences = async (req, res) => {
    try {
        const {
            header_margin_top,
            header_margin_bottom,
            footer_margin_top,
            footer_margin_bottom,
            page_margin_left,
            page_margin_right,
            header_padding_top,
            header_padding_bottom,
            footer_padding_top,
            footer_padding_bottom,
            content_spacing,
            section_spacing
        } = req.body;

        // Build dynamic update query - only print preferences
        const updateFields = []
        const updateValues = []

        // Print layout preferences only
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
        if (header_padding_top !== undefined) {
            updateFields.push('header_padding_top = ?')
            updateValues.push(header_padding_top)
        }
        if (header_padding_bottom !== undefined) {
            updateFields.push('header_padding_bottom = ?')
            updateValues.push(header_padding_bottom)
        }
        if (footer_padding_top !== undefined) {
            updateFields.push('footer_padding_top = ?')
            updateValues.push(footer_padding_top)
        }
        if (footer_padding_bottom !== undefined) {
            updateFields.push('footer_padding_bottom = ?')
            updateValues.push(footer_padding_bottom)
        }
        if (content_spacing !== undefined) {
            updateFields.push('content_spacing = ?')
            updateValues.push(content_spacing)
        }
        if (section_spacing !== undefined) {
            updateFields.push('section_spacing = ?')
            updateValues.push(section_spacing)
        }

        if (updateFields.length === 0) {
            return errorResponse(res, 'No print preferences to update', 400);
        }

        updateValues.push(1) // WHERE id = 1

        await db.query(
            `UPDATE clinic_settings SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        const [settings] = await db.query('SELECT * FROM clinic_settings LIMIT 1');

        successResponse(res, settings[0], 'Print preferences updated successfully');

    } catch (error) {
        console.error('Update Print Preferences Error:', error);
        errorResponse(res, 'Failed to update print preferences', 500, error.message);
    }
};

// ====================================
// SPEECH TRANSCRIPTION (Optional - for backend processing)
// ====================================
const transcribeSpeech = async (req, res) => {
    try {
        // This endpoint can be used for backend speech transcription
        // For now, it accepts text from frontend Web Speech API
        // Can be extended to use services like Google Cloud Speech-to-Text, AWS Transcribe, etc.

        const { text, language = 'en-US' } = req.body;

        if (!text) {
            return errorResponse(res, 'Text is required', 400);
        }

        // For now, just return the text (frontend Web Speech API handles transcription)
        // In production, you could:
        // 1. Accept audio file/stream
        // 2. Send to Google Cloud Speech-to-Text, AWS Transcribe, or Azure Speech Services
        // 3. Return transcribed text

        successResponse(res, {
            transcribedText: text,
            language: language,
            confidence: 1.0
        }, 'Speech transcribed successfully');

    } catch (error) {
        console.error('Speech Transcription Error:', error);
        errorResponse(res, 'Failed to transcribe speech', 500, error.message);
    }
};

// ====================================
// GET ALL PATIENTS (for print selection)
// ====================================
const getAllPatients = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        // Get all patients who have had appointments with this doctor
        const [patients] = await db.query(`
            SELECT 
                p.id,
                p.name,
                p.mobile,
                p.age,
                p.gender,
                p.created_at as registered_date,
                MAX(a.appointment_date) as last_appointment_date,
                COUNT(a.id) as total_visits,
                (
                    SELECT c.diagnosis 
                    FROM consultations c 
                    INNER JOIN appointments a2 ON c.appointment_id = a2.id 
                    WHERE a2.patient_id = p.id AND a2.doctor_id = ?
                    ORDER BY a2.appointment_date DESC, a2.appointment_time DESC 
                    LIMIT 1
                ) as last_condition,
                (
                    SELECT a3.id 
                    FROM appointments a3 
                    WHERE a3.patient_id = p.id AND a3.doctor_id = ?
                    ORDER BY a3.appointment_date DESC, a3.appointment_time DESC 
                    LIMIT 1
                ) as latest_appointment_id
            FROM patients p
            INNER JOIN appointments a ON p.id = a.patient_id
            WHERE a.doctor_id = ?
            GROUP BY p.id, p.name, p.mobile, p.age, p.gender, p.created_at
            ORDER BY MAX(a.appointment_date) DESC
        `, [doctorId, doctorId, doctorId]);

        successResponse(res, { patients }, 'Patients fetched successfully');

    } catch (error) {
        console.error('Get All Patients Error:', error);
        errorResponse(res, 'Failed to fetch patients', 500, error.message);
    }
};

// ====================================
// GET PRINT DATA (by consultation ID)
// ====================================
const getPrintData = async (req, res) => {
    try {
        const { consultationId } = req.params;
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        // Get consultation data with all related information
        const [consultations] = await db.query(`
            SELECT c.*, a.appointment_date, a.appointment_time, a.fee,
                   p.name as patient_name, p.age as patient_age, p.gender as patient_gender, 
                   p.mobile as patient_mobile, p.address as patient_address,
                   d.name as doctor_name, d.specialization as doctor_specialization
            FROM consultations c
            INNER JOIN appointments a ON c.appointment_id = a.id
            INNER JOIN patients p ON a.patient_id = p.id
            INNER JOIN doctors d ON a.doctor_id = d.id
            WHERE c.id = ? AND a.doctor_id = ?
            LIMIT 1
        `, [consultationId, doctorId]);

        if (consultations.length === 0) {
            return errorResponse(res, 'Consultation not found', 404);
        }

        const consultation = consultations[0];

        // Get clinic settings for print preferences
        const [clinicSettings] = await db.query(`
            SELECT * FROM clinic_settings LIMIT 1
        `);

        successResponse(res, {
            clinic: clinicSettings[0] || {},
            doctor: {
                name: consultation.doctor_name,
                specialization: consultation.doctor_specialization
            },
            patient: {
                name: consultation.patient_name,
                age: consultation.patient_age,
                gender: consultation.patient_gender,
                mobile: consultation.patient_mobile,
                address: consultation.patient_address
            },
            date: consultation.appointment_date,
            time: consultation.appointment_time,
            fee: consultation.fee,
            consultation: {
                symptoms: consultation.symptoms,
                diagnosis: consultation.diagnosis,
                prescription: consultation.prescription,
                advice: consultation.advice,
                follow_up_date: consultation.follow_up_date
            }
        }, 'Print data fetched successfully');

    } catch (error) {
        console.error('Get Print Data Error:', error);
        errorResponse(res, 'Failed to fetch print data', 500, error.message);
    }
};

// ====================================
// GET PRINT DATA BY PATIENT ID (latest consultation)
// ====================================
// ====================================
// GET PRINT DATA BY PATIENT ID (latest consultation or appointment)
// ====================================
const getPrintDataByPatient = async (req, res) => {
    try {
        const { patientId } = req.params;
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        // Get the latest appointment for this patient with this doctor
        // LEFT JOIN consultation to get data if it exists, otherwise just appointment info
        const [records] = await db.query(`
            SELECT a.id as appointment_id, a.appointment_date, a.appointment_time, a.fee, a.reason,
                   c.id as consultation_id, c.chief_complaints, c.diagnosis, c.treatment_plan, 
                   c.imaging_findings, c.comorbidities, c.follow_up_notes,
                   p.name as patient_name, p.age as patient_age, p.gender as patient_gender, 
                   p.mobile as patient_mobile, p.address as patient_address,
                   d.name as doctor_name, d.specialization as doctor_specialization
            FROM appointments a
            INNER JOIN patients p ON a.patient_id = p.id
            INNER JOIN doctors d ON a.doctor_id = d.id
            LEFT JOIN consultations c ON c.appointment_id = a.id
            WHERE p.id = ? AND a.doctor_id = ?
            ORDER BY a.appointment_date DESC, a.appointment_time DESC
            LIMIT 1
        `, [patientId, doctorId]);

        if (records.length === 0) {
            return errorResponse(res, 'No appointment found for this patient', 404);
        }

        const record = records[0];

        // Get clinic settings for print preferences
        const [clinicSettings] = await db.query(`
            SELECT * FROM clinic_settings LIMIT 1
        `);

        successResponse(res, {
            clinic: clinicSettings[0] || {},
            doctor: {
                name: record.doctor_name,
                specialization: record.doctor_specialization
            },
            patient: {
                name: record.patient_name,
                age: record.patient_age,
                gender: record.patient_gender,
                mobile: record.patient_mobile,
                address: record.patient_address
            },
            date: record.appointment_date,
            time: record.appointment_time,
            fee: record.fee,
            consultation: {
                chiefComplaints: record.chief_complaints || record.reason || '',
                diagnosis: record.diagnosis || '',
                prescription: record.treatment_plan || '',
                followUpNotes: record.follow_up_notes || '',
                follow_up_date: '',
                imagingFindings: record.imaging_findings || '',
                comorbidities: record.comorbidities || '',
                treatmentPlan: record.treatment_plan || ''
            }
        }, 'Print data fetched successfully');

    } catch (error) {
        console.error('Get Print Data By Patient Error:', error);
        errorResponse(res, 'Failed to fetch print data', 500, error.message);
    }
};

// ====================================
// GET PAYMENTS (for doctor)
// ====================================
const getPayments = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        const { page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        // Get total amount
        const [totalResult] = await db.query(
            'SELECT SUM(amount) as total FROM payments WHERE doctor_id = ? AND status = "Completed"',
            [doctorId]
        );

        // Get payments list
        const [payments] = await db.query(`
            SELECT p.*, 
                   pt.name as patient_name,
                   d.name as doctor_name
            FROM payments p
            JOIN patients pt ON p.patient_id = pt.id
            JOIN doctors d ON p.doctor_id = d.id
            WHERE p.doctor_id = ?
            ORDER BY p.payment_date DESC, p.id DESC
            LIMIT ? OFFSET ?
        `, [doctorId, parseInt(limit), parseInt(offset)]);

        // Convert db format to frontend format (if needed, but looks standard)
        // Frontend expects { records: [...], totalAmount: ... }

        successResponse(res, {
            records: payments.map(p => ({
                id: p.id,
                invoice_number: `INV-${String(p.id).padStart(5, '0')}`,
                patient_name: p.patient_name,
                doctor_name: p.doctor_name,
                appointment_id: p.appointment_id,
                amount: p.amount,
                payment_date: p.payment_date,
                status: p.status,
                payment_method: p.payment_method
            })),
            totalAmount: totalResult[0]?.total || 0
        }, 'Payments fetched successfully');

    } catch (error) {
        console.error('Get Payments Error:', error);
        errorResponse(res, 'Failed to fetch payments', 500, error.message);
    }
};

module.exports = {
    getCurrentDoctor,
    getDashboardStats,
    getTodayAppointments,
    getAppointments,
    getPayments,
    getConsultationData,
    saveConsultation,
    getConsultationMedia,
    getConsultationMediaFile,
    uploadConsultationMedia,
    deleteConsultationMedia,
    getAllPatients,
    getPatientHistory,
    getPatientFullHistory,
    getReports,
    uploadReport,
    downloadReport,
    deleteReport,
    getTemplates,
    addTemplate,
    deleteTemplate,
    getRecentConsultations,
    getPrintData,
    getPrintDataByPatient,
    updatePrintPreferences,
    transcribeSpeech
};
