-- ============================================================
-- LocalConnect – MySQL Schema + Seed Data
-- Run once: mysql -u root -p < schema.sql
-- ============================================================

CREATE DATABASE IF NOT EXISTS localconnect CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE localconnect;

-- Drop in reverse dependency order (safe re-run)
DROP TABLE IF EXISTS reviews;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS jobs;
DROP TABLE IF EXISTS worker_categories;
DROP TABLE IF EXISTS worker_profiles;
DROP TABLE IF EXISTS users;

-- ── USERS ────────────────────────────────────────────────────
CREATE TABLE users (
  id         VARCHAR(32)              PRIMARY KEY,
  email      VARCHAR(255) NOT NULL    UNIQUE,
  password   VARCHAR(255) NOT NULL,
  full_name  VARCHAR(255) NOT NULL,
  role       ENUM('worker','job_giver') NOT NULL,
  location   VARCHAR(255)             DEFAULT '',
  bio        TEXT,
  phone      VARCHAR(50)              DEFAULT '',
  avatar     TEXT                     DEFAULT NULL,
  created_at DATETIME                 DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── WORKER PROFILES ──────────────────────────────────────────
CREATE TABLE worker_profiles (
  user_id              VARCHAR(32)   PRIMARY KEY,
  hourly_rate          DECIMAL(10,2) DEFAULT NULL,
  total_jobs_completed INT           DEFAULT 0,
  rating_average       DECIMAL(3,2)  DEFAULT NULL,
  verified             TINYINT(1)    DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── WORKER CATEGORIES (multiple per worker) ──────────────────
CREATE TABLE worker_categories (
  id       INT          AUTO_INCREMENT PRIMARY KEY,
  user_id  VARCHAR(32)  NOT NULL,
  category VARCHAR(100) NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── JOBS ─────────────────────────────────────────────────────
CREATE TABLE jobs (
  id          VARCHAR(32)   PRIMARY KEY,
  title       VARCHAR(500)  NOT NULL,
  description TEXT          NOT NULL,
  category    VARCHAR(100)  NOT NULL,
  location    VARCHAR(255)  NOT NULL,
  budget      DECIMAL(12,2) NOT NULL,
  status      ENUM('open','closed') DEFAULT 'open',
  posted_by   VARCHAR(32)   NOT NULL,
  image_emoji VARCHAR(10)   DEFAULT '📌',
  created_at  DATETIME      DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (posted_by) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── APPLICATIONS ─────────────────────────────────────────────
CREATE TABLE applications (
  id            VARCHAR(32) PRIMARY KEY,
  job_id        VARCHAR(32) NOT NULL,
  applicant_id  VARCHAR(32) NOT NULL,
  cover_message TEXT,
  status        ENUM('pending','accepted','rejected') DEFAULT 'pending',
  applied_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id)       REFERENCES jobs(id)  ON DELETE CASCADE,
  FOREIGN KEY (applicant_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_app (job_id, applicant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── REVIEWS ──────────────────────────────────────────────────
CREATE TABLE reviews (
  id          VARCHAR(32) PRIMARY KEY,
  worker_id   VARCHAR(32) NOT NULL,
  reviewer_id VARCHAR(32) NOT NULL,
  rating      TINYINT     NOT NULL,
  comment     TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (worker_id)   REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO users (id, email, password, full_name, role, location, bio, phone) VALUES
('u1','ritik@gmail.com','ritik123','Ritik Kumar','worker','Meerut, UP',
  'Experienced electrician with 8+ years in residential and commercial projects. Certified and reliable.',
  '+91 8235348526'),
('u2','arnav@demo.com','arnav123','Arnav Kumar','job_giver','Delhi NCR',
  'Homeowner looking for reliable local service providers.',
  '+91 9286150705'),
('u3','sakshi@demo.com','sakshi123','Sakshi Kumari','worker','Bangalore',
  'Professional plumber with expertise in pipe fitting, leak repair, and bathroom installations.',
  '+91 8765432109'),
('u4','manya@demo.com','manya123','Manya Maheshwari','job_giver','Mumbai',
  'Looking for quality home services.',
  '+91 9123456789');

INSERT INTO worker_profiles (user_id, hourly_rate, total_jobs_completed, rating_average, verified) VALUES
('u1', 500.00, 42, 4.70, 1),
('u3', 400.00, 29, 4.50, 1);

INSERT INTO worker_categories (user_id, category) VALUES
('u1','Electrical'),
('u1','Handyman'),
('u3','Plumbing');

INSERT INTO jobs (id, title, description, category, location, budget, status, posted_by, image_emoji, created_at) VALUES
('j1','Fix Electrical Wiring in 3BHK Flat',
  'Need a certified electrician to fix faulty wiring in our 3BHK apartment. Some switches not working, need complete circuit check and repair.',
  'Electrical','Delhi NCR',2500.00,'open','u2','⚡', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
('j2','Kitchen Pipe Leakage Repair',
  'Urgent! Kitchen sink pipe is leaking badly. Also need bathroom tap replacement. Prefer experienced plumber who can complete within 2-3 hours.',
  'Plumbing','Meerut, UP',1800.00,'open','u4','🔧', DATE_SUB(NOW(), INTERVAL 5 HOUR)),
('j3','Home Tutoring for Class 10 Maths & Science',
  'Looking for an experienced home tutor for my daughter in Class 10. 5 days a week, 2 hours per day. Evening slots preferred (6–8 PM).',
  'Tutoring','Bangalore',8000.00,'open','u2','📚', DATE_SUB(NOW(), INTERVAL 10 HOUR)),
('j4','Deep House Cleaning — 2BHK',
  'Need thorough deep cleaning of our 2BHK apartment. Includes kitchen, bathrooms, window cleaning, dusting all furniture and mopping floors.',
  'Cleaning','Mumbai',3200.00,'open','u4','🧹', DATE_SUB(NOW(), INTERVAL 20 HOUR)),
('j5','Terrace Garden Setup & Maintenance',
  'Looking for a skilled gardener to help set up and maintain a terrace garden. Need advice on plants, soil, pots, and regular weekly maintenance.',
  'Gardening','Pune',5000.00,'open','u2','🌿', DATE_SUB(NOW(), INTERVAL 30 HOUR)),
('j6','Pest Control for 3BHK House',
  'Need professional pest control for cockroach and ant infestation. 3BHK with kitchen and bathrooms most affected. Eco-friendly treatment preferred.',
  'Pest Control','Hyderabad',2200.00,'open','u4','🪲', DATE_SUB(NOW(), INTERVAL 48 HOUR)),
('j7','Full-time Cook for Family of 5',
  'Looking for a skilled cook. Should know North Indian, South Indian, and continental dishes. Morning shift 7 AM–1 PM, Monday to Saturday.',
  'Cook/Maid','Chennai',12000.00,'open','u2','🍳', DATE_SUB(NOW(), INTERVAL 60 HOUR)),
('j8','Wooden Cabinet Repair & Polish',
  'Several wooden cabinets need repair — loose hinges, broken handles, and repolishing. Approximately 6–8 cabinets across kitchen and bedrooms.',
  'Handyman','Kolkata',4500.00,'open','u4','🪵', DATE_SUB(NOW(), INTERVAL 72 HOUR));

INSERT INTO reviews (id, worker_id, reviewer_id, rating, comment, created_at) VALUES
('r1','u1','u2',5,'Excellent work! Very professional and completed the job quickly. Highly recommended!', DATE_SUB(NOW(), INTERVAL 7 DAY)),
('r2','u1','u4',4,'Good job overall. Very knowledgeable and friendly. Minor delay but completed properly.', DATE_SUB(NOW(), INTERVAL 14 DAY)),
('r3','u3','u2',5,'Fixed the pipe leak perfectly. Clean work, no mess. Will hire again!', DATE_SUB(NOW(), INTERVAL 10 DAY));

-- Verify
SELECT 'Users:' AS '', COUNT(*) FROM users;
SELECT 'Jobs:' AS '', COUNT(*) FROM jobs;
SELECT 'Reviews:' AS '', COUNT(*) FROM reviews;
