LiveKit Setup

Overview
This document describes how to install, configure, and run LiveKit for Phase 2B
on the local host (192.168.25.144) using the repo's livekit.yaml.

Install
- Download the LiveKit server tarball:
  https://github.com/livekit/livekit/releases/download/v1.9.11/livekit_1.9.11_linux_amd64.tar.gz
- Extract in the repo root so the binary is ./livekit-server
- Ensure the binary is executable: chmod +x livekit-server

Configuration
- Config file: livekit.yaml (repo root)
- Backend env:
  - LIVEKIT_URL=ws://192.168.25.144:7880
  - LIVEKIT_API_KEY=<your_key>
  - LIVEKIT_API_SECRET=<your_secret>
- PHP API env: set the same LIVEKIT_* values in the web server environment
  (e.g., Apache/Nginx + PHP-FPM), or export them before running PHP.
- Admin UI: configure LiveKit via /meeting_app/admin/config.php
  - Saves to config/livekit.php (denied via config/.htaccess in Apache)
  - Use "Test LiveKit Connection" to re-check availability
- Optional setup token (no admin key available):
  - Create config/livekit_setup.php from config/livekit_setup.php.example
  - Paste the setup token in Admin Config; it will be consumed after saving
- Admin UI can also generate a one-time setup token (requires admin API key)
- Recovery (no admin key, no terminal):
  - Open /meeting_app/admin/recovery.php from localhost only
  - Enter DB credentials to disable old keys and create a new admin key
  - One-time use; delete config/recovery_lock.php to reuse
- Recovery allowlist:
  - Create config/recovery_allow.php from config/recovery_allow.php.example
  - Set allowed IPs or '*' for any IP (add a recovery token if using '*')

Start (manual)
- Run:
  ./livekit-server --config livekit.yaml
- Optional background run:
  nohup ./livekit-server --config livekit.yaml > livekit.log 2>&1 &

Firewall (firewalld)
- Open ports:
  firewall-cmd --add-port=7880/tcp --add-port=7881/tcp --add-port=50000-60000/udp --permanent
- Apply:
  firewall-cmd --reload

Systemd
- Service file template: docs/systemd/livekit.service
- Install:
  sudo cp docs/systemd/livekit.service /etc/systemd/system/livekit.service
  sudo systemctl daemon-reload
  sudo systemctl enable livekit
  sudo systemctl start livekit
- Logs:
  journalctl -u livekit -f

Troubleshooting
- If clients cannot connect, confirm ports are open and the URL is reachable.
- If media fails, confirm UDP 7881 and UDP 50000-60000 are open.
- Check logs: livekit.log (manual) or journalctl (systemd).
- If systemd start fails with "address already in use", stop any manual LiveKit process:
  - Find PID: pgrep -a livekit-server
  - Stop: kill <pid>

Test Client (manual)
- Generate a token:
  python3 tools/livekit_test_token.py --identity test-user --room meeting_1 --name "Test User"
- Open docs/livekit_test_client.html in a browser, paste the token, and connect.
- Use a second browser/device with a different identity to verify two-way audio/video.
