-- ====================================
-- ADD INTERNAL SPACING SETTINGS (SIMPLE VERSION)
-- ====================================
-- Copy and paste this entire SQL in phpMyAdmin SQL tab
-- Run this if the safe version doesn't work

USE hospital_clinic;

-- Add header_padding_top
ALTER TABLE clinic_settings 
ADD COLUMN header_padding_top DECIMAL(5,2) DEFAULT 0 AFTER page_margin_right;

-- Add header_padding_bottom
ALTER TABLE clinic_settings 
ADD COLUMN header_padding_bottom DECIMAL(5,2) DEFAULT 0 AFTER header_padding_top;

-- Add footer_padding_top
ALTER TABLE clinic_settings 
ADD COLUMN footer_padding_top DECIMAL(5,2) DEFAULT 0 AFTER header_padding_bottom;

-- Add footer_padding_bottom
ALTER TABLE clinic_settings 
ADD COLUMN footer_padding_bottom DECIMAL(5,2) DEFAULT 0 AFTER footer_padding_top;

-- Add content_spacing
ALTER TABLE clinic_settings 
ADD COLUMN content_spacing DECIMAL(5,2) DEFAULT 10 AFTER footer_padding_bottom;

-- Add section_spacing
ALTER TABLE clinic_settings 
ADD COLUMN section_spacing DECIMAL(5,2) DEFAULT 8 AFTER content_spacing;

