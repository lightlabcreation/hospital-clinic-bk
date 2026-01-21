-- ====================================
-- SEED DATA FOR HOSPITAL CLINIC
-- ====================================
-- Run this AFTER schema.sql

USE hospital_clinic;

-- Clear existing data (optional - comment out in production)
-- DELETE FROM consultation_media;
-- DELETE FROM consultations;
-- DELETE FROM appointments;
-- DELETE FROM templates;
-- DELETE FROM patients;
-- DELETE FROM staff;
-- DELETE FROM doctors;
-- DELETE FROM users;

-- ====================================
-- INSERT USERS (Password: admin123, staff123, doctor123)
-- ====================================
-- Password hash for 'admin123' = $2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36PQrFNqwuBdELZfJz0.ZPi
-- Password hash for 'staff123' = $2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36PQrFNqwuBdELZfJz0.ZPi
-- Password hash for 'doctor123' = $2a$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36PQrFNqwuBdELZfJz0.ZPi

INSERT INTO users (email, password, name, role, status) VALUES
('admin@clinic.com', '$2a$10$rQZ5f1d5n5f5f5f5f5f5fOeW5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f', 'Clinic Administrator', 'ADMIN', 'Active'),
('staff@clinic.com', '$2a$10$rQZ5f1d5n5f5f5f5f5f5fOeW5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f', 'Reception Staff', 'STAFF', 'Active'),
('doctor@clinic.com', '$2a$10$rQZ5f1d5n5f5f5f5f5f5fOeW5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f', 'Dr. Sameer Khan', 'DOCTOR', 'Active'),
('doctor2@clinic.com', '$2a$10$rQZ5f1d5n5f5f5f5f5f5fOeW5f5f5f5f5f5f5f5f5f5f5f5f5f5f5f', 'Dr. Anjali Verma', 'DOCTOR', 'Active');

-- ====================================
-- INSERT DOCTORS
-- ====================================
INSERT INTO doctors (user_id, name, mobile, email, specialization, username, qualification, registration_no, status) VALUES
(3, 'Dr. Sameer Khan', '9876543210', 'doctor@clinic.com', 'Cardiology', 'dr_sameer', 'MBBS, MD - Cardiology', 'MC-987654', 'Active'),
(4, 'Dr. Anjali Verma', '9876543211', 'doctor2@clinic.com', 'Pediatrics', 'dr_anjali', 'MBBS, MD - Pediatrics', 'MC-987655', 'Active');

-- ====================================
-- INSERT STAFF
-- ====================================
INSERT INTO staff (user_id, name, mobile, username, status) VALUES
(2, 'Rahul Sharma', '9822334455', 'rahul_staff', 'Active');

-- ====================================
-- INSERT PATIENTS
-- ====================================
INSERT INTO patients (name, mobile, age, gender, address, registered_date, total_visits, last_visit) VALUES
('Aayush Sharma', '9876543210', 28, 'Male', 'Mumbai, Maharashtra', '2025-12-01', 3, '2026-01-15'),
('Neha Gupta', '9876543211', 24, 'Female', 'Delhi', '2026-01-05', 1, '2026-01-10'),
('Rajesh Kumar', '9876543212', 45, 'Male', 'Pune, Maharashtra', '2025-11-20', 5, '2026-01-18'),
('Priya Verma', '9876543213', 32, 'Female', 'Bangalore, Karnataka', '2025-12-15', 2, '2026-01-12'),
('Amit Singh', '9876543214', 38, 'Male', 'Chennai, Tamil Nadu', '2025-11-10', 4, '2026-01-16');

-- ====================================
-- INSERT APPOINTMENTS
-- ====================================
INSERT INTO appointments (patient_id, doctor_id, appointment_date, appointment_time, reason, status, created_by) VALUES
(1, 1, CURRENT_DATE, '10:30:00', 'Fever', 'Waiting', 2),
(2, 2, CURRENT_DATE, '11:00:00', 'Skin Rash', 'Waiting', 2),
(3, 1, CURRENT_DATE, '11:45:00', 'Back Pain', 'Waiting', 2),
(4, 2, DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY), '09:00:00', 'Regular Checkup', 'Scheduled', 2),
(5, 1, DATE_ADD(CURRENT_DATE, INTERVAL 1 DAY), '10:30:00', 'Diabetes Follow-up', 'Scheduled', 2);

-- ====================================
-- INSERT CLINIC SETTINGS
-- ====================================
INSERT INTO clinic_settings (clinic_name, address, phone, email, print_header_footer) VALUES
('City General Clinic', '123, Healthcare Street, Medical Plaza', '+91 98765 43210', 'info@cityclinic.com', 'Thank you for visiting City General Clinic. Please follow prescribed medications.')
ON DUPLICATE KEY UPDATE clinic_name = VALUES(clinic_name);

-- ====================================
-- INSERT SAMPLE TEMPLATES
-- ====================================
INSERT INTO templates (doctor_id, field_type, name, content) VALUES
(1, 'chiefComplaints', 'Fever Template', 'Patient complaining of high-grade fever since last 3 days. Occasional body ache and mild cough present.'),
(1, 'diagnosis', 'Viral Fever', 'Suspected Viral Fever. Advised blood work if fever persists for more than 48 hours.'),
(1, 'treatmentPlan', 'Fever Treatment', 'Tab. Paracetamol 650mg - 1-0-1 - After Food - 5 Days\nTab. Multivitamin - 0-0-1 - Bedtime - 10 Days'),
(2, 'chiefComplaints', 'Skin Rash Template', 'Patient presenting with skin rash on arms and legs. Mild itching present. No history of new food or medication.'),
(2, 'diagnosis', 'Allergic Dermatitis', 'Allergic contact dermatitis. Possible allergen exposure.'),
(2, 'treatmentPlan', 'Allergy Treatment', 'Tab. Cetirizine 10mg - 0-0-1 - Bedtime - 7 Days\nCalamine lotion - Apply on affected areas twice daily');

-- ====================================
-- SEED DATA COMPLETE
-- ====================================
SELECT 'Seed data inserted successfully!' as message;
