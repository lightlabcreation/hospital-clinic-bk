# Print Preferences Database Update

## Files Available:

### 1. `update_print_preferences.sql` (Recommended)
- Simple and straightforward
- Use this if you're sure the columns don't exist yet
- May show errors if columns already exist (but won't break anything)

### 2. `update_print_preferences_safe.sql` (Safe Version)
- Checks if columns exist before adding
- No errors even if columns already exist
- Use this if you're not sure about current database state

## How to Run:

### Option 1: Using MySQL Command Line
```bash
mysql -u your_username -p hospital_clinic < update_print_preferences.sql
```

### Option 2: Using phpMyAdmin
1. Open phpMyAdmin
2. Select `hospital_clinic` database
3. Click on "SQL" tab
4. Copy and paste the contents of `update_print_preferences.sql`
5. Click "Go"

### Option 3: Using MySQL Workbench
1. Open MySQL Workbench
2. Connect to your database
3. Open `update_print_preferences.sql` file
4. Execute the script

## What This Does:

Adds the following columns to `clinic_settings` table:
- `print_header` - Text field for header/footer content
- `header_margin_top` - Top margin for header (in mm)
- `header_margin_bottom` - Bottom margin after header (in mm)
- `footer_margin_top` - Top margin before footer (in mm)
- `footer_margin_bottom` - Bottom margin for footer (in mm)
- `page_margin_left` - Left margin for entire page (in mm)
- `page_margin_right` - Right margin for entire page (in mm)

## Verification:

After running the script, verify with:
```sql
DESCRIBE clinic_settings;
```

You should see all the new columns listed.

