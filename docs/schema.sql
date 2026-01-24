CREATE TABLE meetings (
  id VARCHAR(20) PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255),
  created_by VARCHAR(200),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  meeting_type VARCHAR(20) NOT NULL DEFAULT 'instant',
  scheduled_start DATETIME,
  duration_minutes INT,
  host_token VARCHAR(64) NOT NULL,
  host_joined TINYINT(1) NOT NULL DEFAULT 0,
  first_joined_at DATETIME,
  ended_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE participants (
  id INT AUTO_INCREMENT PRIMARY KEY,
  meeting_id VARCHAR(20) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  is_host TINYINT(1) NOT NULL DEFAULT 0,
  session_token VARCHAR(64) NOT NULL DEFAULT '',
  approval_status VARCHAR(20) NOT NULL DEFAULT 'approved',
  approved_at DATETIME,
  left_at DATETIME,
  left_reason VARCHAR(20),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meeting_id (meeting_id)
);

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
