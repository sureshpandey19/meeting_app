Phase 2 - Core Security & Ops

Goals
- Admin API keys for protected actions (host/admin roles).
- Audit logging and rate limiting.
- HTTPS setup when certificates are ready.

Schema Update (run once)
CREATE TABLE api_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  label VARCHAR(100) NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  key_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin',
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_used_at DATETIME,
  INDEX idx_key_prefix (key_prefix)
);

CREATE TABLE audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  action VARCHAR(60) NOT NULL,
  meeting_id VARCHAR(20),
  actor_type VARCHAR(20) NOT NULL,
  actor_id VARCHAR(64),
  ip_address VARCHAR(64),
  user_agent VARCHAR(255),
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_action (action),
  INDEX idx_meeting_id (meeting_id)
);

CREATE TABLE rate_limits (
  id INT AUTO_INCREMENT PRIMARY KEY,
  scope VARCHAR(20) NOT NULL,
  identifier VARCHAR(100) NOT NULL,
  endpoint VARCHAR(80) NOT NULL,
  window_start DATETIME NOT NULL,
  count INT NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_rate_limit (scope, identifier, endpoint, window_start),
  INDEX idx_endpoint (endpoint)
);

Admin Config Page
- URL: /meeting_app/admin/config.php
- Use it to create admin API keys.
- First key can be created when none exist. Store it securely.

Admin API Key Usage
- Send header: X-API-Key: <admin_key>
- Admin key can access:
  - GET /meeting_app/api/participants.php?meeting_id=... (without host_token)
  - POST /meeting_app/api/remove.php?meeting_id=...&session_token=...
  - POST /meeting_app/api/stop.php?meeting_id=...

Sample Commands (adjust base URL to your server)
1) List participants without a host token
curl -s \
  -H "X-API-Key: mk_your_admin_key" \
  "http://127.0.0.1/meeting_app/api/participants.php?meeting_id=MEET123"

2) Remove a participant (session token required)
curl -s -X POST \
  -H "X-API-Key: mk_your_admin_key" \
  -d "meeting_id=MEET123" \
  -d "session_token=SESSION_TOKEN" \
  "http://127.0.0.1/meeting_app/api/remove.php"

3) Stop a meeting (no host token required)
curl -s -X POST \
  -H "X-API-Key: mk_your_admin_key" \
  -d "meeting_id=MEET123" \
  "http://127.0.0.1/meeting_app/api/stop.php"

Troubleshooting
- Invalid API key: confirm the key is active and use the exact value shown when created.
- 429 response: rate limit reached; retry after the window resets.
- Key missing in list: it was never saved or the api_keys table is missing.

Audit Logging
- Logged actions: meeting.create, meeting.join, meeting.leave, meeting.stop, participant.remove, api_key.create, rate_limit.
- View in /meeting_app/admin/config.php (Recent Activity).

Rate Limiting
- Per-IP limits enforced on API endpoints.
- 429 returned when limit exceeded.
