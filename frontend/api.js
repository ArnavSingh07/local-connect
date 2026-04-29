'use strict';

/**
 * api.js — LocalConnect frontend API layer
 * Replaces store.js. Same LC interface, but all data from MySQL via Express.
 *
 * HOW IT WORKS:
 *  - currentUser saved in sessionStorage (stays on tab close, cleared on browser close)
 *  - Every data action is an async API call to http://localhost:3000/api/...
 *  - CSS and HTML logic are UNCHANGED
 */

window.LC = window.LC || {};

// ── Base URL — backend server ─────────────────────────────────
const API_BASE = 'http://localhost:3000/api';

// ── Session helpers ───────────────────────────────────────────
function getSession()     { return JSON.parse(sessionStorage.getItem('lc_user') || 'null'); }
function setSession(user) {
  if (user) sessionStorage.setItem('lc_user', JSON.stringify(user));
  else      sessionStorage.removeItem('lc_user');
}

// ── Core fetch wrapper ────────────────────────────────────────
async function apiFetch(method, endpoint, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body !== undefined) options.body = JSON.stringify(body);

  let res;
  try {
    res = await fetch(API_BASE + endpoint, options);
  } catch (networkErr) {
    throw new Error('Cannot reach server. Is the backend running? (node server.js)');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

// =============================================================
//  LC.store
// =============================================================
LC.store = {

  // currentUser — sync, from sessionStorage
  get currentUser()     { return getSession(); },
  set currentUser(user) { setSession(user); },

  // ── Auth ─────────────────────────────────────────────────
  async login(email, password) {
    const { user } = await apiFetch('POST', '/auth/login', { email, password });
    setSession(user);
    return user;
  },

  async signup(email, password, fullName, role) {
    const { user } = await apiFetch('POST', '/auth/signup', { email, password, fullName, role });
    setSession(user);
    return user;
  },

  logout() { setSession(null); },

  // ── Users ────────────────────────────────────────────────
  async getUser(id) {
    if (!id) return null;
    try {
      const { user } = await apiFetch('GET', `/users/${id}`);
      return user;
    } catch { return null; }
  },

  async updateUser(id, data) {
    const { user } = await apiFetch('PUT', `/users/${id}`, data);
    // Keep session in sync if own profile
    if (this.currentUser && this.currentUser.id === id) setSession(user);
    return user;
  },

  async deleteUser(id) {
    await apiFetch('DELETE', `/users/${id}`);
    if (this.currentUser && this.currentUser.id === id) setSession(null);
  },

  // ── Jobs ─────────────────────────────────────────────────
  async getJobs(filters = {}) {
    const p = new URLSearchParams();
    if (filters.q)        p.set('q',        filters.q);
    if (filters.category) p.set('category', filters.category);
    if (filters.location) p.set('location', filters.location);
    if (filters.status)   p.set('status',   filters.status);
    if (filters.postedBy) p.set('postedBy', filters.postedBy);
    if (filters.sort)     p.set('sort',     filters.sort);
    const qs = p.toString();
    const { jobs } = await apiFetch('GET', `/jobs${qs ? '?' + qs : ''}`);
    return jobs;
  },

  async getJob(id) {
    if (!id) return null;
    try {
      const { job } = await apiFetch('GET', `/jobs/${id}`);
      return job;
    } catch { return null; }
  },

  async postJob(data) {
    const { job } = await apiFetch('POST', '/jobs', data);
    return job;
  },

  async setJobStatus(id, status) {
    await apiFetch('PATCH', `/jobs/${id}/status`, { status });
  },

  // ── Applications ─────────────────────────────────────────
  async getApplications(filters = {}) {
    const p = new URLSearchParams();
    if (filters.jobId)       p.set('jobId',       filters.jobId);
    if (filters.applicantId) p.set('applicantId', filters.applicantId);
    const qs = p.toString();
    const { applications } = await apiFetch('GET', `/applications${qs ? '?' + qs : ''}`);
    return applications;
  },

  async submitApplication(jobId, applicantId, coverMessage) {
    const { application } = await apiFetch('POST', '/applications', { jobId, applicantId, coverMessage });
    return application;
  },

  async setApplicationStatus(id, status) {
    await apiFetch('PATCH', `/applications/${id}/status`, { status });
  },

  async withdrawApplication(id) {
    await apiFetch('DELETE', `/applications/${id}`);
  },

  // ── Reviews ──────────────────────────────────────────────
  async getReviews(workerId) {
    const { reviews } = await apiFetch('GET', `/reviews?workerId=${workerId}`);
    return reviews;
  },

  // Internal: jobId being applied to (used by apply modal)
  _pendingApplyJobId: null
};

// =============================================================
//  LC.utils
// =============================================================
LC.utils = {

  genId() { return '_' + Math.random().toString(36).substr(2, 9); },

  timeAgo(dateString) {
    if (!dateString) return '';
    const d   = new Date(dateString);
    const now = new Date();
    const h   = Math.floor((now - d) / 3600000);
    if (h < 1)  return 'Just now';
    if (h < 24) return `${h}h ago`;
    const days = Math.floor(h / 24);
    return `${days}d ago`;
  },

  formatBudget(amount) {
    return '₹' + Number(amount).toLocaleString('en-IN');
  },

  showToast(message, type = 'info', duration = 3200) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = message;
    t.className   = `toast ${type}`;
    t.style.display = 'block';
    clearTimeout(LC.utils._toastTimer);
    LC.utils._toastTimer = setTimeout(() => { t.style.display = 'none'; }, duration);
  },

  showError(elId, msg) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
  },

  hideError(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.classList.add('hidden');
    el.textContent = '';
  },

  openModal(id)  { document.getElementById(id)?.classList.remove('hidden'); },
  closeModal(id) { document.getElementById(id)?.classList.add('hidden'); },

  closeModalIfBg(e, id) {
    if (e.target === document.getElementById(id)) LC.utils.closeModal(id);
  },

  // FIX: paths relative to pages/ folder
  redirectIfNoAuth(role) {
    if (!LC.store.currentUser) {
      window.location.href = 'auth.html';
      return true;
    }
    if (role && LC.store.currentUser.role !== role) {
      window.location.href = LC.utils.getDashboardUrl();
      return true;
    }
    return false;
  },

  getDashboardUrl() {
    if (!LC.store.currentUser) return 'auth.html';
    return LC.store.currentUser.role === 'job_giver'
      ? 'dashboard-jg.html'
      : 'dashboard-worker.html';
  },

  // Render a job card — appliedJobIds = array of jobIds user already applied to
  renderJobCard(job, opts = {}) {
    const user           = LC.store.currentUser;
    const alreadyApplied = (opts.appliedJobIds || []).includes(job.id);
    const isOwner        = user && job.postedBy === user.id;

    let actionBtn = '';
    if (opts.showApply && !isOwner && user && user.role === 'worker') {
      actionBtn = alreadyApplied
        ? '<span class="badge badge-success">Applied ✓</span>'
        : `<button class="btn btn-primary" onclick="LC.utils.openApplyModal('${job.id}')">Apply Now</button>`;
    }
    if (opts.showManage && isOwner) {
      actionBtn = `<a href="manage-job.html?id=${job.id}" class="btn btn-secondary">Manage</a>`;
    }

    return `
    <div class="job-card fade-in">
      <div class="job-card-img-placeholder">${job.imageEmoji || '📌'}</div>
      <div class="job-card-body">
        <div class="job-card-top">
          <span class="badge badge-accent">${job.category}</span>
          <span class="job-time">${LC.utils.timeAgo(job.createdAt)}</span>
        </div>
        <div class="job-card-title">
          <a href="job-detail.html?id=${job.id}" style="color:inherit;text-decoration:none">${job.title}</a>
        </div>
        <div class="job-card-desc">${job.description}</div>
        <div class="job-card-meta">
          <span class="job-budget">${LC.utils.formatBudget(job.budget)}</span>
          <span class="job-location">📍 ${job.location}</span>
        </div>
        <div class="job-poster">
          👤 ${job.posterName || 'Unknown'} · ${(job.applications || []).length} applicant${(job.applications || []).length !== 1 ? 's' : ''}
        </div>
        <div class="job-card-actions">
          <a href="job-detail.html?id=${job.id}" class="btn btn-outline">View Details</a>
          ${actionBtn}
        </div>
      </div>
    </div>`;
  },

  // Open the apply modal for a given jobId
  openApplyModal(jobId) {
    const user = LC.store.currentUser;
    if (!user) { window.location.href = 'auth.html'; return; }
    if (user.role !== 'worker') {
      LC.utils.showToast('Only workers can apply for jobs.', 'error'); return;
    }

    LC.store._pendingApplyJobId = jobId;

    LC.store.getJob(jobId).then(job => {
      const infoEl = document.getElementById('applyJobInfo');
      if (infoEl && job) {
        infoEl.innerHTML = `
          <strong>${job.title}</strong>
          <div style="margin-top:.4rem;color:var(--fg-muted)">
            Budget: ${LC.utils.formatBudget(job.budget)} &nbsp;·&nbsp; 📍 ${job.location}
          </div>`;
      }
      const propEl = document.getElementById('applyProposal');
      if (propEl) propEl.value = '';
      LC.utils.hideError('applyError');
      LC.utils.openModal('applyModal');
    });
  },

  // Submit application from modal
  async submitApply() {
    const proposal = document.getElementById('applyProposal')?.value.trim();
    if (!proposal || proposal.length < 20) {
      LC.utils.showError('applyError', 'Please write a proposal (at least 20 characters).');
      return;
    }
    const jobId = LC.store._pendingApplyJobId;
    const user  = LC.store.currentUser;
    if (!jobId || !user) {
      LC.utils.showError('applyError', 'Session expired. Please log in again.');
      return;
    }
    try {
      await LC.store.submitApplication(jobId, user.id, proposal);
      LC.utils.closeModal('applyModal');
      LC.utils.showToast('Application submitted! 🎉', 'success');
      if (typeof window.onApplySuccess === 'function') window.onApplySuccess();
    } catch (err) {
      LC.utils.showError('applyError', err.message || 'Failed to submit application.');
    }
  }
};

// =============================================================
//  LC.nav
// =============================================================
LC.nav = {

  // FIX: index.html is in /frontend/, pages are in /frontend/pages/
  // When called from pages/, paths are relative — no prefix needed.
  // When called from index.html, we need 'pages/' prefix.
  // We detect by checking if current URL contains /pages/
  _inPages() {
    return window.location.pathname.includes('/pages/');
  },

  _p(file) {
    // If we're inside pages/, no prefix. If root, need pages/ prefix.
    return LC.nav._inPages() ? file : `pages/${file}`;
  },

  _root() {
    return LC.nav._inPages() ? '../index.html' : 'index.html';
  },

  render(activePage = '') {
    const user    = LC.store.currentUser;
    const dashUrl = LC.utils.getDashboardUrl
      ? (user
          ? (user.role === 'job_giver' ? LC.nav._p('dashboard-jg.html') : LC.nav._p('dashboard-worker.html'))
          : LC.nav._p('auth.html'))
      : LC.nav._p('auth.html');

    const browseUrl  = LC.nav._p('browse.html');
    const authUrl    = LC.nav._p('auth.html');
    const signupUrl  = LC.nav._p('auth.html') + '?tab=signup';
    const profileUrl = LC.nav._p('profile.html');
    const rootUrl    = LC.nav._root();

    const guestLinks = `
      <a href="${browseUrl}" class="nav-link ${activePage === 'browse' ? 'active' : ''}">Browse Services</a>
      <div class="nav-auth">
        <a href="${authUrl}" class="btn btn-ghost">Log In</a>
        <a href="${signupUrl}" class="btn btn-primary">Sign Up</a>
      </div>`;

    const userLinks = user ? `
      <a href="${browseUrl}" class="nav-link ${activePage === 'browse' ? 'active' : ''}">Browse Services</a>
      <a href="${dashUrl}" class="nav-link ${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
      <div class="avatar-wrapper" onclick="LC.nav.toggleUserMenu()">
        <div class="avatar" id="navAvatar">${(user.fullName || 'U')[0].toUpperCase()}</div>
        <div class="user-dropdown hidden" id="userDropdown">
          <a href="${profileUrl}">My Profile</a>
          <a href="${rootUrl}" onclick="LC.nav.logout(event)">Log Out</a>
        </div>
      </div>` : guestLinks;

    const mobileGuest = `
      <a href="${browseUrl}">Browse Services</a>
      <a href="${authUrl}">Log In</a>
      <a href="${signupUrl}">Sign Up</a>`;

    const mobileUser = user ? `
      <a href="${browseUrl}">Browse Services</a>
      <a href="${dashUrl}">Dashboard</a>
      <a href="${profileUrl}">My Profile</a>
      <a href="${rootUrl}" onclick="LC.nav.logout(event)">Log Out</a>` : mobileGuest;

    return `
    <nav class="navbar">
      <div class="nav-container">
        <a href="${rootUrl}" class="nav-logo">
          <span class="logo-icon">⚡</span>
          <span class="logo-text"><span class="logo-local">Local</span><span class="logo-connect">Connect</span></span>
        </a>
        <div class="nav-links">${userLinks}</div>
        <button class="hamburger" onclick="LC.nav.toggleMobile()" id="hamburger">&#9776;</button>
      </div>
      <div class="mobile-menu hidden" id="mobileMenu">${mobileUser}</div>
    </nav>`;
  },

  inject(activePage = '') {
    const el = document.getElementById('navbar-placeholder');
    if (el) el.outerHTML = LC.nav.render(activePage);
  },

  toggleMobile()   { document.getElementById('mobileMenu')?.classList.toggle('hidden'); },
  toggleUserMenu() { document.getElementById('userDropdown')?.classList.toggle('hidden'); },

  logout(e) {
    if (e) e.preventDefault();
    LC.store.logout();
    LC.utils.showToast('Logged out successfully.', 'info');
    setTimeout(() => { window.location.href = LC.nav._root(); }, 600);
  }
};

// Close user dropdown when clicking outside
document.addEventListener('click', e => {
  const dd = document.getElementById('userDropdown');
  const av = document.querySelector('.avatar-wrapper');
  if (dd && av && !av.contains(e.target)) dd.classList.add('hidden');
});

// Close modals on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)')
            .forEach(m => m.classList.add('hidden'));
  }
});
