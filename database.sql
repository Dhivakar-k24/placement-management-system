-- =============================================================
--  Placement Management System — Full Database Setup
--  Run this file once in MySQL / phpMyAdmin
-- =============================================================

CREATE DATABASE IF NOT EXISTS placement_db;
USE placement_db;

-- Students
CREATE TABLE IF NOT EXISTS students (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    name          VARCHAR(100)  NOT NULL,
    email         VARCHAR(100)  NOT NULL UNIQUE,
    department    VARCHAR(50)   NOT NULL,
    cgpa          DECIMAL(3,1)  NOT NULL,
    skills        VARCHAR(300)  NOT NULL DEFAULT '',
    password_hash VARCHAR(64)   NOT NULL DEFAULT ''
);

-- Companies
CREATE TABLE IF NOT EXISTS companies (
    id           INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(100) NOT NULL,
    role_name    VARCHAR(100) NOT NULL,
    min_cgpa     DECIMAL(3,1) NOT NULL
);

-- Confirmed placements
CREATE TABLE IF NOT EXISTS placements (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    company_id INT NOT NULL,
    placed_on  DATE DEFAULT (CURRENT_DATE),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Announcements (posted by admin)
CREATE TABLE IF NOT EXISTS announcements (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    title      VARCHAR(200) NOT NULL,
    body       TEXT         NOT NULL,
    drive_date DATE         DEFAULT NULL,
    posted_on  DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- Applications (student applies to company)
CREATE TABLE IF NOT EXISTS applications (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    student_id INT NOT NULL,
    company_id INT NOT NULL,
    status     ENUM('Applied','Shortlisted','Rejected') DEFAULT 'Applied',
    applied_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_application (student_id, company_id)
);

-- Sample companies
INSERT IGNORE INTO companies (company_name, role_name, min_cgpa) VALUES
('TCS',        'Software Engineer',   7.0),
('Infosys',    'Systems Engineer',    7.5),
('Zoho',       'Software Developer',  8.0),
('Cognizant',  'Associate Developer', 7.0),
('HCL Tech',   'Graduate Engineer',   7.5),
('Freshworks', 'Junior Engineer',     8.5);

-- Sample announcements
INSERT IGNORE INTO announcements (title, body, drive_date) VALUES
('TCS Drive — Register Now',
 'TCS is conducting an on-campus placement drive. All eligible students (CGPA >= 7.0) must register. Bring your updated resume and all mark sheets.',
 DATE_ADD(CURRENT_DATE, INTERVAL 7 DAY)),
('Infosys Walk-in Interview',
 'Infosys will be visiting campus for Systems Engineer role. Students with CGPA >= 7.5 are eligible. Written test followed by two interview rounds.',
 DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY));
