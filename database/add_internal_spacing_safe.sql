-- ====================================
-- ADD INTERNAL SPACING SETTINGS (SAFE VERSION)
-- ====================================
-- Run this SQL to add internal spacing columns for print layout
-- This version checks if columns exist before adding them (MariaDB compatible)
-- These control spacing inside the print document (header, footer, content sections)

USE hospital_clinic;

-- Add header_padding_top if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME = 'header_padding_top';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE clinic_settings ADD COLUMN header_padding_top DECIMAL(5,2) DEFAULT 0 AFTER page_margin_right',
    'SELECT "Column header_padding_top already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add header_padding_bottom if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME = 'header_padding_bottom';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE clinic_settings ADD COLUMN header_padding_bottom DECIMAL(5,2) DEFAULT 0 AFTER header_padding_top',
    'SELECT "Column header_padding_bottom already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add footer_padding_top if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME = 'footer_padding_top';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE clinic_settings ADD COLUMN footer_padding_top DECIMAL(5,2) DEFAULT 0 AFTER header_padding_bottom',
    'SELECT "Column footer_padding_top already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add footer_padding_bottom if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME = 'footer_padding_bottom';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE clinic_settings ADD COLUMN footer_padding_bottom DECIMAL(5,2) DEFAULT 0 AFTER footer_padding_top',
    'SELECT "Column footer_padding_bottom already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add content_spacing if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME = 'content_spacing';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE clinic_settings ADD COLUMN content_spacing DECIMAL(5,2) DEFAULT 10 AFTER footer_padding_bottom',
    'SELECT "Column content_spacing already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add section_spacing if not exists
SET @col_exists = 0;
SELECT COUNT(*) INTO @col_exists 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME = 'section_spacing';

SET @sql = IF(@col_exists = 0,
    'ALTER TABLE clinic_settings ADD COLUMN section_spacing DECIMAL(5,2) DEFAULT 8 AFTER content_spacing',
    'SELECT "Column section_spacing already exists" as message');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Verify the changes
SELECT 
    'Internal spacing columns added successfully!' as Status,
    COLUMN_NAME, 
    DATA_TYPE, 
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'hospital_clinic' 
  AND TABLE_NAME = 'clinic_settings' 
  AND COLUMN_NAME IN (
    'header_padding_top',
    'header_padding_bottom',
    'footer_padding_top',
    'footer_padding_bottom',
    'content_spacing',
    'section_spacing'
  );

