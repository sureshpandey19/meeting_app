<?php

require __DIR__ . '/../api/helpers.php';

$client_ip = $_SERVER['REMOTE_ADDR'] ?? '';
$allow_path = dirname(__DIR__) . '/config/recovery_allow.php';
$allow_config = [
    'allowed_ips' => ['127.0.0.1', '::1'],
    'token_hash' => ''
];
if (file_exists($allow_path)) {
    $data = include $allow_path;
    if (is_array($data)) {
        if (isset($data['allowed_ips']) && is_array($data['allowed_ips'])) {
            $allow_config['allowed_ips'] = $data['allowed_ips'];
        }
        if (isset($data['token_hash'])) {
            $allow_config['token_hash'] = (string) $data['token_hash'];
        }
    }
}

function ip_allowed(string $ip, array $allowed_ips): bool
{
    foreach ($allowed_ips as $allowed) {
        $allowed = trim((string) $allowed);
        if ($allowed === '*') {
            return true;
        }
        if (strpos($allowed, '/') !== false) {
            [$subnet, $mask] = explode('/', $allowed, 2);
            $mask = (int) $mask;
            if (filter_var($ip, FILTER_VALIDATE_IP) && filter_var($subnet, FILTER_VALIDATE_IP)) {
                $client_long = ip2long($ip);
                $subnet_long = ip2long($subnet);
                $mask_long = -1 << (32 - $mask);
                if (($client_long & $mask_long) === ($subnet_long & $mask_long)) {
                    return true;
                }
            }
        } else {
            if ($ip === $allowed) {
                return true;
            }
        }
    }
    return false;
}

$is_local = ip_allowed($client_ip, $allow_config['allowed_ips']);
$lock_path = dirname(__DIR__) . '/config/recovery_lock.php';
$lock = [
    'used' => false,
    'used_at' => null
];
if (file_exists($lock_path)) {
    $data = include $lock_path;
    if (is_array($data)) {
        $lock['used'] = (bool) ($data['used'] ?? false);
        $lock['used_at'] = $data['used_at'] ?? null;
    }
}

$errors = [];
$notice = '';
$created_key = '';

if (!$is_local) {
    $errors[] = 'Recovery is allowed only from localhost.';
}

if ($lock['used']) {
    $errors[] = 'Recovery already used. Remove config/recovery_lock.php to re-enable.';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($errors)) {
    if ($allow_config['token_hash'] !== '') {
        $token = isset($_POST['recovery_token']) ? trim($_POST['recovery_token']) : '';
        if ($token === '' || !password_verify($token, $allow_config['token_hash'])) {
            $errors[] = 'Invalid recovery token.';
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && empty($errors)) {
    $db_host = isset($_POST['db_host']) ? trim($_POST['db_host']) : '';
    $db_port = isset($_POST['db_port']) ? trim($_POST['db_port']) : '3306';
    $db_name = isset($_POST['db_name']) ? trim($_POST['db_name']) : '';
    $db_user = isset($_POST['db_user']) ? trim($_POST['db_user']) : '';
    $db_pass = isset($_POST['db_pass']) ? (string) $_POST['db_pass'] : '';

    if ($db_host === '' || $db_name === '' || $db_user === '') {
        $errors[] = 'Database host, name, and user are required.';
    }

    if (empty($errors)) {
        try {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
                $db_host,
                $db_port,
                $db_name
            );
            $pdo = new PDO($dsn, $db_user, $db_pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);

            $pdo->exec('UPDATE api_keys SET active = 0');

            $raw_key = 'mk_' . bin2hex(random_bytes(16));
            $prefix = substr($raw_key, 0, 8);
            $hash = password_hash($raw_key, PASSWORD_DEFAULT);
            $insert = $pdo->prepare('INSERT INTO api_keys (label, key_prefix, key_hash, role, active) VALUES (?, ?, ?, ?, 1)');
            $insert->execute(['Recovery Admin Key', $prefix, $hash, 'admin']);

            $lock_payload = "<?php\n\nreturn " . var_export([
                'used' => true,
                'used_at' => date('c')
            ], true) . ";\n";
            $tmp = $lock_path . '.tmp';
            file_put_contents($tmp, $lock_payload);
            rename($tmp, $lock_path);

            $created_key = $raw_key;
            $notice = 'New admin key created. Copy it now; it will not be shown again.';
        } catch (PDOException $e) {
            $errors[] = 'Database connection failed or schema missing.';
        }
    }
}
?>
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Admin Recovery</title>
    <link rel="stylesheet" href="../style.css" />
    <style>
      .admin-card { margin-top: 12px; }
      .notice { padding: 10px 12px; background: #ecfeff; border-radius: 10px; border: 1px solid #cffafe; color: #155e75; margin-bottom: 12px; }
      .error { padding: 10px 12px; background: #fef2f2; border-radius: 10px; border: 1px solid #fecaca; color: #991b1b; margin-bottom: 12px; }
      .key-box { padding: 10px 12px; background: #0f172a; color: #e2e8f0; border-radius: 10px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
    </style>
  </head>
  <body>
    <main class="container">
      <h1>Admin Recovery</h1>
      <p>Use this once from localhost to reset admin keys and create a new one.</p>

      <?php foreach ($errors as $error): ?>
        <div class="error"><?php echo htmlspecialchars($error, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endforeach; ?>

      <?php if ($notice !== ''): ?>
        <div class="notice"><?php echo htmlspecialchars($notice, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endif; ?>

      <?php if ($created_key !== ''): ?>
        <p>New admin key:</p>
        <div class="key-box"><?php echo htmlspecialchars($created_key, ENT_QUOTES, 'UTF-8'); ?></div>
      <?php endif; ?>

      <?php if (!$errors): ?>
        <section class="card admin-card">
          <h2>Database Connection</h2>
          <form method="post">
            <?php if ($allow_config['token_hash'] !== ''): ?>
              <label>
                Recovery Token
                <input name="recovery_token" type="password" placeholder="Enter recovery token" required />
              </label>
            <?php endif; ?>
            <label>
              DB Host
              <input name="db_host" type="text" placeholder="127.0.0.1" required />
            </label>
            <label>
              DB Port
              <input name="db_port" type="text" placeholder="3306" />
            </label>
            <label>
              DB Name
              <input name="db_name" type="text" placeholder="meeting_app" required />
            </label>
            <label>
              DB User
              <input name="db_user" type="text" placeholder="meeting_user" required />
            </label>
            <label>
              DB Password
              <input name="db_pass" type="password" placeholder="meeting_pass" />
            </label>
            <button type="submit">Reset Admin Keys</button>
          </form>
        </section>
      <?php endif; ?>
    </main>
  </body>
</html>
