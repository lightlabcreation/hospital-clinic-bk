-- ====================================
-- UPDATE DATABASE: Add Print Preferences
-- ====================================
-- Run this SQL file in your MySQL database to add print layout preferences
-- This file adds columns for configuring page margins for letterhead printing
-- 
-- Usage: 
--   mysql -u username -p database_name < update_print_preferences.sql
--   OR run this in phpMyAdmin SQL tab

USE hospital_clinic;

-- Add print_header column (if not exists)
ALTER TABLE clinic_settings 
ADD COLUMN print_header TEXT AFTER print_header_footer;

-- Add header margin columns
ALTER TABLE clinic_settings 
ADD COLUMN header_margin_top DECIMAL(5,2) DEFAULT 0 AFTER print_header;

ALTER TABLE clinic_settings 
ADD COLUMN header_margin_bottom DECIMAL(5,2) DEFAULT 0 AFTER header_margin_top;

-- Add footer margin columns
ALTER TABLE clinic_settings 
ADD COLUMN footer_margin_top DECIMAL(5,2) DEFAULT 0 AFTER header_margin_bottom;

ALTER TABLE clinic_settings 
ADD COLUMN footer_margin_bottom DECIMAL(5,2) DEFAULT 0 AFTER footer_margin_top;

-- Add page margin columns
ALTER TABLE clinic_settings 
ADD COLUMN page_margin_left DECIMAL(5,2) DEFAULT 0 AFTER footer_margin_bottom;

ALTER TABLE clinic_settings 
ADD COLUMN page_margin_right DECIMAL(5,2) DEFAULT 0 AFTER page_margin_left;

-- Verify the changes
SELECT 
    'Print Preferences columns added successfully!' as Status,
    COLUMN_NAME, 
    DATA_TYPE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME IN (
    'print_header',
    'header_margin_top',
    'header_margin_bottom',
    'footer_margin_top',
    'footer_margin_bottom',
    'page_margin_left',
    'page_margin_right'
  );

