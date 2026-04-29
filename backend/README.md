# LocalConnect — Setup Guide

## Project Structure

```
localconnect/
├── backend/
│   ├── server.js        ← Express REST API (main backend file)
│   ├── db.js            ← MySQL connection pool
│   ├── schema.sql       ← Database tables + seed data
│   ├── package.json     ← Node.js dependencies
│   └── .env             ← MySQL credentials (edit this!)
└── frontend/
    ├── index.html       ← Home page
    ├── css/
    │   └── styles.css
    ├── js/
    │   └── api.js       ← Replaces store.js, calls backend API
    └── pages/
        ├── auth.html
        ├── browse.html
        ├── dashboard-jg.html
        ├── dashboard-worker.html
        ├── job-detail.html
        ├── manage-job.html
        ├── profile.html
        └── 404.html
```

---

## Requirements

- Node.js v18+
- MySQL 8.0+ (or XAMPP/WAMP/Laragon)

---

## Step-by-Step Setup

### Step 1 — MySQL Database Setup

MySQL Workbench, phpMyAdmin, ya terminal mein:

```bash
mysql -u root -p
```

Phir schema file run karo:

```bash
source /full/path/to/localconnect/backend/schema.sql
```

Ya phpMyAdmin mein: **Import** tab → schema.sql file select karo → Go.

Yeh automatically:
- `localconnect` database banayega
- Sab tables banayega (users, jobs, applications, reviews, worker_profiles, worker_categories)
- Demo data insert karega (4 users, 8 jobs, 3 reviews)

---

### Step 2 — Backend .env Configure Karo

`backend/.env` file kholo aur apna MySQL password daalo:

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=TUMHARA_PASSWORD_YAHAN
DB_NAME=localconnect
PORT=3000
```

---

### Step 3 — Node Modules Install Karo

```bash
cd localconnect/backend
npm install
```

---

### Step 4 — Server Start Karo

```bash
node server.js
```

Terminal mein yeh dikhna chahiye:
```
✅  MySQL connected
🚀  LocalConnect server running at http://localhost:3000
```

Development mode (auto-restart on file change):
```bash
npm run dev
```

---

### Step 5 — Browser Mein Kholo

```
http://localhost:3000
```

**IMPORTANT:** File ko directly `file://` se mat kholo. Hamesha `http://localhost:3000` se kholo, warna API calls fail hongi.

---

## Demo Login Credentials

| Email | Password | Role |
|---|---|---|
| ritik@gmail.com | ritik123 | Worker (Electrician) |
| arnav@demo.com | arnav123 | Client |
| sakshi@demo.com | sakshi123 | Worker (Plumber) |
| manya@demo.com | manya123 | Client |

---

## API Endpoints

### Auth
| Method | URL | Description |
|---|---|---|
| POST | /api/auth/login | Login |
| POST | /api/auth/signup | Register |

### Users
| Method | URL | Description |
|---|---|---|
| GET | /api/users | Sab users |
| GET | /api/users/:id | Ek user |
| PUT | /api/users/:id | Profile update |
| DELETE | /api/users/:id | Account delete |

### Jobs
| Method | URL | Description |
|---|---|---|
| GET | /api/jobs | Jobs list (filters: q, category, location, status, postedBy, sort) |
| GET | /api/jobs/:id | Ek job |
| POST | /api/jobs | Naya job post |
| PATCH | /api/jobs/:id/status | Job open/close |

### Applications
| Method | URL | Description |
|---|---|---|
| GET | /api/applications | Applications (filters: jobId, applicantId) |
| POST | /api/applications | Apply karo |
| PATCH | /api/applications/:id/status | Accept/Reject |
| DELETE | /api/applications/:id | Withdraw |

### Reviews
| Method | URL | Description |
|---|---|---|
| GET | /api/reviews?workerId=xxx | Worker ke reviews |

---

## Kya Badla (store.js se api.js)

- **Pehle:** localStorage/sessionStorage mein data
- **Ab:** MySQL database, Node.js API ke through

Main logic aur CSS bilkul same hai. Sirf data flow MySQL se ho raha hai.

---

## Common Issues

**"Cannot connect to MySQL"**
→ MySQL service chalu hai? .env mein password sahi hai?

**"Port 3000 already in use"**
→ `.env` mein `PORT=3001` kar do

**Page load ho raha hai lekin data nahi aa raha**
→ Browser console check karo (F12) — backend server chalu hai?
