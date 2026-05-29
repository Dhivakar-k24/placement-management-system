// =============================================================
//  Placement Management System — Client Script
//  All data operations use fetch() to call /api/... endpoints
// =============================================================


// --- Flash message helper ------------------------------------
function showMessage(text, type = 'success') {
    const existing = document.querySelector('.flash');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.className = `flash ${type}`;
    const icons = { success: '✅', danger: '❌', info: 'ℹ️', warning: '⚠️' };
    div.textContent = (icons[type] || '') + ' ' + text;

    const container = document.querySelector('.flash-container') || document.querySelector('.page-body');
    if (container) container.prepend(div);

    setTimeout(() => {
        div.style.transition = 'opacity 0.5s';
        div.style.opacity = '0';
        setTimeout(() => div.remove(), 500);
    }, 4000);
}


// --- POST form data to an API endpoint -----------------------
async function postData(url, formData) {
    const body = new URLSearchParams(formData).toString();
    const res  = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    body
    });
    return res.json();
}


// --- Confirm delete helper -----------------------------------
function confirmDelete(name) {
    return confirm(`Delete "${name}"?\nThis cannot be undone.`);
}


// --- Render skill tags from comma-separated text -------------
function renderSkillTags(text) {
    return text.split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => `<span class="skill-tag">${s}</span>`)
        .join('');
}


// --- CGPA badge HTML -----------------------------------------
function cgpaBadge(cgpa) {
    const cls = cgpa >= 8.0 ? 'cgpa-high' : cgpa >= 7.0 ? 'cgpa-mid' : 'cgpa-low';
    return `<span class="cgpa-badge ${cls}">${cgpa}</span>`;
}


// =============================================================
//  STUDENTS PAGE
// =============================================================

async function loadStudents(filter = '') {
    const tbody = document.getElementById('student-tbody');
    if (!tbody) return;

    const rows = await fetch('/api/students').then(r => r.json());
    const filtered = rows.filter(s =>
        s.name.toLowerCase().includes(filter.toLowerCase()) ||
        s.department.toLowerCase().includes(filter.toLowerCase())
    );

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px;">
            No students found${filter ? ` for "${filter}"` : ''}.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtered.map(s => `
        <tr>
            <td style="color:var(--muted);font-size:0.8rem">${s.id}</td>
            <td><strong>${s.name}</strong></td>
            <td style="color:var(--muted)">${s.email}</td>
            <td><span class="dept-badge">${s.department}</span></td>
            <td>${cgpaBadge(s.cgpa)}</td>
            <td>${renderSkillTags(s.skills)}</td>
            <td>${s.cgpa >= 7.5
                ? '<span style="color:var(--success);font-size:0.78rem;font-weight:700">✅ Eligible</span>'
                : '<span style="color:var(--muted);font-size:0.78rem">Not Eligible</span>'
            }</td>
            <td>${currentRole === 'admin'
                ? `<button class="btn btn-danger btn-sm" onclick="deleteStudent(${s.id}, '${s.name.replace(/'/g,"\\'")}')">🗑 Delete</button>`
                : '—'
            }</td>
        </tr>
    `).join('');
}

async function addStudent(event) {
    event.preventDefault();
    const form = event.target;
    const data = {
        name:       form.name_.value.trim(),
        email:      form.email.value.trim(),
        department: form.department.value,
        cgpa:       form.cgpa.value,
        skills:     form.skills.value.trim()
    };
    const res = await postData('/api/add_student', data);
    if (res.success) {
        showMessage(`Student "${data.name}" added!`, 'success');
        form.reset();
        loadStudents();
    } else {
        showMessage('Error adding student.', 'danger');
    }
}

async function deleteStudent(id, name) {
    if (!confirmDelete(name)) return;
    const res = await fetch(`/api/delete_student/${id}`).then(r => r.json());
    if (res.success) {
        showMessage('Student deleted.', 'info');
        loadStudents();
    }
}

function searchStudents() {
    const keyword = document.getElementById('search-input').value.trim();
    loadStudents(keyword);
}


// =============================================================
//  COMPANIES PAGE
// =============================================================

async function loadCompanies() {
    const tbody = document.getElementById('company-tbody');
    if (!tbody) return;

    const rows = await fetch('/api/companies').then(r => r.json());

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:32px;">
            No companies added yet.</td></tr>`;
        return;
    }

    tbody.innerHTML = rows.map(c => `
        <tr>
            <td style="color:var(--muted);font-size:0.8rem">${c.id}</td>
            <td><strong>${c.company_name}</strong></td>
            <td>${c.role_name}</td>
            <td>${cgpaBadge(c.min_cgpa)}+</td>
            <td>${currentRole === 'admin'
                ? `<button class="btn btn-danger btn-sm" onclick="deleteCompany(${c.id}, '${c.company_name.replace(/'/g,"\\'")}')">🗑 Delete</button>`
                : '—'
            }</td>
        </tr>
    `).join('');
}

async function addCompany(event) {
    event.preventDefault();
    const form = event.target;
    const data = {
        company_name: form.company_name.value.trim(),
        role_name:    form.role_name.value.trim(),
        min_cgpa:     form.min_cgpa.value
    };
    const res = await postData('/api/add_company', data);
    if (res.success) {
        showMessage(`Company "${data.company_name}" added!`, 'success');
        form.reset();
        loadCompanies();
    } else {
        showMessage('Error adding company.', 'danger');
    }
}

async function deleteCompany(id, name) {
    if (!confirmDelete(name)) return;
    const res = await fetch(`/api/delete_company/${id}`).then(r => r.json());
    if (res.success) {
        showMessage('Company deleted.', 'info');
        loadCompanies();
    }
}


// =============================================================
//  PLACEMENT ELIGIBILITY PAGE
// =============================================================

async function loadEligibility() {
    const eligibleTbody = document.getElementById('eligible-tbody');
    const matchGrid     = document.getElementById('match-grid');
    if (!eligibleTbody && !matchGrid) return;

    if (eligibleTbody) {
        const rows = await fetch('/api/students').then(r => r.json());
        const eligible = rows.filter(s => s.cgpa >= 7.5);
        if (eligible.length === 0) {
            eligibleTbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:32px;">
                No eligible students (CGPA ≥ 7.5) found.</td></tr>`;
        } else {
            eligibleTbody.innerHTML = eligible.map(s => `
                <tr>
                    <td><strong>${s.name}</strong></td>
                    <td><span class="dept-badge">${s.department}</span></td>
                    <td>${cgpaBadge(s.cgpa)}</td>
                    <td>${renderSkillTags(s.skills)}</td>
                </tr>
            `).join('');
        }
    }

    if (matchGrid) {
        const matches = await fetch('/api/placement_matches').then(r => r.json());
        if (matches.length === 0) {
            matchGrid.innerHTML = `<p style="color:var(--muted);text-align:center;padding:32px;">
                No matches found. Add students and companies to see matches.</p>`;
        } else {
            matchGrid.innerHTML = matches.map(m => `
                <div class="match-card">
                    <div class="match-student">${m.student}</div>
                    <div class="match-role">${m.dept} · CGPA ${m.cgpa}</div>
                    <div class="match-company">🏢 ${m.company} — ${m.role}</div>
                </div>
            `).join('');
        }
    }
}


// =============================================================
//  CONFIRMED PLACEMENTS PAGE
// =============================================================

async function loadPlacements() {
    const tbody   = document.getElementById('placement-tbody');
    const stuSel  = document.getElementById('sel-student');
    const compSel = document.getElementById('sel-company');
    if (!tbody) return;

    // Load placement records
    const rows = await fetch('/api/placements').then(r => r.json());
    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:32px;">
            No confirmed placements yet.</td></tr>`;
    } else {
        tbody.innerHTML = rows.map(p => `
            <tr>
                <td style="color:var(--muted);font-size:0.8rem">${p.id}</td>
                <td><strong>${p.student}</strong></td>
                <td><span class="dept-badge">${p.department}</span></td>
                <td>${p.company}</td>
                <td>${p.role}</td>
                <td style="color:var(--muted);font-size:0.83rem">${p.date}</td>
            </tr>
        `).join('');
    }

    // Populate student dropdown
    if (stuSel) {
        const students = await fetch('/api/eligible_students').then(r => r.json());
        stuSel.innerHTML = '<option value="" disabled selected>Select student</option>' +
            students.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    }

    // Populate company dropdown
    if (compSel) {
        const companies = await fetch('/api/companies').then(r => r.json());
        compSel.innerHTML = '<option value="" disabled selected>Select company</option>' +
            companies.map(c => `<option value="${c.id}">${c.company_name} — ${c.role_name}</option>`).join('');
    }
}

async function addPlacement(event) {
    event.preventDefault();
    const form = event.target;
    const data = {
        student_id: form.student_id.value,
        company_id: form.company_id.value
    };
    const res = await postData('/api/add_placement', data);
    if (res.success) {
        showMessage('Placement recorded!', 'success');
        form.reset();
        loadPlacements();
    } else {
        showMessage('Error recording placement.', 'danger');
    }
}


// --- Active nav link highlight -------------------------------
document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && path.startsWith(href) && href !== '/') {
            link.classList.add('active');
        } else if (href === '/' && path === '/') {
            link.classList.add('active');
        }
    });
});


// =============================================================
//  ANNOUNCEMENTS PAGE
// =============================================================

async function loadAnnouncements() {
  const list = document.getElementById('ann-list');
  if (!list) return;

  const me   = await fetch('/api/me').then(r => r.json());
  const rows = await fetch('/api/announcements').then(r => r.json());

  if (rows.length === 0) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">📢</div>
      <p>No announcements yet. Admin will post upcoming drive details here.</p>
    </div>`;
    return;
  }

  list.innerHTML = rows.map(a => `
    <div class="announcement-card" id="ann-${a.id}">
      <div class="ann-header">
        <div class="ann-title">📢 ${a.title}</div>
        ${me.role === 'admin'
          ? `<button class="btn btn-danger btn-sm" onclick="deleteAnnouncement(${a.id})">🗑 Delete</button>`
          : ''}
      </div>
      <div class="ann-body">${a.body}</div>
      <div class="ann-meta">
        ${a.drive_date ? `<span class="ann-badge drive">📅 Drive Date: ${a.drive_date}</span>` : ''}
        <span class="ann-badge posted">🕒 Posted: ${a.posted_on.slice(0,10)}</span>
      </div>
    </div>
  `).join('');
}

async function addAnnouncement(event) {
  event.preventDefault();
  const form = event.target;
  const data = {
    title:      form.title.value.trim(),
    body:       form.body.value.trim(),
    drive_date: form.drive_date.value || ''
  };
  const res = await postData('/api/add_announcement', data);
  if (res.success) {
    showMessage('Announcement posted!', 'success');
    form.reset();
    loadAnnouncements();
  } else {
    showMessage(res.error || 'Error posting announcement.', 'danger');
  }
}

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  const res = await fetch(`/api/delete_announcement/${id}`).then(r => r.json());
  if (res.success) {
    document.getElementById(`ann-${id}`)?.remove();
    showMessage('Announcement deleted.', 'info');
  }
}


// =============================================================
//  APPLICATIONS PAGE
// =============================================================

async function loadApplications() {
  const me   = await fetch('/api/me').then(r => r.json());
  const rows = await fetch('/api/applications').then(r => r.json());

  if (me.role === 'admin') {
    const tbody = document.getElementById('admin-app-tbody');
    if (!tbody) return;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--muted);">
        No applications yet.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(a => `
      <tr>
        <td style="color:var(--muted);font-size:0.8rem">${a.id}</td>
        <td><strong>${a.student}</strong></td>
        <td><span class="dept-badge">${a.dept}</span></td>
        <td>${cgpaBadge(a.cgpa)}</td>
        <td>${a.company}</td>
        <td>${a.role}</td>
        <td><span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span></td>
        <td>
          <select class="status-select" onchange="updateStatus(${a.id}, this.value)">
            <option ${a.status==='Applied'     ? 'selected':''}>Applied</option>
            <option ${a.status==='Shortlisted' ? 'selected':''}>Shortlisted</option>
            <option ${a.status==='Rejected'    ? 'selected':''}>Rejected</option>
          </select>
        </td>
      </tr>
    `).join('');

  } else {
    const tbody = document.getElementById('student-app-tbody');
    if (!tbody) return;
    if (rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--muted);">
        No applications yet. Go to <a href="/profile" style="color:var(--accent);">My Profile</a> to apply.</td></tr>`;
      return;
    }
    tbody.innerHTML = rows.map(a => `
      <tr>
        <td><strong>${a.company}</strong></td>
        <td>${a.role}</td>
        <td><span class="status-badge status-${a.status.toLowerCase()}">${a.status}</span></td>
        <td style="color:var(--muted);font-size:0.83rem">${a.date.slice(0,10)}</td>
      </tr>
    `).join('');
  }
}

async function updateStatus(appId, status) {
  const res = await postData('/api/update_application_status', { app_id: appId, status });
  if (res.success) {
    showMessage(`Status updated to "${status}".`, 'success');
    loadApplications();
  } else {
    showMessage('Failed to update status.', 'danger');
  }
}


// =============================================================
//  PROFILE PAGE — Apply button
// =============================================================

async function applyToCompany(companyId, btnEl) {
  btnEl.disabled = true;
  btnEl.textContent = 'Applying...';
  const res = await postData('/api/apply', { company_id: companyId });
  if (res.success) {
    btnEl.textContent = '✅ Applied';
    showMessage('Application submitted!', 'success');
    loadMyApplicationStatus();
  } else {
    showMessage(res.error || 'Error applying.', 'danger');
    btnEl.disabled = false;
    btnEl.textContent = 'Apply';
  }
}

async function loadMyApplicationStatus() {
  // Called on profile page to update which companies already applied
  const rows = await fetch('/api/applications').then(r => r.json());
  const appliedIds = new Set(rows.map(a => a.company_name));  // using company name fallback
  // Also refresh the match table apply buttons
  document.querySelectorAll('[data-company-id]').forEach(btn => {
    const alreadyApplied = rows.some(a => String(a.company) === btn.dataset.companyName);
    if (alreadyApplied) {
      btn.disabled = true;
      btn.textContent = '✅ Applied';
    }
  });
}

async function loadPlacementStatus() {
  const box = document.getElementById('placement-status-box');
  if (!box) return;
  const data = await fetch('/api/my_placement_status').then(r => r.json());
  if (data.placed) {
    box.className = 'placement-status-card placed';
    box.innerHTML = `
      <div class="status-icon-big">🎉</div>
      <div>
        <div class="status-detail-title">Congratulations! You are Placed</div>
        <div class="status-detail-sub">
          Company: <strong>${data.company}</strong> &nbsp;|&nbsp;
          Role: <strong>${data.role}</strong> &nbsp;|&nbsp;
          Date: ${data.date}
        </div>
      </div>`;
  } else {
    box.className = 'placement-status-card not-placed';
    box.innerHTML = `
      <div class="status-icon-big">⏳</div>
      <div>
        <div class="status-detail-title">Not Yet Placed</div>
        <div class="status-detail-sub">Keep applying! Check the Announcements page for upcoming drives.</div>
      </div>`;
  }
}
