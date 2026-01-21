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
// DASHBOARD
// ====================================
const getDashboardStats = async (req, res) => {
    try {
        const doctorId = await getDoctorId(req.user.id);

        if (!doctorId) {
            return errorResponse(res, 'Doctor profile not found', 404);
        }

        const today = new Date().toISOString().split('T')[0];

        // Get today's total appointments
        const [totalAppointments] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND appointment_date = ?',
            [doctorId, today]
        );

        // Get pending (waiting) count
        const [pendingCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = "Waiting"',
            [doctorId, today]
        );

        // Get completed count
        const [completedCount] = await db.query(
            'SELECT COUNT(*) as total FROM appointments WHERE doctor_id = ? AND appointment_date = ? AND status = "Completed"',
            [doctorId, today]
        );

        // Get next appointments (waiting only)
        const [nextAppointments] = await db.query(`
            SELECT a.id, a.appointment_time as time, a.reason, a.status,
                   p.id as patient_id, p.name as patient, p.age, p.gender
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = ? AND a.status = 'Waiting'
            ORDER BY a.appointment_time ASC
            LIMIT 5
        `, [doctorId, today]);

        successResponse(res, {
            stats: {
                todayTotal: totalAppointments[0].total,
                pending: pendingCount[0].total,
                completed: completedCount[0].total
            },
            nextAppointments
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

        const today = new Date().toISOString().split('T')[0];

        const [appointments] = await db.query(`
            SELECT a.*,
                   p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile,
                   p.age as patient_age, p.gender as patient_gender
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            WHERE a.doctor_id = ? AND a.appointment_date = ?
            ORDER BY a.appointment_time ASC
        `, [doctorId, today]);

        // Get counts
        const total = appointments.length;
        const pending = appointments.filter(a => a.status === 'Waiting').length;

        successResponse(res, {
            appointments,
            total,
            pending
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

        const { date, status, search } = req.query;

        let query = `
            SELECT a.*,
                   p.id as patient_id, p.name as patient_name, p.mobile as patient_mobile,
                   p.age as patient_age, p.gender as patient_gender
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
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

        query += ` ORDER BY a.appointment_date DESC, a.appointment_time ASC`;

        const [appointments] = await db.query(query, params);

        successResponse(res, { appointments }, 'Appointments fetched successfully');

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
            ORDER BY c.created_at DESC
            LIMIT 10
        `, [appointment.patient_id, appointmentId]);

        // Get any existing consultation for this appointment
        const [existingConsultation] = await db.query(
            'SELECT * FROM consultations WHERE appointment_id = ?',
            [appointmentId]
        );

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
            existingConsultation: existingConsultation[0] || null
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
        await db.query(
            'UPDATE appointments SET status = "Completed" WHERE id = ?',
            [appointmentId]
        );

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

        const fileUrl = `/uploads/${req.file.filename}`;
        const fileType = req.file.mimetype.includes('pdf') ? 'PDF' : 'IMAGE';

        const [result] = await db.query(`
            INSERT INTO consultation_media
            (consultation_id, patient_id, file_name, file_type, file_url, uploaded_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [consultationId, consultation[0].patient_id, req.file.originalname, fileType, fileUrl, req.user.id]);

        successResponse(res, {
            fileId: result.insertId,
            fileUrl
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
                   (SELECT diagnosis FROM consultations WHERE patient_id = p.id ORDER BY created_at DESC LIMIT 1) as lastCondition,
                   (SELECT COUNT(*) FROM consultations WHERE patient_id = p.id${doctorId ? ' AND doctor_id = ?' : ''}) as totalVisits,
                   (SELECT MAX(created_at) FROM consultations WHERE patient_id = p.id) as lastVisitDate
            FROM patients p
        `;
        const params = [];
        
        // For totalVisits subquery, add doctorId param if needed
        if (doctorId) {
            // We'll need to handle this in the subquery separately
            query = `
                SELECT DISTINCT p.*,
                       (SELECT diagnosis FROM consultations WHERE patient_id = p.id ORDER BY created_at DESC LIMIT 1) as lastCondition,
                       (SELECT COUNT(*) FROM consultations WHERE patient_id = p.id AND doctor_id = ?) as totalVisits,
                       (SELECT MAX(created_at) FROM consultations WHERE patient_id = p.id) as lastVisitDate
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

        successResponse(res, { patients: patientsWithAppointments }, 'Patient history fetched successfully');

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
            ORDER BY c.created_at DESC
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
        const { patientId, page = 1, limit = 20 } = req.query;
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

        query += ` ORDER BY cm.uploaded_at DESC LIMIT ? OFFSET ?`;
        params.push(queryLimit, offset);

        const [reports] = await db.query(query, params);

        successResponse(res, { reports }, 'Reports fetched successfully');

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

        query += ' ORDER BY created_at DESC';

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

        query += ` ORDER BY c.created_at DESC LIMIT ?`;
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
const getPrintData = async (req, res) => {
    try {
        const { consultationId } = req.params;

        // Get consultation with all details
        const [consultations] = await db.query(`
            SELECT c.*, a.appointment_date, a.appointment_time,
                   p.name as patient_name, p.age as patient_age, p.gender as patient_gender, p.mobile as patient_mobile,
                   d.name as doctor_name, d.specialization, d.qualification, d.registration_no
            FROM consultations c
            JOIN appointments a ON c.appointment_id = a.id
            JOIN patients p ON c.patient_id = p.id
            JOIN doctors d ON c.doctor_id = d.id
            WHERE c.id = ?
        `, [consultationId]);

        if (consultations.length === 0) {
            return errorResponse(res, 'Consultation not found', 404);
        }

        // Get clinic settings
        const [settings] = await db.query('SELECT * FROM clinic_settings LIMIT 1');

        const consultation = consultations[0];

        successResponse(res, {
            clinic: settings[0] || { clinic_name: 'My Clinic' },
            doctor: {
                name: consultation.doctor_name,
                specialization: consultation.specialization,
                qualification: consultation.qualification,
                regNo: consultation.registration_no
            },
            patient: {
                name: consultation.patient_name,
                age: consultation.patient_age,
                gender: consultation.patient_gender,
                mobile: consultation.patient_mobile
            },
            date: consultation.appointment_date,
            consultation: {
                chiefComplaints: consultation.chief_complaints,
                comorbidities: consultation.comorbidities,
                imagingFindings: consultation.imaging_findings,
                diagnosis: consultation.diagnosis,
                treatmentPlan: consultation.treatment_plan,
                followUpNotes: consultation.follow_up_notes
            }
        }, 'Print data fetched successfully');

    } catch (error) {
        console.error('Get Print Data Error:', error);
        errorResponse(res, 'Failed to fetch print data', 500, error.message);
    }
};

module.exports = {
    getDashboardStats,
    getTodayAppointments,
    getAppointments,
    getConsultationData,
    saveConsultation,
    uploadConsultationMedia,
    getPatientHistory,
    getPatientFullHistory,
    getReports,
    uploadReport,
    deleteReport,
    getTemplates,
    addTemplate,
    deleteTemplate,
    getRecentConsultations,
    getPrintData
};
