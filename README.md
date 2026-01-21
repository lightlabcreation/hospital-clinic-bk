# Hospital Clinic Backend API

## Technology Stack
- Node.js
- Express.js
- MySQL
- JWT Authentication
- bcryptjs (Password Hashing)
- Multer (File Uploads)

## Setup Instructions

### 1. Install Dependencies
```bash
cd hospital-clinic-backend
npm install
```

### 2. Setup MySQL Database
1. Open MySQL Command Line or phpMyAdmin
2. Run the schema file:
```sql
source database/schema.sql
```
3. (Optional) Run seed data:
```sql
source database/seed.sql
```

### 3. Configure Environment
Edit `.env` file:
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=hospital_clinic
```

### 4. Start Server
```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

Server will run on: http://localhost:5000

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@clinic.com | admin123 |
| Staff | staff@clinic.com | staff123 |
| Doctor | doctor@clinic.com | doctor123 |

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/auth/login | Login |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Logout |

### Admin APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/admin/dashboard/stats | Dashboard stats |
| GET | /api/admin/doctors | List doctors |
| POST | /api/admin/doctors | Add doctor |
| PUT | /api/admin/doctors/:id | Update doctor |
| DELETE | /api/admin/doctors/:id | Delete doctor |
| GET | /api/admin/staff | List staff |
| POST | /api/admin/staff | Add staff |
| GET | /api/admin/settings | Get clinic settings |
| PUT | /api/admin/settings | Update settings |

### Staff APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/staff/dashboard | Dashboard |
| GET | /api/staff/patients | List patients |
| POST | /api/staff/patients | Add patient |
| GET | /api/staff/appointments | List appointments |
| GET | /api/staff/doctors/available | Available doctors |

### Doctor APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/doctor/dashboard | Dashboard |
| GET | /api/doctor/appointments/today | Today's appointments |
| GET | /api/doctor/consultation/:appointmentId | Get consultation data |
| POST | /api/doctor/consultation/:appointmentId | Save consultation |
| GET | /api/doctor/patients/history | Patient history |
| GET | /api/doctor/reports | Get reports |
| POST | /api/doctor/reports | Upload report |
| GET | /api/doctor/templates | Get templates |
| POST | /api/doctor/templates | Add template |

### Common APIs
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/patients/search?mobile=xxx | Search patient by mobile |
| POST | /api/appointments | Create appointment |
| PATCH | /api/appointments/:id/status | Update appointment status |

## Folder Structure
```
hospital-clinic-backend/
├── database/
│   ├── schema.sql          # Database tables
│   └── seed.sql            # Sample data
├── src/
│   ├── config/
│   │   ├── db.js           # MySQL connection
│   │   └── jwt.js          # JWT config
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── admin.controller.js
│   │   ├── staff.controller.js
│   │   ├── doctor.controller.js
│   │   ├── patient.controller.js
│   │   └── appointment.controller.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── role.middleware.js
│   │   └── upload.middleware.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── admin.routes.js
│   │   ├── staff.routes.js
│   │   ├── doctor.routes.js
│   │   ├── patient.routes.js
│   │   └── appointment.routes.js
│   ├── utils/
│   │   └── response.helper.js
│   └── app.js
├── uploads/                # Uploaded files
├── server.js
├── package.json
├── .env
└── README.md
```

## Business Rules

1. **Duplicate Appointment Check**: Same doctor + Same date + Same time = BLOCKED
2. **Patient Auto-Detection**: Mobile number se patient search
3. **Appointment Status Flow**: Scheduled → Waiting → Completed
4. **Role-Based Access**:
   - ADMIN: Full access
   - STAFF: Appointments & Patients only
   - DOCTOR: Own appointments & consultations only

## Connect Frontend

In frontend, update the API base URL:
```javascript
// src/config/api.js or similar
const API_BASE_URL = 'http://localhost:5000/api';
```
