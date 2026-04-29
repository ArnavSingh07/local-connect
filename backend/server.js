'use strict';

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Root → index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Helper: short random ID ──────────────────────────────────
function genId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// ── Helper: build user object from DB row ────────────────────
// FIX: Worker check karo role se, NOT se hourly_rate presence se
function buildUser(row, categories = []) {
  const user = {
    id       : row.id,
    email    : row.email,
    password : row.password,
    fullName : row.full_name,
    role     : row.role,
    location : row.location || '',
    bio      : row.bio      || '',
    phone    : row.phone    || '',
    avatar   : row.avatar   || null,
    workerProfile: null
  };

  if (row.role === 'worker') {
    // LEFT JOIN se worker_profiles aaya ho ya nahi, workerProfile object banana hai
    user.workerProfile = {
      categories         : categories,
      hourlyRate         : row.hourly_rate         ? parseFloat(row.hourly_rate) : null,
      totalJobsCompleted : row.total_jobs_completed ? parseInt(row.total_jobs_completed) : 0,
      ratingAverage      : row.rating_average       ? parseFloat(row.rating_average) : null,
      verified           : row.verified             ? !!row.verified : false
    };
  }
  return user;
}

// ── Helper: build job object from DB row ─────────────────────
function buildJob(row, applicationIds = []) {
  return {
    id          : row.id,
    title       : row.title,
    description : row.description,
    category    : row.category,
    location    : row.location,
    budget      : parseFloat(row.budget),
    status      : row.status,
    postedBy    : row.posted_by,
    imageEmoji  : row.image_emoji || '📌',
    createdAt   : row.created_at instanceof Date
                    ? row.created_at.toISOString()
                    : row.created_at,
    applications: applicationIds.filter(Boolean) // remove nulls from GROUP_CONCAT
  };
}

// =============================================================
//  AUTH ROUTES
// =============================================================

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const [rows] = await db.query(
      `SELECT u.*, wp.hourly_rate, wp.total_jobs_completed, wp.rating_average, wp.verified
       FROM users u
       LEFT JOIN worker_profiles wp ON u.id = wp.user_id
       WHERE u.email = ? AND u.password = ?`,
      [email, password]
    );
    if (!rows.length)
      return res.status(401).json({ error: 'Invalid email or password.' });

    const row   = rows[0];
    const [cats] = await db.query(
      'SELECT category FROM worker_categories WHERE user_id = ?', [row.id]
    );
    const user = buildUser(row, cats.map(c => c.category));
    res.json({ user });
  } catch (err) {
    console.error('LOGIN ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/auth/signup
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName || !role)
      return res.status(400).json({ error: 'All fields required.' });
    if (password.length < 6)
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });

    const [exists] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (exists.length)
      return res.status(409).json({ error: 'Email already registered.' });

    const id = genId();
    await db.query(
      'INSERT INTO users (id, email, password, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [id, email, password, fullName, role]
    );

    // Worker ke liye profile row banana zaroori hai
    if (role === 'worker') {
      await db.query(
        'INSERT INTO worker_profiles (user_id, hourly_rate, total_jobs_completed, rating_average, verified) VALUES (?, NULL, 0, NULL, 0)',
        [id]
      );
    }

    const [rows] = await db.query(
      `SELECT u.*, wp.hourly_rate, wp.total_jobs_completed, wp.rating_average, wp.verified
       FROM users u
       LEFT JOIN worker_profiles wp ON u.id = wp.user_id
       WHERE u.id = ?`,
      [id]
    );
    const user = buildUser(rows[0], []);
    res.status(201).json({ user });
  } catch (err) {
    console.error('SIGNUP ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// =============================================================
//  USER ROUTES
// =============================================================

// GET /api/users  – all users
app.get('/api/users', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.*, wp.hourly_rate, wp.total_jobs_completed, wp.rating_average, wp.verified
       FROM users u
       LEFT JOIN worker_profiles wp ON u.id = wp.user_id`
    );
    const users = await Promise.all(rows.map(async row => {
      const [cats] = await db.query(
        'SELECT category FROM worker_categories WHERE user_id = ?', [row.id]
      );
      return buildUser(row, cats.map(c => c.category));
    }));
    res.json({ users });
  } catch (err) {
    console.error('GET USERS ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/users/:id
app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT u.*, wp.hourly_rate, wp.total_jobs_completed, wp.rating_average, wp.verified
       FROM users u
       LEFT JOIN worker_profiles wp ON u.id = wp.user_id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'User not found.' });

    const [cats] = await db.query(
      'SELECT category FROM worker_categories WHERE user_id = ?', [req.params.id]
    );
    res.json({ user: buildUser(rows[0], cats.map(c => c.category)) });
  } catch (err) {
    console.error('GET USER ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PUT /api/users/:id  – update profile
app.put('/api/users/:id', async (req, res) => {
  try {
    const { fullName, location, phone, bio, hourlyRate, category } = req.body;
    const uid = req.params.id;

    await db.query(
      'UPDATE users SET full_name=?, location=?, phone=?, bio=? WHERE id=?',
      [fullName || '', location || '', phone || '', bio || '', uid]
    );

    // Update worker profile
    if (hourlyRate !== undefined) {
      // Ensure row exists (upsert)
      await db.query(
        `INSERT INTO worker_profiles (user_id, hourly_rate) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE hourly_rate = ?`,
        [uid, hourlyRate || null, hourlyRate || null]
      );
    }

    if (category !== undefined) {
      await db.query('DELETE FROM worker_categories WHERE user_id=?', [uid]);
      if (category) {
        await db.query(
          'INSERT INTO worker_categories (user_id, category) VALUES (?, ?)',
          [uid, category]
        );
      }
    }

    // Return fresh user
    const [rows] = await db.query(
      `SELECT u.*, wp.hourly_rate, wp.total_jobs_completed, wp.rating_average, wp.verified
       FROM users u
       LEFT JOIN worker_profiles wp ON u.id = wp.user_id
       WHERE u.id = ?`,
      [uid]
    );
    const [cats] = await db.query(
      'SELECT category FROM worker_categories WHERE user_id=?', [uid]
    );
    res.json({ user: buildUser(rows[0], cats.map(c => c.category)) });
  } catch (err) {
    console.error('UPDATE USER ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// DELETE /api/users/:id
app.delete('/api/users/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE USER ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// =============================================================
//  JOB ROUTES
// =============================================================

// GET /api/jobs  – list with filters
// FIX: ORDER BY apps bug fixed — use subquery for app count sort
app.get('/api/jobs', async (req, res) => {
  try {
    const { q, category, location, status, postedBy, sort } = req.query;

    let sql = `
      SELECT j.*,
             GROUP_CONCAT(a.id ORDER BY a.applied_at DESC SEPARATOR ',') AS app_ids,
             COUNT(a.id) AS app_count
      FROM jobs j
      LEFT JOIN applications a ON j.id = a.job_id
      WHERE 1=1`;
    const params = [];

    if (q) {
      sql += ' AND (j.title LIKE ? OR j.description LIKE ?)';
      params.push(`%${q}%`, `%${q}%`);
    }
    if (category && category !== 'All Categories') {
      sql += ' AND j.category = ?';
      params.push(category);
    }
    if (location && location !== 'All Locations') {
      sql += ' AND j.location LIKE ?';
      params.push(`%${location}%`);
    }
    if (status)   { sql += ' AND j.status = ?';    params.push(status); }
    if (postedBy) { sql += ' AND j.posted_by = ?'; params.push(postedBy); }

    sql += ' GROUP BY j.id';

    // FIX: app_count alias use karo COUNT ke liye
    const orderMap = {
      'budget-high': 'j.budget DESC',
      'budget-low' : 'j.budget ASC',
      'apps'       : 'app_count DESC',
      'newest'     : 'j.created_at DESC'
    };
    sql += ` ORDER BY ${orderMap[sort] || 'j.created_at DESC'}`;

    const [rows] = await db.query(sql, params);
    const jobs = rows.map(row =>
      buildJob(row, row.app_ids ? row.app_ids.split(',') : [])
    );
    res.json({ jobs });
  } catch (err) {
    console.error('GET JOBS ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/jobs/:id
app.get('/api/jobs/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT j.*,
              GROUP_CONCAT(a.id ORDER BY a.applied_at DESC SEPARATOR ',') AS app_ids
       FROM jobs j
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE j.id = ?
       GROUP BY j.id`,
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: 'Job not found.' });

    const row = rows[0];
    res.json({ job: buildJob(row, row.app_ids ? row.app_ids.split(',') : []) });
  } catch (err) {
    console.error('GET JOB ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/jobs  – create job
app.post('/api/jobs', async (req, res) => {
  try {
    const { title, description, category, location, budget, postedBy } = req.body;
    if (!title || !description || !category || !location || !budget || !postedBy)
      return res.status(400).json({ error: 'All fields required.' });

    const emojis = {
      Cleaning: '🧹', Plumbing: '🔧', Electrical: '⚡',
      Handyman: '🪚', Gardening: '🌿', Tutoring: '📚',
      'Cook/Maid': '🍳', 'Pest Control': '🪲'
    };
    const id = genId();
    await db.query(
      'INSERT INTO jobs (id, title, description, category, location, budget, posted_by, image_emoji) VALUES (?,?,?,?,?,?,?,?)',
      [id, title, description, category, location, parseFloat(budget), postedBy, emojis[category] || '📌']
    );
    const [rows] = await db.query('SELECT * FROM jobs WHERE id=?', [id]);
    res.status(201).json({ job: buildJob(rows[0], []) });
  } catch (err) {
    console.error('POST JOB ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PATCH /api/jobs/:id/status
app.patch('/api/jobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['open', 'closed'].includes(status))
      return res.status(400).json({ error: 'Invalid status.' });
    await db.query('UPDATE jobs SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH JOB STATUS ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// =============================================================
//  APPLICATION ROUTES
// =============================================================

// GET /api/applications
app.get('/api/applications', async (req, res) => {
  try {
    const { jobId, applicantId } = req.query;
    let sql = 'SELECT * FROM applications WHERE 1=1';
    const params = [];
    if (jobId)       { sql += ' AND job_id = ?';       params.push(jobId); }
    if (applicantId) { sql += ' AND applicant_id = ?';  params.push(applicantId); }
    sql += ' ORDER BY applied_at DESC';

    const [rows] = await db.query(sql, params);
    const applications = rows.map(r => ({
      id          : r.id,
      jobId       : r.job_id,
      applicantId : r.applicant_id,
      coverMessage: r.cover_message,
      status      : r.status,
      appliedAt   : r.applied_at instanceof Date ? r.applied_at.toISOString() : r.applied_at
    }));
    res.json({ applications });
  } catch (err) {
    console.error('GET APPS ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/applications
app.post('/api/applications', async (req, res) => {
  try {
    const { jobId, applicantId, coverMessage } = req.body;
    if (!jobId || !applicantId || !coverMessage)
      return res.status(400).json({ error: 'All fields required.' });

    // Duplicate check
    const [exists] = await db.query(
      'SELECT id FROM applications WHERE job_id=? AND applicant_id=?',
      [jobId, applicantId]
    );
    if (exists.length)
      return res.status(409).json({ error: 'You have already applied for this job.' });

    const id = genId();
    await db.query(
      'INSERT INTO applications (id, job_id, applicant_id, cover_message) VALUES (?,?,?,?)',
      [id, jobId, applicantId, coverMessage]
    );
    res.status(201).json({
      application: {
        id, jobId, applicantId, coverMessage,
        status: 'pending',
        appliedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('POST APP ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PATCH /api/applications/:id/status
app.patch('/api/applications/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['pending', 'accepted', 'rejected'].includes(status))
      return res.status(400).json({ error: 'Invalid status.' });
    await db.query('UPDATE applications SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('PATCH APP STATUS ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// DELETE /api/applications/:id  – withdraw
app.delete('/api/applications/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM applications WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('DELETE APP ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// =============================================================
//  REVIEW ROUTES
// =============================================================

// GET /api/reviews?workerId=xxx
app.get('/api/reviews', async (req, res) => {
  try {
    const { workerId } = req.query;
    let sql = 'SELECT * FROM reviews WHERE 1=1';
    const params = [];
    if (workerId) { sql += ' AND worker_id = ?'; params.push(workerId); }
    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.query(sql, params);
    const reviews = rows.map(r => ({
      id         : r.id,
      workerId   : r.worker_id,
      reviewerId : r.reviewer_id,
      rating     : r.rating,
      comment    : r.comment,
      createdAt  : r.created_at instanceof Date ? r.created_at.toISOString() : r.created_at
    }));
    res.json({ reviews });
  } catch (err) {
    console.error('GET REVIEWS ERROR:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// =============================================================
//  START SERVER
// =============================================================
async function start() {
  try {
    await db.query('SELECT 1');
    console.log('✅  MySQL connected successfully');
    app.listen(PORT, () => {
      console.log(`🚀  LocalConnect running at http://localhost:${PORT}`);
      console.log(`📁  Open: http://localhost:${PORT}/pages/auth.html`);
    });
  } catch (err) {
    console.error('❌  MySQL connection failed:', err.message);
    console.error('    Check your .env file — DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
    process.exit(1);
  }
}

start();
