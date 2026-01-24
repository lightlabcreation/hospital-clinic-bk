-- ====================================
-- ADD INTERNAL SPACING SETTINGS
-- ====================================
-- Run this SQL to add internal spacing columns for print layout
-- These control spacing inside the print document (header, footer, content sections)

USE hospital_clinic;

-- Add header internal padding
ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS header_padding_top DECIMAL(5,2) DEFAULT 0 AFTER page_margin_right;

ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS header_padding_bottom DECIMAL(5,2) DEFAULT 0 AFTER header_padding_top;

-- Add footer internal padding
ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS footer_padding_top DECIMAL(5,2) DEFAULT 0 AFTER header_padding_bottom;

ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS footer_padding_bottom DECIMAL(5,2) DEFAULT 0 AFTER footer_padding_top;

-- Add content spacing
ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS content_spacing DECIMAL(5,2) DEFAULT 10 AFTER footer_padding_bottom;

-- Add section spacing (between different sections like Chief Complaints, Comorbidities)
ALTER TABLE clinic_settings 
ADD COLUMN IF NOT EXISTS section_spacing DECIMAL(5,2) DEFAULT 8 AFTER content_spacing;

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

