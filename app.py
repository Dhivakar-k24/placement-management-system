# =============================================================
#  Placement Management System
#  Flask + MySQL | Roles: Admin & Student
#  Features: Auth, Announcements, Applications, Placement Status
#  Author : Dhiva | SKASC Coimbatore
#  Run    : python app.py
#  Open   : http://localhost:5000
# =============================================================

from flask import (Flask, render_template, request, redirect,
                   url_for, session, jsonify, flash)
from flask_mysqldb import MySQL
from functools import wraps
import hashlib

# ------------------------------------------------------------------
# App Setup
# ------------------------------------------------------------------
app = Flask(__name__)
app.secret_key = 'pms_skasc_secret_2024'

# ------------------------------------------------------------------
# MySQL Config
# ------------------------------------------------------------------
app.config['MYSQL_HOST']     = 'localhost'
app.config['MYSQL_USER']     = 'root'
app.config['MYSQL_PASSWORD'] = ''
app.config['MYSQL_DB']       = 'placement_db'

mysql = MySQL(app)

# ------------------------------------------------------------------
# Admin Credentials
# ------------------------------------------------------------------
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'admin123'

# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------
def hash_password(password):
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

def check_password(password, hashed):
    return hash_password(password) == hashed

def db_query(sql, params=(), fetch='all'):
    cur = mysql.connection.cursor()
    cur.execute(sql, params)
    if fetch == 'all':
        result = cur.fetchall()
    elif fetch == 'one':
        result = cur.fetchone()
    else:
        mysql.connection.commit()
        result = cur.lastrowid
    cur.close()
    return result

# ------------------------------------------------------------------
# Decorators
# ------------------------------------------------------------------
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'role' not in session:
            flash('Please login first.', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'admin':
            return jsonify({'error': 'forbidden'}), 403
        return f(*args, **kwargs)
    return decorated

def student_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if session.get('role') != 'student':
            return jsonify({'error': 'forbidden'}), 403
        return f(*args, **kwargs)
    return decorated

def api_login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'role' not in session:
            return jsonify({'error': 'unauthorized'}), 401
        return f(*args, **kwargs)
    return decorated

# ==================================================================
# PUBLIC ROUTES
# ==================================================================

@app.route('/')
def home():
    return render_template('index.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'role' in session:
        return redirect(url_for('dashboard'))
    return render_template('login.html')


@app.route('/login/admin', methods=['POST'])
def login_admin():
    username = request.form.get('username', '').strip()
    password = request.form.get('password', '')
    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        session['role'] = 'admin'
        session['name'] = 'Admin'
        session['id']   = None
        return redirect(url_for('dashboard'))
    return render_template('login.html', admin_error='❌ Invalid admin credentials.')


@app.route('/login/student', methods=['POST'])
def login_student():
    email = request.form.get('email', '').strip().lower()
    pwd   = request.form.get('password', '')
    row   = db_query(
        "SELECT id, name, password_hash FROM students WHERE email=%s",
        (email,), fetch='one'
    )
    if row and check_password(pwd, row[2]):
        session['role'] = 'student'
        session['name'] = row[1]
        session['id']   = row[0]
        return redirect(url_for('dashboard'))
    return render_template('login.html', student_error='❌ Invalid email or password.')


@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'role' in session:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        name   = request.form.get('name', '').strip()
        email  = request.form.get('email', '').strip().lower()
        dept   = request.form.get('department', '')
        cgpa   = request.form.get('cgpa', '0')
        skills = request.form.get('skills', '').strip()
        pwd    = request.form.get('password', '')
        cpwd   = request.form.get('confirm_password', '')

        error = None
        if not all([name, email, dept, cgpa, pwd]):
            error = 'All fields are required.'
        elif pwd != cpwd:
            error = 'Passwords do not match.'
        elif len(pwd) < 6:
            error = 'Password must be at least 6 characters.'
        elif db_query("SELECT id FROM students WHERE email=%s", (email,), fetch='one'):
            error = 'This email is already registered.'

        if error:
            return render_template('register.html', error=error)

        hashed = hash_password(pwd)
        db_query(
            "INSERT INTO students (name,email,department,cgpa,skills,password_hash) VALUES (%s,%s,%s,%s,%s,%s)",
            (name, email, dept, cgpa, skills, hashed), fetch='none'
        )
        row = db_query("SELECT id FROM students WHERE email=%s", (email,), fetch='one')
        session['role'] = 'student'
        session['name'] = name
        session['id']   = row[0]
        flash(f'Welcome, {name}! Account created successfully.', 'success')
        return redirect(url_for('dashboard'))

    return render_template('register.html')


@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out.', 'info')
    return redirect(url_for('login'))


# ==================================================================
# PROTECTED PAGE ROUTES
# ==================================================================

@app.route('/dashboard')
@login_required
def dashboard():
    total_s  = db_query("SELECT COUNT(*) FROM students",  fetch='one')[0]
    total_c  = db_query("SELECT COUNT(*) FROM companies", fetch='one')[0]
    eligible = db_query("SELECT COUNT(*) FROM students WHERE cgpa >= 7.5", fetch='one')[0]
    placed   = db_query("SELECT COUNT(*) FROM placements", fetch='one')[0]
    return render_template('dashboard.html',
        total_students=total_s,
        total_companies=total_c,
        eligible_students=eligible,
        total_placements=placed
    )

@app.route('/students')
@login_required
def students():
    return render_template('students.html')

@app.route('/companies')
@login_required
def companies():
    return render_template('companies.html')

@app.route('/placement')
@login_required
def placement():
    return render_template('placement.html')

@app.route('/placements')
@login_required
def placements():
    return render_template('placements.html')

@app.route('/announcements')
@login_required
def announcements():
    return render_template('announcements.html')

@app.route('/applications')
@login_required
def applications():
    return render_template('applications.html')

@app.route('/profile')
@login_required
def profile():
    if session.get('role') != 'student':
        return redirect(url_for('dashboard'))
    return render_template('profile.html')


# ==================================================================
# API ROUTES
# ==================================================================

@app.route('/api/me')
@api_login_required
def api_me():
    return jsonify({
        'role': session['role'],
        'name': session['name'],
        'id':   session.get('id')
    })

# ── Students ──────────────────────────────────────────────────────

@app.route('/api/students')
@api_login_required
def api_students():
    rows = db_query("SELECT id,name,email,department,cgpa,skills FROM students ORDER BY name ASC")
    return jsonify([{'id':r[0],'name':r[1],'email':r[2],'department':r[3],'cgpa':float(r[4]),'skills':r[5]} for r in rows])

@app.route('/api/add_student', methods=['POST'])
@admin_required
def api_add_student():
    data = request.form
    default_hash = hash_password(data['email'].strip())
    db_query(
        "INSERT INTO students (name,email,department,cgpa,skills,password_hash) VALUES (%s,%s,%s,%s,%s,%s)",
        (data['name'].strip(), data['email'].strip(), data['department'],
         data['cgpa'], data['skills'].strip(), default_hash),
        fetch='none'
    )
    return jsonify({'success': True})

@app.route('/api/delete_student/<int:sid>')
@admin_required
def api_delete_student(sid):
    db_query("DELETE FROM students WHERE id=%s", (sid,), fetch='none')
    return jsonify({'success': True})

@app.route('/api/my_profile')
@student_required
def api_my_profile():
    row = db_query(
        "SELECT id,name,email,department,cgpa,skills FROM students WHERE id=%s",
        (session['id'],), fetch='one'
    )
    if row:
        return jsonify({'id':row[0],'name':row[1],'email':row[2],'department':row[3],'cgpa':float(row[4]),'skills':row[5]})
    return jsonify({'error': 'not found'}), 404

@app.route('/api/my_matches')
@student_required
def api_my_matches():
    rows = db_query("""
        SELECT c.id, c.company_name, c.role_name, c.min_cgpa
        FROM students s JOIN companies c ON s.cgpa >= c.min_cgpa
        WHERE s.id = %s ORDER BY c.company_name ASC
    """, (session['id'],))
    return jsonify([{'id':r[0],'company':r[1],'role':r[2],'min_cgpa':float(r[3])} for r in rows])

# ── Companies ─────────────────────────────────────────────────────

@app.route('/api/companies')
@api_login_required
def api_companies():
    rows = db_query("SELECT * FROM companies ORDER BY company_name ASC")
    return jsonify([{'id':r[0],'company_name':r[1],'role_name':r[2],'min_cgpa':float(r[3])} for r in rows])

@app.route('/api/add_company', methods=['POST'])
@admin_required
def api_add_company():
    data = request.form
    db_query(
        "INSERT INTO companies (company_name,role_name,min_cgpa) VALUES (%s,%s,%s)",
        (data['company_name'].strip(), data['role_name'].strip(), data['min_cgpa']),
        fetch='none'
    )
    return jsonify({'success': True})

@app.route('/api/delete_company/<int:cid>')
@admin_required
def api_delete_company(cid):
    db_query("DELETE FROM companies WHERE id=%s", (cid,), fetch='none')
    return jsonify({'success': True})

# ── Placements ────────────────────────────────────────────────────

@app.route('/api/placements')
@api_login_required
def api_placements():
    rows = db_query("""
        SELECT p.id, s.name, s.department, c.company_name, c.role_name, p.placed_on
        FROM placements p
        JOIN students s ON p.student_id = s.id
        JOIN companies c ON p.company_id = c.id
        ORDER BY p.placed_on DESC
    """)
    return jsonify([{'id':r[0],'student':r[1],'department':r[2],'company':r[3],'role':r[4],'date':str(r[5])} for r in rows])

@app.route('/api/add_placement', methods=['POST'])
@admin_required
def api_add_placement():
    data = request.form
    db_query(
        "INSERT INTO placements (student_id,company_id) VALUES (%s,%s)",
        (data['student_id'], data['company_id']), fetch='none'
    )
    return jsonify({'success': True})

@app.route('/api/eligible_students')
@api_login_required
def api_eligible_students():
    rows = db_query("SELECT id, name FROM students WHERE cgpa >= 7.5 ORDER BY name ASC")
    return jsonify([{'id':r[0],'name':r[1]} for r in rows])

@app.route('/api/placement_matches')
@api_login_required
def api_placement_matches():
    rows = db_query("""
        SELECT s.name, s.department, s.cgpa, s.skills, c.company_name, c.role_name
        FROM students s JOIN companies c ON s.cgpa >= c.min_cgpa
        ORDER BY s.cgpa DESC
    """)
    return jsonify([{'student':r[0],'dept':r[1],'cgpa':float(r[2]),'skills':r[3],'company':r[4],'role':r[5]} for r in rows])

@app.route('/api/my_placement_status')
@student_required
def api_my_placement_status():
    row = db_query("""
        SELECT c.company_name, c.role_name, p.placed_on
        FROM placements p
        JOIN companies c ON p.company_id = c.id
        WHERE p.student_id = %s
        ORDER BY p.placed_on DESC LIMIT 1
    """, (session['id'],), fetch='one')
    if row:
        return jsonify({'placed': True, 'company': row[0], 'role': row[1], 'date': str(row[2])})
    return jsonify({'placed': False})

# ── Announcements ─────────────────────────────────────────────────

@app.route('/api/announcements')
@api_login_required
def api_announcements():
    rows = db_query("SELECT id,title,body,drive_date,posted_on FROM announcements ORDER BY posted_on DESC")
    return jsonify([{'id':r[0],'title':r[1],'body':r[2],
                     'drive_date':str(r[3]) if r[3] else '',
                     'posted_on':str(r[4])} for r in rows])

@app.route('/api/add_announcement', methods=['POST'])
@admin_required
def api_add_announcement():
    data       = request.form
    title      = data.get('title', '').strip()
    body       = data.get('body', '').strip()
    drive_date = data.get('drive_date', '').strip() or None
    if not title or not body:
        return jsonify({'error': 'Title and message are required.'}), 400
    db_query(
        "INSERT INTO announcements (title,body,drive_date) VALUES (%s,%s,%s)",
        (title, body, drive_date), fetch='none'
    )
    return jsonify({'success': True})

@app.route('/api/delete_announcement/<int:aid>')
@admin_required
def api_delete_announcement(aid):
    db_query("DELETE FROM announcements WHERE id=%s", (aid,), fetch='none')
    return jsonify({'success': True})

# ── Applications ──────────────────────────────────────────────────

@app.route('/api/applications')
@api_login_required
def api_applications():
    if session['role'] == 'admin':
        rows = db_query("""
            SELECT a.id, s.name, s.department, s.cgpa,
                   c.company_name, c.role_name, a.status, a.applied_on
            FROM applications a
            JOIN students s ON a.student_id = s.id
            JOIN companies c ON a.company_id = c.id
            ORDER BY a.applied_on DESC
        """)
        return jsonify([{'id':r[0],'student':r[1],'dept':r[2],'cgpa':float(r[3]),
                         'company':r[4],'role':r[5],'status':r[6],'date':str(r[7])} for r in rows])
    else:
        rows = db_query("""
            SELECT a.id, c.company_name, c.role_name, a.status, a.applied_on
            FROM applications a
            JOIN companies c ON a.company_id = c.id
            WHERE a.student_id = %s ORDER BY a.applied_on DESC
        """, (session['id'],))
        return jsonify([{'id':r[0],'company':r[1],'role':r[2],'status':r[3],'date':str(r[4])} for r in rows])

@app.route('/api/apply', methods=['POST'])
@student_required
def api_apply():
    company_id = request.form.get('company_id')
    eligible = db_query("""
        SELECT 1 FROM students s JOIN companies c ON s.cgpa >= c.min_cgpa
        WHERE s.id=%s AND c.id=%s
    """, (session['id'], company_id), fetch='one')
    if not eligible:
        return jsonify({'error': 'You are not eligible for this company.'}), 403
    already = db_query(
        "SELECT id FROM applications WHERE student_id=%s AND company_id=%s",
        (session['id'], company_id), fetch='one'
    )
    if already:
        return jsonify({'error': 'You have already applied to this company.'}), 409
    db_query(
        "INSERT INTO applications (student_id,company_id) VALUES (%s,%s)",
        (session['id'], company_id), fetch='none'
    )
    return jsonify({'success': True})

@app.route('/api/update_application_status', methods=['POST'])
@admin_required
def api_update_application_status():
    app_id = request.form.get('app_id')
    status = request.form.get('status')
    if status not in ('Applied', 'Shortlisted', 'Rejected'):
        return jsonify({'error': 'Invalid status.'}), 400
    db_query(
        "UPDATE applications SET status=%s WHERE id=%s",
        (status, app_id), fetch='none'
    )
    return jsonify({'success': True})


# ==================================================================
# Run
# ==================================================================
if __name__ == '__main__':
    print("=" * 50)
    print("  Placement Management System (Flask)")
    print("  Running at : http://localhost:5000")
    print("  Admin login: admin / admin123")
    print("  Students   : Register at /register")
    print("=" * 50)
    app.run(debug=True)
