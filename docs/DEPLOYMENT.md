Deployment Guide

Scope
- Phase 1: core meetings (no media)
- Phase 2 add-ons: admin API keys, audit logs, rate limiting, HTTPS

Target Paths
- Repo: /home/suresh/pam_ops_2026/meeting_app
- Web root: /var/www/html/meeting_app

Prerequisites (AlmaLinux/RHEL)
- httpd
- php
- php-fpm
- php-mysqlnd
- php-json
- mysql-server (if DB not already provisioned)

Install packages
sudo dnf install -y httpd php php-fpm php-mysqlnd php-json mysql-server

Enable services
sudo systemctl enable --now httpd
sudo systemctl enable --now php-fpm
sudo systemctl enable --now mysqld

Database Setup (Phase 1)
1) Create database and user
mysql -u root -p
CREATE DATABASE meeting_app;
CREATE USER 'meeting_user'@'localhost' IDENTIFIED BY 'meeting_pass';
GRANT ALL PRIVILEGES ON meeting_app.* TO 'meeting_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

2) If PHP 7.2 is used, set mysql_native_password
mysql -u root -p
ALTER USER 'meeting_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'meeting_pass';
CREATE USER 'meeting_user'@'127.0.0.1' IDENTIFIED WITH mysql_native_password BY 'meeting_pass';
GRANT ALL PRIVILEGES ON meeting_app.* TO 'meeting_user'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;

3) Create tables
mysql -u meeting_user -p meeting_app < /home/suresh/pam_ops_2026/meeting_app/docs/schema.sql

App Deploy (Phase 1)
1) Copy frontend and api to web root
sudo mkdir -p /var/www/html/meeting_app
sudo cp -r /home/suresh/pam_ops_2026/meeting_app/frontend/* /var/www/html/meeting_app/
sudo cp -r /home/suresh/pam_ops_2026/meeting_app/api /var/www/html/meeting_app/

2) Configure DB
- Edit /var/www/html/meeting_app/api/config.php with DB host/user/pass/name.

3) Restart services
sudo systemctl restart httpd
sudo systemctl restart php-fpm

4) Verify
- Open http://127.0.0.1/meeting_app/
- Create an instant meeting and confirm join/leave works.

Smoke Tests
- POST /meeting_app/api/meetings.php returns meeting_id
- GET /meeting_app/api/meeting.php?meeting_id=... returns JSON
- POST /meeting_app/api/join.php?meeting_id=... returns session_token
- GET /meeting_app/api/participants_public.php?meeting_id=... lists participants

Troubleshooting
1) PHP file downloads or shows raw <?php
- Ensure php-fpm is running and httpd is restarted.

2) Error: Unexpected token '<' or not valid JSON
- Apache is returning HTML instead of JSON. Check php-fpm and httpd.

3) Error: Unexpected end of JSON input
- Check PHP fatal errors:
  sudo tail -n 80 /var/log/php-fpm/www-error.log

4) API returns {"error":"Database connection failed"}
- Validate DB login:
  mysql -u meeting_user -p -h 127.0.0.1 -D meeting_app -e "select 1;"

5) PHP error: Call to undefined function json_encode()
- Install php-json and restart services.

6) Frontend changes not visible
- Ensure /var/www/html/meeting_app is updated and hard refresh the browser.

Phase 2 Add-ons (when ready)
1) Apply schema updates
- Create tables in docs/PHASE2.md:
  - api_keys
  - audit_logs
  - rate_limits

2) Admin config
- URL: /meeting_app/admin/config.php
- Create the first admin API key and store it securely.

3) Use admin API key
- Send header: X-API-Key: <admin_key>
- Allows admin-level actions without host_token.

4) Rate limiting
- 429 returned when rate limit exceeded.

5) LiveKit (Audio/Video)
- LiveKit signaling URL: wss://192.168.25.144/livekit
- Open firewall ports (firewalld):
  - 7880/tcp, 7881/tcp, 50000-60000/udp
  - Commands:
    firewall-cmd --add-port=7880/tcp --add-port=7881/tcp --add-port=50000-60000/udp --permanent
    firewall-cmd --reload

6) HTTPS
- Configure SSL certificate and Apache HTTPS vhost when certs are ready.
- Update base URL used by clients.

Rollback Notes
- Keep a backup of /var/www/html/meeting_app before deploying.
- DB: back up meeting_app schema and data before running migrations.
