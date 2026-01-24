Phase 1 - Core Meetings (No Media)

Goals
- Backend API for meeting creation/join
- MySQL schema for meetings and participants
- Simple web UI for create/join
- JWT tokens for meeting access

Deliverables
- PHP API endpoints:
  - POST /meeting_app/api/meetings.php
  - POST /meeting_app/api/join.php?meeting_id=...
  - POST /meeting_app/api/leave.php?meeting_id=...&session_token=...
  - POST /meeting_app/api/stop.php?meeting_id=...&host_token=...
  - GET /meeting_app/api/participants.php?meeting_id=...&host_token=...
  - GET /meeting_app/api/participants_public.php?meeting_id=...
  - POST /meeting_app/api/remove.php?meeting_id=...&host_token=...&session_token=...
  - GET /meeting_app/api/status.php?meeting_id=...&session_token=...
  - GET /meeting_app/api/meeting.php?meeting_id=...
- MySQL schema SQL
- Frontend HTML + JS for create/join

Out of Scope
- Audio/video
- SFU/TURN
- Admin dashboard

Setup Steps (local with Apache)
Dependencies (AlmaLinux/RHEL)
- httpd
- php
- php-fpm
- php-mysqlnd
- php-json
- mysql-server (optional, if DB not installed)

MySQL Auth Note (PHP 7.2)
- PHP 7.2 requires mysql_native_password.
- Use:
  ALTER USER 'meeting_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'meeting_pass';
  CREATE USER 'meeting_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'meeting_pass';
  GRANT ALL PRIVILEGES ON meeting_app.* TO 'meeting_user'@'127.0.0.1';
  FLUSH PRIVILEGES;

Install command:
sudo dnf install -y httpd php php-fpm php-mysqlnd php-json

1) Create DB and user in MySQL.
2) Copy frontend/ and api/ into /var/www/html/meeting_app.
3) Update DB settings in /var/www/html/meeting_app/api/config.php if needed.
4) Ensure Apache + PHP are installed and running.
5) Open http://127.0.0.1/meeting_app/.

Usage Flow (Phase 1)
- Create Instant Meeting: click "Create Instant Link" to generate guest + host links.
- Create Scheduled Meeting: fill title, date/time, duration, optional password.
- Host joins using host link; guests can only join after host joins.

Expiration Rules
- Instant meeting expires after 60 minutes if no one has joined.
- Once someone joins, meeting is valid for 24 hours from first join.

Schema Update (if upgrading existing DB)
-- Meetings table updates:
ALTER TABLE meetings
  MODIFY id VARCHAR(20),
  MODIFY password_hash VARCHAR(255) NULL,
  ADD COLUMN meeting_type VARCHAR(20) NOT NULL DEFAULT 'instant',
  ADD COLUMN scheduled_start DATETIME NULL,
  ADD COLUMN duration_minutes INT NULL,
  ADD COLUMN host_token VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN host_joined TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN first_joined_at DATETIME NULL,
  ADD COLUMN ended_at DATETIME NULL,
  ADD COLUMN expires_at DATETIME NULL;

-- Participants table updates:
ALTER TABLE participants
  MODIFY meeting_id VARCHAR(20),
  ADD COLUMN is_host TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN session_token VARCHAR(64) NOT NULL DEFAULT '',
  ADD COLUMN left_at DATETIME NULL,
  ADD COLUMN left_reason VARCHAR(20) NULL;

Troubleshooting (Common Issues)

1) PHP file downloads or shows raw <?php
- Cause: PHP not enabled in Apache.
- Fix:
  sudo dnf install -y php php-fpm php-mysqlnd php-json
  sudo systemctl enable --now php-fpm
  sudo systemctl restart httpd

2) Error: Unexpected token '<' or not valid JSON
- Cause: Apache is returning HTML instead of JSON (PHP not running).
- Fix: Use step (1) above and retest.

3) Error: Unexpected end of JSON input / empty response
- Cause: PHP fatal error.
- Check:
  sudo tail -n 80 /var/log/php-fpm/www-error.log

4) API returns {"error":"Database connection failed"}
- Check DB login:
  mysql -u meeting_user -p -h 127.0.0.1 -D meeting_app -e "select 1;"
- If works in CLI but fails in PHP 7.2, set MySQL auth:
  mysql -u root -p
  ALTER USER 'meeting_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'meeting_pass';
  CREATE USER 'meeting_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'meeting_pass';
  GRANT ALL PRIVILEGES ON meeting_app.* TO 'meeting_user'@'127.0.0.1';
  FLUSH PRIVILEGES;
  EXIT;

5) PHP error: Call to undefined function json_encode()
- Cause: php-json missing.
- Fix:
  sudo dnf install -y php-json
  sudo systemctl restart php-fpm httpd

6) Update frontend changes not visible
- Cause: Apache serves /var/www/html/meeting_app, not repo.
- Fix:
  sudo cp -r /home/suresh/pam_ops_2026/meeting_app/frontend/* /var/www/html/meeting_app/
  Hard refresh in browser (Ctrl+F5).

Next: Phase 2 integrates LiveKit for group audio/video.

Step-by-Step Setup (Linux)

1) Create MySQL database and user
- Log in to MySQL as root:
  mysql -u root -p
- Run:
  CREATE DATABASE meeting_app;
  CREATE USER 'meeting_user'@'localhost' IDENTIFIED BY 'meeting_pass';
  GRANT ALL PRIVILEGES ON meeting_app.* TO 'meeting_user'@'localhost';
  FLUSH PRIVILEGES;

2) Create tables
- From project root:
  mysql -u meeting_user -p meeting_app < docs/schema.sql

3) Configure backend
- Copy env template:
  cp backend/.env.example backend/.env
- Edit backend/.env if needed.

4) Create Python virtualenv and install deps
- From project root:
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -r backend/requirements.txt

5) Run backend API
- From project root:
  uvicorn backend.app.main:app --reload

6) Open frontend UI
- Open in browser:
  frontend/index.html

Notes
- The frontend calls API at http://127.0.0.1:8000 by default.
- Update frontend/app.js if backend runs on a different host.

Change Log
2026-01-19
- Added copy snippet button for meeting details with clipboard fallback messaging.
- Added toast notifications and auto-hide for copy status.
- Refined Phase 1 UI (spacing, buttons, colors, inputs, cards, background).
- Embedded copy icon sizing fixes in action buttons.
- Hosted fonts locally (assets/fonts) and removed external font dependency.
