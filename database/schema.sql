-- ====================================
-- HOSPITAL CLINIC DATABASE SCHEMA
-- ====================================
-- Run this file in MySQL to create database and tables

-- Create Database
CREATE DATABASE IF NOT EXISTS hospital_clinic;
USE hospital_clinic;

-- ====================================
-- TABLE 1: USERS (Login Credentials)
-- ====================================
CREATE TABLE IF NOT EXISTS users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role ENUM('ADMIN', 'STAFF', 'DOCTOR') NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE 2: DOCTORS
-- ====================================
CREATE TABLE IF NOT EXISTS doctors (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    email VARCHAR(255) NOT NULL,
    specialization VARCHAR(255) DEFAULT 'General Medicine',
    username VARCHAR(100) UNIQUE NOT NULL,
    qualification VARCHAR(255),
    registration_no VARCHAR(100),
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================
-- TABLE 3: STAFF
-- ====================================
CREATE TABLE IF NOT EXISTS staff (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================
-- TABLE 4: PATIENTS
-- ====================================
CREATE TABLE IF NOT EXISTS patients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    mobile VARCHAR(15) UNIQUE NOT NULL,
    age INT,
    gender ENUM('Male', 'Female', 'Other') DEFAULT 'Male',
    address TEXT,
    blood_group VARCHAR(10),
    registered_date DATE DEFAULT (CURRENT_DATE),
    total_visits INT DEFAULT 0,
    last_visit DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ====================================
-- TABLE 5: APPOINTMENTS
-- ====================================
CREATE TABLE IF NOT EXISTS appointments (
    id INT PRIMARY KEY AUTO_INCREMENT,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    reason VARCHAR(500),
    status ENUM('Scheduled', 'Waiting', 'Completed', 'Cancelled') DEFAULT 'Waiting',
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    -- Prevent duplicate appointments (same doctor, same date, same time)
    UNIQUE KEY unique_appointment (doctor_id, appointment_date, appointment_time)
);

-- ====================================
-- TABLE 6: CONSULTATIONS
-- ====================================
CREATE TABLE IF NOT EXISTS consultations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    appointment_id INT NOT NULL,
    patient_id INT NOT NULL,
    doctor_id INT NOT NULL,
    visit_number INT DEFAULT 1,
    chief_complaints TEXT,
    comorbidities TEXT,
    imaging_findings TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    follow_up_notes TEXT,
    vitals JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- ====================================
-- TABLE 7: CONSULTATION MEDIA (Files)
-- ====================================
CREATE TABLE IF NOT EXISTS consultation_media (
    id INT PRIMARY KEY AUTO_INCREMENT,
    consultation_id INT,
    patient_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type ENUM('PDF', 'IMAGE', 'X-ray', 'MRI', 'Blood', 'CT Scan', 'Ultrasound', 'Other') DEFAULT 'Other',
    file_url VARCHAR(500) NOT NULL,
    description VARCHAR(500),
    visit_id VARCHAR(50),
    uploaded_by INT,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (consultation_id) REFERENCES consultations(id) ON DELETE SET NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL
);

-- ====================================
-- TABLE 8: TEMPLATES
-- ====================================
CREATE TABLE IF NOT EXISTS templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    doctor_id INT,
    field_type ENUM('chiefComplaints', 'comorbidities', 'imagingFindings', 'diagnosis', 'treatmentPlan', 'followUpNotes') NOT NULL,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
);

-- ====================================
-- TABLE 9: CLINIC SETTINGS
-- ====================================
CREATE TABLE IF NOT EXISTS clinic_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clinic_name VARCHAR(255) DEFAULT 'My Clinic',
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(255),
    logo_url VARCHAR(500),
    signature_url VARCHAR(500),
    print_header TEXT,
    print_header_footer TEXT,
    header_margin_top DECIMAL(5,2) DEFAULT 0,
    header_margin_bottom DECIMAL(5,2) DEFAULT 0,
    footer_margin_top DECIMAL(5,2) DEFAULT 0,
    footer_margin_bottom DECIMAL(5,2) DEFAULT 0,
    page_margin_left DECIMAL(5,2) DEFAULT 0,
    page_margin_right DECIMAL(5,2) DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ====================================
-- INSERT DEFAULT DATA
-- ====================================

-- Insert default clinic settings
INSERT INTO clinic_settings (clinic_name, address, phone)
VALUES ('City General Clinic', '123, Healthcare Street, Medical Plaza', '+91 98765 43210');

-- ====================================
-- DEFAULT USERS (All passwords: admin123)
-- Bcrypt hash for 'admin123': $2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBuBi0kTjHQE8VU5JYcHuHKBhjyO
-- ====================================

-- 1. ADMIN User
-- Email: admin@clinic.com | Password: admin123
INSERT INTO users (email, password, name, role, status)
VALUES ('admin@clinic.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBuBi0kTjHQE8VU5JYcHuHKBhjyO', 'Clinic Administrator', 'ADMIN', 'Active');

-- 2. STAFF User
-- Email: staff@clinic.com | Password: admin123
INSERT INTO users (email, password, name, role, status)
VALUES ('staff@clinic.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBuBi0kTjHQE8VU5JYcHuHKBhjyO', 'Front Desk Staff', 'STAFF', 'Active');

-- 3. DOCTOR User
-- Email: doctor@clinic.com | Password: admin123
INSERT INTO users (email, password, name, role, status)
VALUES ('doctor@clinic.com', '$2a$10$N9qo8uLOickgx2ZMRZoMy.MqrqBuBi0kTjHQE8VU5JYcHuHKBhjyO', 'Dr. Sharma', 'DOCTOR', 'Active');

-- Insert Staff record (linked to user_id = 2)
INSERT INTO staff (user_id, name, mobile, username, status)
VALUES (2, 'Front Desk Staff', '9876543210', 'staff', 'Active');

-- Insert Doctor record (linked to user_id = 3)
INSERT INTO doctors (user_id, name, mobile, email, specialization, username, qualification, registration_no, status)
VALUES (3, 'Dr. Sharma', '9876543211', 'doctor@clinic.com', 'General Medicine', 'doctor', 'MBBS, MD', 'REG12345', 'Active');

-- ====================================
-- INDEXES FOR PERFORMANCE
-- ====================================
CREATE INDEX idx_patients_mobile ON patients(mobile);
CREATE INDEX idx_appointments_date ON appointments(appointment_date);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_consultations_doctor ON consultations(doctor_id);

-- ====================================
-- VIEW: Today's Appointments
-- ====================================
CREATE OR REPLACE VIEW view_today_appointments AS
SELECT
    a.id,
    a.appointment_date,
    a.appointment_time,
    a.reason,
    a.status,
    p.id as patient_id,
    p.name as patient_name,
    p.mobile as patient_mobile,
    p.age as patient_age,
    p.gender as patient_gender,
    d.id as doctor_id,
    d.name as doctor_name,
    d.specialization
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN doctors d ON a.doctor_id = d.id
WHERE a.appointment_date = CURRENT_DATE
ORDER BY a.appointment_time;

-- ====================================
-- SCHEMA COMPLETE
-- ====================================
