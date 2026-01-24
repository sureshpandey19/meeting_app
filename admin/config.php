<?php

require __DIR__ . '/../api/db.php';
require __DIR__ . '/../api/helpers.php';

$errors = [];
$notices = [];
$created_key = '';
$admin_key_prefix = null;
$livekit_errors = [];
$livekit_notice = '';
$livekit_test_result = '';
$ui_notice = '';
$ui_errors = [];
$ui_config = get_ui_config();

function can_manage_livekit(bool $requires_auth, PDO $pdo, array &$errors, ?string &$admin_key_prefix, bool $consume_setup_token): bool
{
    if (!$requires_auth) {
        return true;
    }
    $provided_key = isset($_POST['api_key']) ? trim($_POST['api_key']) : '';
    if ($provided_key !== '') {
        $admin = validate_admin_key($pdo, $provided_key);
        if (!$admin) {
            $errors[] = 'Invalid API key.';
            return false;
        }
        $admin_key_prefix = $admin['key_prefix'];
        return true;
    }
    $setup_token = isset($_POST['livekit_setup_token']) ? trim($_POST['livekit_setup_token']) : '';
    if ($setup_token === '') {
        $errors[] = 'Admin API key or LiveKit setup token is required.';
        return false;
    }
    $token_error = null;
    if (!verify_livekit_setup_token($setup_token, $consume_setup_token, $token_error)) {
        $errors[] = $token_error ?: 'Invalid LiveKit setup token.';
        return false;
    }
    return true;
}

function can_generate_livekit_setup(bool $requires_auth, PDO $pdo, array &$errors, ?string &$admin_key_prefix): bool
{
    if (!$requires_auth) {
        return true;
    }
    $provided_key = isset($_POST['api_key']) ? trim($_POST['api_key']) : '';
    if ($provided_key === '') {
        $errors[] = 'Admin API key is required to generate setup token.';
        return false;
    }
    $admin = validate_admin_key($pdo, $provided_key);
    if (!$admin) {
        $errors[] = 'Invalid API key.';
        return false;
    }
    $admin_key_prefix = $admin['key_prefix'];
    return true;
}

function test_livekit_endpoint(array $config, ?string &$error): ?string
{
    $error = null;
    $url = $config['url'] ?? '';
    if ($url === '') {
        $error = 'LiveKit URL is missing.';
        return null;
    }
    $parsed = parse_url($url);
    if (!$parsed || empty($parsed['host'])) {
        $error = 'LiveKit URL is invalid.';
        return null;
    }
    $scheme = isset($parsed['scheme']) ? $parsed['scheme'] : 'ws';
    $http_scheme = ($scheme === 'wss') ? 'https' : 'http';
    $port = isset($parsed['port']) ? ':' . $parsed['port'] : '';
    $path = isset($parsed['path']) ? $parsed['path'] : '';
    $target = sprintf('%s://%s%s%s', $http_scheme, $parsed['host'], $port, $path);

    $context = stream_context_create([
        'http' => [
            'timeout' => 3,
            'method' => 'GET'
        ]
    ]);
    $result = @file_get_contents($target, false, $context);
    if ($result === false) {
        $error = 'LiveKit endpoint not reachable.';
        return null;
    }
    return trim($result);
}

try {
    $count_stmt = $pdo->query('SELECT COUNT(*) AS count FROM api_keys');
    $count_row = $count_stmt->fetch();
    $key_count = $count_row ? (int) $count_row['count'] : 0;
} catch (PDOException $e) {
    $key_count = 0;
    $errors[] = 'api_keys table missing. Run the Phase 2 schema update first.';
}

$requires_auth = $key_count > 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($errors)) {
    $action = isset($_POST['action']) ? trim($_POST['action']) : 'create_key';
    $label = isset($_POST['label']) ? trim($_POST['label']) : '';
    $provided_key = isset($_POST['api_key']) ? trim($_POST['api_key']) : '';

    if ($label === '') {
        $label = 'Admin Key';
    }

    if ($action === 'create_key') {
        if ($requires_auth) {
            $admin = validate_admin_key($pdo, $provided_key);
            if (!$admin) {
                $errors[] = 'Invalid API key.';
            } else {
                $admin_key_prefix = $admin['key_prefix'];
            }
        }

        if (empty($errors)) {
            $raw_key = 'mk_' . bin2hex(random_bytes(16));
            $prefix = substr($raw_key, 0, 8);
            $hash = password_hash($raw_key, PASSWORD_DEFAULT);
            $insert = $pdo->prepare('INSERT INTO api_keys (label, key_prefix, key_hash, role, active) VALUES (?, ?, ?, ?, 1)');
            $insert->execute([$label, $prefix, $hash, 'admin']);
            $created_key = $raw_key;
            $notices[] = 'New API key created. Copy it now; it will not be shown again.';
            try {
                audit_log($pdo, 'api_key.create', null, $requires_auth ? 'admin' : 'bootstrap', $admin_key_prefix, [
                    'label' => $label,
                    'key_prefix' => $prefix
                ]);
            } catch (PDOException $e) {
                // Ignore audit errors for initial setup.
            }
        }
    }

    if ($action === 'save_livekit' && empty($errors)) {
        if (!can_manage_livekit($requires_auth, $pdo, $errors, $admin_key_prefix, true)) {
            $livekit_errors = $errors;
        } else {
            $current = get_livekit_config();
            $livekit_url = isset($_POST['livekit_url']) ? trim($_POST['livekit_url']) : '';
            $livekit_key = isset($_POST['livekit_api_key']) ? trim($_POST['livekit_api_key']) : '';
            $livekit_secret = isset($_POST['livekit_api_secret']) ? trim($_POST['livekit_api_secret']) : '';

            if ($livekit_url === '') {
                $livekit_url = $current['url'] ?? '';
            }
            if ($livekit_key === '') {
                $livekit_key = $current['api_key'] ?? '';
            }
            if ($livekit_secret === '') {
                $livekit_secret = $current['api_secret'] ?? '';
            }

            if ($livekit_url === '' || $livekit_key === '' || $livekit_secret === '') {
                $livekit_errors[] = 'LiveKit URL, API key, and API secret are required.';
            } else {
                $save_error = null;
                if (!save_livekit_config([
                    'url' => $livekit_url,
                    'api_key' => $livekit_key,
                    'api_secret' => $livekit_secret
                ], $save_error)) {
                    $livekit_errors[] = $save_error ?: 'Unable to save LiveKit config.';
                } else {
                    $livekit_notice = 'LiveKit configuration saved.';
                }
            }
        }
    }

    if ($action === 'test_livekit' && empty($errors)) {
        if (!can_manage_livekit($requires_auth, $pdo, $errors, $admin_key_prefix, false)) {
            $livekit_errors = $errors;
        } else {
            $config = get_livekit_config();
            $test_error = null;
            $result = test_livekit_endpoint($config, $test_error);
            if ($test_error) {
                $livekit_errors[] = $test_error;
            } else {
                $livekit_test_result = $result === 'OK' ? 'LiveKit reachable (OK).' : 'LiveKit reachable.';
            }
        }
    }

    if ($action === 'generate_livekit_setup' && empty($errors)) {
        if (!can_generate_livekit_setup($requires_auth, $pdo, $errors, $admin_key_prefix)) {
            $livekit_errors = $errors;
        } else {
            $setup_token = 'lk_setup_' . bin2hex(random_bytes(8));
            $hash = password_hash($setup_token, PASSWORD_DEFAULT);
            $save_error = null;
            if (!save_livekit_setup_config([
                'token_hash' => $hash,
                'used' => false
            ], $save_error)) {
                $livekit_errors[] = $save_error ?: 'Unable to save setup token.';
            } else {
                $livekit_notice = 'LiveKit setup token generated. Copy it now; it will not be shown again.';
                $livekit_test_result = $setup_token;
            }
        }
    }

    if ($action === 'save_ui' && empty($errors)) {
        if ($requires_auth) {
            $admin = validate_admin_key($pdo, $provided_key);
            if (!$admin) {
                $ui_errors[] = 'Invalid API key.';
            } else {
                $admin_key_prefix = $admin['key_prefix'];
            }
        }
        if (empty($ui_errors)) {
            $livekit_debug = isset($_POST['livekit_debug']) && $_POST['livekit_debug'] === '1';
            $save_error = null;
            if (!save_ui_config(['livekit_debug' => $livekit_debug], $save_error)) {
                $ui_errors[] = $save_error ?: 'Unable to save UI config.';
            } else {
                $ui_notice = 'UI configuration saved.';
                $ui_config = get_ui_config();
            }
        }
    }
}

$keys = [];
if (empty($errors)) {
    $list = $pdo->query('SELECT label, key_prefix, role, active, created_at, last_used_at FROM api_keys ORDER BY created_at DESC');
    $keys = $list->fetchAll();
}

$audit_logs = [];
$audit_error = '';
if (empty($errors)) {
    try {
        $logs = $pdo->query('SELECT action, meeting_id, actor_type, actor_id, ip_address, created_at, details FROM audit_logs ORDER BY created_at DESC LIMIT 50');
        $audit_logs = $logs->fetchAll();
    } catch (PDOException $e) {
        $audit_error = 'audit_logs table missing. Run the Phase 2 schema update.';
    }
}
$livekit_config = get_livekit_config();
$livekit_setup = get_livekit_setup_config();
$livekit_masked_secret = $livekit_config['api_secret'] !== '' ? str_repeat('*', 12) : '';
$livekit_masked_key = $livekit_config['api_key'] !== '' ? substr($livekit_config['api_key'], 0, 6) . '...' : '';
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Meeting App - Admin Config</title>
    <link rel="stylesheet" href="../style.css" />
    <style>
      .admin-card { margin-top: 12px; }
      .notice { padding: 10px 12px; background: #ecfeff; border-radius: 10px; border: 1px solid #cffafe; color: #155e75; margin-bottom: 12px; }
      .error { padding: 10px 12px; background: #fef2f2; border-radius: 10px; border: 1px solid #fecaca; color: #991b1b; margin-bottom: 12px; }
      .key-box { padding: 10px 12px; background: #0f172a; color: #e2e8f0; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; }
      th { color: #52606d; font-weight: 600; }
      .audit-table { table-layout: auto; min-width: 900px; }
      .audit-table th,
      .audit-table td { vertical-align: top; white-space: nowrap; }
      .audit-table .col-action { width: 130px; }
      .audit-table .col-meeting { width: 120px; }
      .audit-table .col-actor { width: 260px; }
      .audit-table .col-ip { width: 140px; }
      .audit-table .col-when { width: 170px; }
      .audit-table .col-details { width: 320px; }
      .audit-table-wrap { overflow-x: auto; }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>Admin Config</h1>
      <p>Manage admin API keys for protected actions.</p>

      <?php foreach ($errors as $error): ?>
        <div class="error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endforeach; ?>

      <?php foreach ($notices as $notice): ?>
        <div class="notice"><?php echo htmlspecialchars($notice, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endforeach; ?>

      <?php if (!$requires_auth && empty($errors)): ?>
        <div class="notice">No API keys exist yet. Create the first key now, then protect this page.</div>
      <?php endif; ?>

      <section class="card admin-card">
        <h2>Create API Key</h2>
        <form method="post">
          <input type="hidden" name="action" value="create_key" />
          <?php if ($requires_auth): ?>
            <label>
              Existing API Key
              <input name="api_key" type="password" placeholder="Enter admin API key" required />
            </label>
          <?php endif; ?>
          <label>
            Label
            <input name="label" type="text" placeholder="Production Admin Key" />
          </label>
          <button type="submit">Create Key</button>
        </form>
        <?php if ($created_key !== ''): ?>
          <p>New API key:</p>
          <div class="key-box"><?php echo htmlspecialchars($created_key, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
      </section>

      <section class="card admin-card">
        <h2>UI Settings</h2>
        <?php foreach ($ui_errors as $error): ?>
          <div class="error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endforeach; ?>
        <?php if ($ui_notice !== ''): ?>
          <div class="notice"><?php echo htmlspecialchars($ui_notice, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
        <form method="post">
          <input type="hidden" name="action" value="save_ui" />
          <?php if ($requires_auth): ?>
            <label>
              Existing API Key
              <input name="api_key" type="password" placeholder="Enter admin API key" required />
            </label>
          <?php endif; ?>
          <label>
            <input type="checkbox" name="livekit_debug" value="1" <?php echo !empty($ui_config['livekit_debug']) ? 'checked' : ''; ?> />
            Enable LiveKit debug panel
          </label>
          <button type="submit">Save UI Settings</button>
        </form>
      </section>

      <section class="card admin-card">
        <h2>LiveKit Integration</h2>
        <p>Configure LiveKit credentials once. Backend will issue tokens automatically for AV.</p>
        <?php foreach ($livekit_errors as $error): ?>
          <div class="error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endforeach; ?>
        <?php if ($livekit_notice !== ''): ?>
          <div class="notice"><?php echo htmlspecialchars($livekit_notice, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
        <?php if ($livekit_test_result !== ''): ?>
          <div class="notice"><?php echo htmlspecialchars($livekit_test_result, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php endif; ?>
        <form method="post">
          <input type="hidden" name="action" value="save_livekit" />
          <?php if ($requires_auth): ?>
            <label>
              Existing API Key
              <input name="api_key" type="password" placeholder="Enter admin API key" required />
            </label>
            <label>
              LiveKit Setup Token (one-time)
              <input name="livekit_setup_token" type="password" placeholder="Use if admin key is unavailable" />
            </label>
          <?php endif; ?>
          <label>
            LiveKit URL
            <input name="livekit_url" type="text" placeholder="ws://192.168.25.144:7880" value="<?php echo htmlspecialchars($livekit_config['url'] ?? '', ENT_QUOTES, 'UTF-8'); ?>" />
          </label>
          <label>
            LiveKit API Key <?php if ($livekit_masked_key !== ''): ?><small>(current: <?php echo htmlspecialchars($livekit_masked_key, ENT_QUOTES, 'UTF-8'); ?>)</small><?php endif; ?>
            <input name="livekit_api_key" type="text" placeholder="Enter LiveKit API key" />
          </label>
          <label>
            LiveKit API Secret <?php if ($livekit_masked_secret !== ''): ?><small>(current: <?php echo htmlspecialchars($livekit_masked_secret, ENT_QUOTES, 'UTF-8'); ?>)</small><?php endif; ?>
            <input name="livekit_api_secret" type="password" placeholder="Enter LiveKit API secret" />
          </label>
          <button type="submit">Save LiveKit Config</button>
        </form>
        <form method="post" style="margin-top: 10px;">
          <input type="hidden" name="action" value="test_livekit" />
          <?php if ($requires_auth): ?>
            <label>
              Existing API Key
              <input name="api_key" type="password" placeholder="Enter admin API key" required />
            </label>
            <label>
              LiveKit Setup Token (one-time)
              <input name="livekit_setup_token" type="password" placeholder="Use if admin key is unavailable" />
            </label>
          <?php endif; ?>
          <button type="submit">Test LiveKit Connection</button>
        </form>
        <form method="post" style="margin-top: 10px;">
          <input type="hidden" name="action" value="generate_livekit_setup" />
          <?php if ($requires_auth): ?>
            <label>
              Existing API Key
              <input name="api_key" type="password" placeholder="Enter admin API key" required />
            </label>
          <?php endif; ?>
          <button type="submit">Generate Setup Token</button>
        </form>
        <p><strong>Status:</strong> <?php echo $livekit_config['url'] !== '' && $livekit_config['api_key'] !== '' ? 'Configured' : 'Not configured'; ?> (source: <?php echo htmlspecialchars($livekit_config['source'] ?? 'env', ENT_QUOTES, 'UTF-8'); ?>).</p>
        <p><strong>Setup token:</strong> <?php echo $livekit_setup['token_hash'] !== '' ? ($livekit_setup['used'] ? 'Used' : 'Available') : 'Not configured'; ?>.</p>
      </section>

      <section class="card admin-card">
        <h2>Recovery</h2>
        <p>Use this only if you lost the admin key. Available from localhost only.</p>
        <a class="admin-link" href="recovery.php">Open Recovery</a>
      </section>

      <section class="card admin-card">
        <h2>Existing Keys</h2>
        <?php if (empty($keys)): ?>
          <p>No keys yet.</p>
        <?php else: ?>
          <table class="audit-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Prefix</th>
                <th>Role</th>
                <th>Active</th>
                <th>Created</th>
                <th>Last Used</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($keys as $key): ?>
                <tr>
                  <td><?php echo htmlspecialchars($key['label'], ENT_QUOTES, 'UTF-8'); ?></td>
                  <td><?php echo htmlspecialchars($key['key_prefix'], ENT_QUOTES, 'UTF-8'); ?></td>
                  <td><?php echo htmlspecialchars($key['role'], ENT_QUOTES, 'UTF-8'); ?></td>
                  <td><?php echo (int) $key['active'] === 1 ? 'Yes' : 'No'; ?></td>
                  <td><?php echo htmlspecialchars($key['created_at'], ENT_QUOTES, 'UTF-8'); ?></td>
                  <td><?php echo htmlspecialchars($key['last_used_at'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        <?php endif; ?>
      </section>

      <section class="card admin-card">
        <h2>Admin API Key Usage</h2>
        <p>Use the API key as the <code>X-API-Key</code> header for protected actions. Keys start with <code>mk_</code> and are shown only once.</p>
        <p><strong>Base URL:</strong> adjust <code>http://127.0.0.1/meeting_app</code> to match your server.</p>
        <pre class="key-box"># 1) List participants without a host token
curl -s \
  -H "X-API-Key: mk_your_admin_key" \
  "http://127.0.0.1/meeting_app/api/participants.php?meeting_id=MEET123"

# 2) Remove a participant (session token required)
curl -s -X POST \
  -H "X-API-Key: mk_your_admin_key" \
  -d "meeting_id=MEET123" \
  -d "session_token=SESSION_TOKEN" \
  "http://127.0.0.1/meeting_app/api/remove.php"

# 3) Stop a meeting (no host token required)
curl -s -X POST \
  -H "X-API-Key: mk_your_admin_key" \
  -d "meeting_id=MEET123" \
  "http://127.0.0.1/meeting_app/api/stop.php"</pre>
        <p><strong>Troubleshooting:</strong> if you see <code>Invalid API key</code>, confirm the key is active and use the exact value shown when created. A <code>429</code> means rate limits were hit; retry after the window resets. If a key is missing from the list, it was never saved.</p>
      </section>

      <section class="card admin-card">
        <h2>Recent Activity</h2>
        <?php if ($audit_error): ?>
          <div class="error"><?php echo htmlspecialchars($audit_error, ENT_QUOTES, 'UTF-8'); ?></div>
        <?php elseif (empty($audit_logs)): ?>
          <p>No activity yet.</p>
        <?php else: ?>
          <div class="audit-table-wrap">
            <table class="audit-table">
            <thead>
              <tr>
                <th class="col-action">Action</th>
                <th class="col-meeting">Meeting</th>
                <th class="col-actor">Actor</th>
                <th class="col-ip">IP</th>
                <th class="col-when">When</th>
                <th class="col-details">Details</th>
              </tr>
            </thead>
            <tbody>
              <?php foreach ($audit_logs as $log): ?>
                <tr>
                  <td class="col-action"><?php echo htmlspecialchars($log['action'], ENT_QUOTES, 'UTF-8'); ?></td>
                  <td class="col-meeting"><?php echo htmlspecialchars($log['meeting_id'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
                  <td class="col-actor"><?php echo htmlspecialchars($log['actor_type'] . ':' . ($log['actor_id'] ?? '-'), ENT_QUOTES, 'UTF-8'); ?></td>
                  <td class="col-ip"><?php echo htmlspecialchars($log['ip_address'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
                  <td class="col-when"><?php echo htmlspecialchars($log['created_at'], ENT_QUOTES, 'UTF-8'); ?></td>
                  <td class="col-details"><?php echo htmlspecialchars($log['details'] ?? '-', ENT_QUOTES, 'UTF-8'); ?></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
            </table>
          </div>
        <?php endif; ?>
      </section>
    </main>
  </body>
</html>
