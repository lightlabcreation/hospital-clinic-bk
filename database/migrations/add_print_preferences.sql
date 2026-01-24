-- ====================================
-- MIGRATION: Add Print Preferences to clinic_settings
-- ====================================
-- Run this SQL to add print layout preferences columns
-- This allows configuring page margins for letterhead printing

ALTER TABLE clinic_settings
ADD COLUMN IF NOT EXISTS print_header TEXT AFTER print_header_footer,
ADD COLUMN IF NOT EXISTS header_margin_top DECIMAL(5,2) DEFAULT 0 AFTER print_header,
ADD COLUMN IF NOT EXISTS header_margin_bottom DECIMAL(5,2) DEFAULT 0 AFTER header_margin_top,
ADD COLUMN IF NOT EXISTS footer_margin_top DECIMAL(5,2) DEFAULT 0 AFTER header_margin_bottom,
ADD COLUMN IF NOT EXISTS footer_margin_bottom DECIMAL(5,2) DEFAULT 0 AFTER footer_margin_top,
ADD COLUMN IF NOT EXISTS page_margin_left DECIMAL(5,2) DEFAULT 0 AFTER footer_margin_bottom,
ADD COLUMN IF NOT EXISTS page_margin_right DECIMAL(5,2) DEFAULT 0 AFTER page_margin_left;

-- Note: If your MySQL version doesn't support IF NOT EXISTS, use this instead:
-- ALTER TABLE clinic_settings
-- ADD COLUMN print_header TEXT AFTER print_header_footer,
-- ADD COLUMN header_margin_top DECIMAL(5,2) DEFAULT 0 AFTER print_header,
-- ADD COLUMN header_margin_bottom DECIMAL(5,2) DEFAULT 0 AFTER header_margin_top,
-- ADD COLUMN footer_margin_top DECIMAL(5,2) DEFAULT 0 AFTER header_margin_bottom,
-- ADD COLUMN footer_margin_bottom DECIMAL(5,2) DEFAULT 0 AFTER footer_margin_top,
-- ADD COLUMN page_margin_left DECIMAL(5,2) DEFAULT 0 AFTER footer_margin_bottom,
-- ADD COLUMN page_margin_right DECIMAL(5,2) DEFAULT 0 AFTER page_margin_left;

