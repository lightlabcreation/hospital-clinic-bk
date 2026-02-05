// ====================================
// PAYMENT & INVOICE CONTROLLER
// ====================================
const db = require('../config/db');
const { successResponse, errorResponse, paginate } = require('../utils/response.helper');

// Get combined list: Payments with Invoice (Patient paid → Invoice generated)
// Get combined list: Payments with Invoice (Patient paid → Invoice generated)
const getPaymentInvoiceList = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        const [countResult] = await db.query(`
            SELECT COUNT(*) as total
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
            LEFT JOIN invoices i ON i.appointment_id = py.appointment_id
        `);

        const [rows] = await db.query(`
            SELECT py.id, py.appointment_id, py.amount, py.payment_date, py.status as payment_status,
                   p.name as patient_name, p.mobile as patient_mobile,
                   d.name as doctor_name, d.specialization,
                   i.invoice_number, i.id as invoice_id
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
            LEFT JOIN invoices i ON i.appointment_id = py.appointment_id
            ORDER BY py.payment_date DESC, py.created_at DESC
            LIMIT ? OFFSET ?
        `, [queryLimit, offset]);

        const [amountResult] = await db.query(`
            SELECT SUM(py.amount) as total
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
        `);

        successResponse(res, {
            records: rows,
            totalAmount: amountResult[0].total || 0,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Payment & invoice list fetched successfully');
    } catch (error) {
        console.error('Get Payment Invoice List Error:', error);
        errorResponse(res, 'Failed to fetch list', 500, error.message);
    }
};

// Get all payments
// Get all payments
const getAllPayments = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const { limit: queryLimit, offset } = paginate(page, limit);

        const [countResult] = await db.query(`
            SELECT COUNT(*) as total
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
            LEFT JOIN appointments a ON py.appointment_id = a.id
        `);

        const [payments] = await db.query(`
            SELECT py.*, p.name as patient_name, p.mobile as patient_mobile,
                   d.name as doctor_name, d.specialization,
                   a.appointment_date, a.appointment_time, a.reason
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
            LEFT JOIN appointments a ON py.appointment_id = a.id
            ORDER BY py.payment_date DESC, py.created_at DESC
            LIMIT ? OFFSET ?
        `, [queryLimit, offset]);

        const [amountResult] = await db.query(`
            SELECT SUM(py.amount) as total
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
        `);

        successResponse(res, {
            payments,
            totalAmount: amountResult[0].total || 0,
            total: countResult[0].total,
            page: parseInt(page),
            totalPages: Math.ceil(countResult[0].total / queryLimit)
        }, 'Payments fetched successfully');

    } catch (error) {
        console.error('Get Payments Error:', error);
        errorResponse(res, 'Failed to fetch payments', 500, error.message);
    }
};

// Get payments by date range
const getPaymentsByDateRange = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        if (!startDate || !endDate) {
            return errorResponse(res, 'Start date and end date are required', 400);
        }

        const [payments] = await db.query(`
            SELECT py.*, p.name as patient_name, p.mobile as patient_mobile,
                   d.name as doctor_name, d.specialization,
                   a.appointment_date, a.appointment_time, a.reason
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
            LEFT JOIN appointments a ON py.appointment_id = a.id
            WHERE py.payment_date BETWEEN ? AND ?
            ORDER BY py.payment_date DESC, py.created_at DESC
        `, [startDate, endDate]);

        const totalAmount = payments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        successResponse(res, {
            payments,
            totalAmount
        }, 'Payments fetched successfully');

    } catch (error) {
        console.error('Get Payments Error:', error);
        errorResponse(res, 'Failed to fetch payments', 500, error.message);
    }
};

// Record payment (from appointment)
const recordPayment = async (req, res) => {
    try {
        const { appointmentId, amount, paymentMethod = 'Cash', notes } = req.body;

        if (!appointmentId || amount == null) {
            return errorResponse(res, 'Appointment ID and amount are required', 400);
        }

        const [appointments] = await db.query(
            'SELECT patient_id, doctor_id, appointment_date, fee FROM appointments WHERE id = ?',
            [appointmentId]
        );

        if (appointments.length === 0) {
            return errorResponse(res, 'Appointment not found', 404);
        }

        const apt = appointments[0];
        const paymentAmount = parseFloat(amount) || parseFloat(apt.fee) || 0;

        const [result] = await db.query(`
            INSERT INTO payments (appointment_id, patient_id, doctor_id, amount, payment_date, payment_method, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 'Completed', ?, ?)
        `, [appointmentId, apt.patient_id, apt.doctor_id, paymentAmount, apt.appointment_date, paymentMethod || 'Cash', notes || null, req.user?.id]);

        const [newPayment] = await db.query(`
            SELECT py.*, p.name as patient_name, d.name as doctor_name
            FROM payments py
            JOIN patients p ON py.patient_id = p.id
            JOIN doctors d ON py.doctor_id = d.id
            WHERE py.id = ?
        `, [result.insertId]);

        successResponse(res, newPayment[0], 'Payment recorded successfully', 201);

    } catch (error) {
        console.error('Record Payment Error:', error);
        errorResponse(res, 'Failed to record payment', 500, error.message);
    }
};

// Get all invoices
const getAllInvoices = async (req, res) => {
    try {
        const [invoices] = await db.query(`
            SELECT i.*, p.name as patient_name, p.mobile as patient_mobile,
                   d.name as doctor_name, d.specialization,
                   a.appointment_date, a.appointment_time, a.reason
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            JOIN doctors d ON i.doctor_id = d.id
            LEFT JOIN appointments a ON i.appointment_id = a.id
            ORDER BY i.invoice_date DESC, i.created_at DESC
        `);

        const totalAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);

        successResponse(res, {
            invoices,
            totalAmount
        }, 'Invoices fetched successfully');

    } catch (error) {
        console.error('Get Invoices Error:', error);
        errorResponse(res, 'Failed to fetch invoices', 500, error.message);
    }
};

// Generate invoice from appointment
const generateInvoice = async (req, res) => {
    try {
        const { appointmentId } = req.body;

        if (!appointmentId) {
            return errorResponse(res, 'Appointment ID is required', 400);
        }

        const [appointments] = await db.query(`
            SELECT a.*, p.name as patient_name, d.name as doctor_name
            FROM appointments a
            JOIN patients p ON a.patient_id = p.id
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.id = ?
        `, [appointmentId]);

        if (appointments.length === 0) {
            return errorResponse(res, 'Appointment not found', 404);
        }

        const apt = appointments[0];
        const amount = parseFloat(apt.fee) || 0;

        // Generate invoice number
        const [count] = await db.query('SELECT COUNT(*) as c FROM invoices');
        const invoiceNumber = `INV-${String(count[0].c + 1).padStart(6, '0')}`;

        const [result] = await db.query(`
            INSERT INTO invoices (invoice_number, appointment_id, patient_id, doctor_id, amount, invoice_date, status)
            VALUES (?, ?, ?, ?, ?, ?, 'Generated')
        `, [invoiceNumber, appointmentId, apt.patient_id, apt.doctor_id, amount, apt.appointment_date]);

        const [newInvoice] = await db.query(`
            SELECT i.*, p.name as patient_name, p.mobile as patient_mobile,
                   d.name as doctor_name, d.specialization,
                   a.appointment_date, a.appointment_time, a.reason
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            JOIN doctors d ON i.doctor_id = d.id
            LEFT JOIN appointments a ON i.appointment_id = a.id
            WHERE i.id = ?
        `, [result.insertId]);

        successResponse(res, newInvoice[0], 'Invoice generated successfully', 201);

    } catch (error) {
        console.error('Generate Invoice Error:', error);
        errorResponse(res, 'Failed to generate invoice', 500, error.message);
    }
};

// Get invoice by ID (for print)
const getInvoiceById = async (req, res) => {
    try {
        const { id } = req.params;

        const [invoices] = await db.query(`
            SELECT i.*, p.name as patient_name, p.mobile as patient_mobile, p.age as patient_age, p.gender as patient_gender, p.address as patient_address,
                   d.name as doctor_name, d.specialization, d.qualification,
                   a.appointment_date, a.appointment_time, a.reason
            FROM invoices i
            JOIN patients p ON i.patient_id = p.id
            JOIN doctors d ON i.doctor_id = d.id
            LEFT JOIN appointments a ON i.appointment_id = a.id
            WHERE i.id = ?
        `, [id]);

        if (invoices.length === 0) {
            return errorResponse(res, 'Invoice not found', 404);
        }

        const [clinic] = await db.query('SELECT clinic_name, address, phone, email FROM clinic_settings LIMIT 1');

        successResponse(res, {
            invoice: invoices[0],
            clinic: clinic[0] || {}
        }, 'Invoice fetched successfully');

    } catch (error) {
        console.error('Get Invoice Error:', error);
        errorResponse(res, 'Failed to fetch invoice', 500, error.message);
    }
};

// Sync payments from appointments (for appointments with fee but no payment record)
const syncPaymentsFromAppointments = async (req, res) => {
    try {
        const [appointmentsWithFee] = await db.query(`
            SELECT a.id, a.patient_id, a.doctor_id, a.appointment_date, a.fee
            FROM appointments a
            WHERE a.fee > 0 AND a.status = 'Completed'
            AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.appointment_id = a.id)
        `);

        let created = 0;
        for (const apt of appointmentsWithFee) {
            await db.query(`
                INSERT INTO payments (appointment_id, patient_id, doctor_id, amount, payment_date, payment_method, status, created_by)
                VALUES (?, ?, ?, ?, ?, 'Cash', 'Completed', ?)
            `, [apt.id, apt.patient_id, apt.doctor_id, apt.fee, apt.appointment_date, req.user?.id]);
            created++;
        }

        successResponse(res, { synced: created }, `Synced ${created} payments from appointments`);

    } catch (error) {
        console.error('Sync Payments Error:', error);
        errorResponse(res, 'Failed to sync payments', 500, error.message);
    }
};

module.exports = {
    getPaymentInvoiceList,
    getAllPayments,
    getPaymentsByDateRange,
    recordPayment,
    getAllInvoices,
    generateInvoice,
    getInvoiceById,
    syncPaymentsFromAppointments
};
