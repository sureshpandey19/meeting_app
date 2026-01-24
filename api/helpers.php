<?php

function json_response($data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

function require_method(string $method): void
{
    if ($_SERVER['REQUEST_METHOD'] !== $method) {
        json_response(['error' => 'Method not allowed'], 405);
    }
}

function get_json_body(): array
{
    $raw = file_get_contents('php://input');
    if (!$raw) {
        return [];
    }
    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        return [];
    }
    return $decoded;
}

function uuid_v4(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function get_api_key(): string
{
    if (isset($_SERVER['HTTP_X_API_KEY'])) {
        return trim($_SERVER['HTTP_X_API_KEY']);
    }

    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (isset($headers['X-API-Key'])) {
            return trim($headers['X-API-Key']);
        }
        if (isset($headers['x-api-key'])) {
            return trim($headers['x-api-key']);
        }
    }

    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = trim($_SERVER['HTTP_AUTHORIZATION']);
        if (stripos($auth, 'Bearer ') === 0) {
            return trim(substr($auth, 7));
        }
    }

    return '';
}

function validate_admin_key(PDO $pdo, string $key): ?array
{
    if ($key === '') {
        return null;
    }
    $prefix = substr($key, 0, 8);
    if ($prefix === '') {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, key_prefix, key_hash, role, active FROM api_keys WHERE key_prefix = ? AND active = 1 LIMIT 1');
    $stmt->execute([$prefix]);
    $row = $stmt->fetch();
    if (!$row) {
        return null;
    }
    if ($row['role'] !== 'admin') {
        return null;
    }
    if (!password_verify($key, $row['key_hash'])) {
        return null;
    }
    $touch = $pdo->prepare('UPDATE api_keys SET last_used_at = NOW() WHERE id = ?');
    $touch->execute([$row['id']]);
    return $row;
}

function require_admin(PDO $pdo): array
{
    $key = get_api_key();
    $admin = validate_admin_key($pdo, $key);
    if (!$admin) {
        json_response(['error' => 'Invalid API key'], 401);
    }
    return $admin;
}

function get_client_ip(): string
{
    if (!empty($_SERVER['HTTP_X_FORWARDED_FOR'])) {
        $parts = explode(',', $_SERVER['HTTP_X_FORWARDED_FOR']);
        return trim($parts[0]);
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

function get_user_agent(): string
{
    return $_SERVER['HTTP_USER_AGENT'] ?? '';
}

function audit_log(PDO $pdo, string $action, ?string $meeting_id, string $actor_type, ?string $actor_id, array $details = []): void
{
    $payload = $details ? json_encode($details) : null;
    if ($payload !== null && strlen($payload) > 2000) {
        $payload = substr($payload, 0, 2000);
    }

    $stmt = $pdo->prepare(
        'INSERT INTO audit_logs (action, meeting_id, actor_type, actor_id, ip_address, user_agent, details) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $action,
        $meeting_id,
        $actor_type,
        $actor_id,
        get_client_ip(),
        get_user_agent(),
        $payload
    ]);
}

function enforce_rate_limit(PDO $pdo, string $endpoint, int $limit, int $window_seconds): void
{
    $identifier = get_client_ip();
    $window_start = date('Y-m-d H:i:s', (int) (floor(time() / $window_seconds) * $window_seconds));

    $stmt = $pdo->prepare(
        'INSERT INTO rate_limits (scope, identifier, endpoint, window_start, count, updated_at) VALUES (?, ?, ?, ?, 1, NOW())
         ON DUPLICATE KEY UPDATE count = count + 1, updated_at = NOW()'
    );
    $stmt->execute(['ip', $identifier, $endpoint, $window_start]);

    $check = $pdo->prepare(
        'SELECT count FROM rate_limits WHERE scope = ? AND identifier = ? AND endpoint = ? AND window_start = ?'
    );
    $check->execute(['ip', $identifier, $endpoint, $window_start]);
    $row = $check->fetch();
    $count = $row ? (int) $row['count'] : 0;

    if ($count > $limit) {
        audit_log($pdo, 'rate_limit', null, 'system', null, [
            'endpoint' => $endpoint,
            'ip' => $identifier,
            'count' => $count,
            'limit' => $limit,
            'window_seconds' => $window_seconds
        ]);
        json_response(['error' => 'Too many requests'], 429);
    }
}

function get_livekit_config_path(): string
{
    return dirname(__DIR__) . '/config/livekit.php';
}

function get_livekit_setup_config_path(): string
{
    return dirname(__DIR__) . '/config/livekit_setup.php';
}

function get_ui_config_path(): string
{
    return dirname(__DIR__) . '/config/ui.php';
}

function get_livekit_config(): array
{
    $config_path = get_livekit_config_path();
    if (file_exists($config_path)) {
        $data = include $config_path;
        if (is_array($data)) {
            return [
                'url' => isset($data['url']) ? (string) $data['url'] : '',
                'api_key' => isset($data['api_key']) ? (string) $data['api_key'] : '',
                'api_secret' => isset($data['api_secret']) ? (string) $data['api_secret'] : '',
                'source' => 'file'
            ];
        }
    }

    return [
        'url' => getenv('LIVEKIT_URL') ?: '',
        'api_key' => getenv('LIVEKIT_API_KEY') ?: '',
        'api_secret' => getenv('LIVEKIT_API_SECRET') ?: '',
        'source' => 'env'
    ];
}

function get_ui_config(): array
{
    $config_path = get_ui_config_path();
    if (file_exists($config_path)) {
        $data = include $config_path;
        if (is_array($data)) {
            return [
                'livekit_debug' => (bool) ($data['livekit_debug'] ?? false),
                'source' => 'file'
            ];
        }
    }
    return [
        'livekit_debug' => false,
        'source' => 'default'
    ];
}

function get_livekit_setup_config(): array
{
    $config_path = get_livekit_setup_config_path();
    if (file_exists($config_path)) {
        $data = include $config_path;
        if (is_array($data)) {
            return [
                'token_hash' => isset($data['token_hash']) ? (string) $data['token_hash'] : '',
                'used' => isset($data['used']) ? (bool) $data['used'] : false
            ];
        }
    }
    return [
        'token_hash' => '',
        'used' => false
    ];
}

function save_livekit_setup_config(array $config, ?string &$error): bool
{
    $error = null;
    $config_path = get_livekit_setup_config_path();
    $dir = dirname($config_path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0750, true)) {
            $error = 'Unable to create config directory.';
            return false;
        }
    }
    $payload = [
        'token_hash' => $config['token_hash'] ?? '',
        'used' => (bool) ($config['used'] ?? false)
    ];
    $export = "<?php\n\nreturn " . var_export($payload, true) . ";\n";
    $tmp = $config_path . '.tmp';
    if (file_put_contents($tmp, $export) === false) {
        $error = 'Unable to write LiveKit setup config.';
        return false;
    }
    if (!rename($tmp, $config_path)) {
        $error = 'Unable to finalize LiveKit setup config.';
        return false;
    }
    return true;
}

function save_ui_config(array $config, ?string &$error): bool
{
    $error = null;
    $config_path = get_ui_config_path();
    $dir = dirname($config_path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0750, true)) {
            $error = 'Unable to create config directory.';
            return false;
        }
    }
    $payload = [
        'livekit_debug' => (bool) ($config['livekit_debug'] ?? false)
    ];
    $export = "<?php\n\nreturn " . var_export($payload, true) . ";\n";
    $tmp = $config_path . '.tmp';
    if (file_put_contents($tmp, $export) === false) {
        $error = 'Unable to write UI config.';
        return false;
    }
    if (!rename($tmp, $config_path)) {
        $error = 'Unable to finalize UI config.';
        return false;
    }
    return true;
}

function verify_livekit_setup_token(string $token, bool $consume, ?string &$error): bool
{
    $error = null;
    $config = get_livekit_setup_config();
    if ($config['token_hash'] === '') {
        $error = 'LiveKit setup token not configured.';
        return false;
    }
    if ($config['used']) {
        $error = 'LiveKit setup token already used.';
        return false;
    }
    if (!password_verify($token, $config['token_hash'])) {
        $error = 'Invalid LiveKit setup token.';
        return false;
    }
    if ($consume) {
        $save_error = null;
        if (!save_livekit_setup_config([
            'token_hash' => $config['token_hash'],
            'used' => true
        ], $save_error)) {
            $error = $save_error ?: 'Unable to finalize setup token.';
            return false;
        }
    }
    return true;
}

function save_livekit_config(array $config, ?string &$error): bool
{
    $error = null;
    $config_path = get_livekit_config_path();
    $dir = dirname($config_path);
    if (!is_dir($dir)) {
        if (!mkdir($dir, 0750, true)) {
            $error = 'Unable to create config directory.';
            return false;
        }
    }
    $payload = [
        'url' => $config['url'] ?? '',
        'api_key' => $config['api_key'] ?? '',
        'api_secret' => $config['api_secret'] ?? ''
    ];
    $export = "<?php\n\nreturn " . var_export($payload, true) . ";\n";
    $tmp = $config_path . '.tmp';
    if (file_put_contents($tmp, $export) === false) {
        $error = 'Unable to write LiveKit config.';
        return false;
    }
    if (!rename($tmp, $config_path)) {
        $error = 'Unable to finalize LiveKit config.';
        return false;
    }
    return true;
}

function base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function create_livekit_token(string $api_key, string $api_secret, array $claims): string
{
    $header = ['alg' => 'HS256', 'typ' => 'JWT'];
    $segments = [
        base64url_encode(json_encode($header)),
        base64url_encode(json_encode($claims))
    ];
    $signature = hash_hmac('sha256', implode('.', $segments), $api_secret, true);
    $segments[] = base64url_encode($signature);
    return implode('.', $segments);
}
