<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'meetings.join', 20, 60);
$body = get_json_body();

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';
$host_token = isset($_GET['host_token']) ? trim($_GET['host_token']) : '';
$password = isset($body['password']) ? trim($body['password']) : '';
$display_name = isset($body['display_name']) ? trim($body['display_name']) : '';
$session_token_in = isset($body['session_token']) ? trim($body['session_token']) : '';

if ($meeting_id === '' || $display_name === '') {
    json_response(['error' => 'Meeting ID and name are required'], 400);
}

$stmt = $pdo->prepare('SELECT id, password_hash, status, host_token, host_joined, meeting_type, scheduled_start, duration_minutes, first_joined_at, expires_at, (meeting_type = "scheduled" AND scheduled_start IS NOT NULL AND scheduled_start > NOW()) AS not_started, (meeting_type = "scheduled" AND scheduled_start IS NOT NULL AND duration_minutes IS NOT NULL AND DATE_ADD(scheduled_start, INTERVAL duration_minutes MINUTE) <= NOW()) AS ended_by_schedule FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

if ($meeting['status'] !== 'active') {
    json_response(['error' => 'Meeting ended'], 410);
}

if ($meeting['expires_at'] && strtotime($meeting['expires_at']) < time()) {
    json_response(['error' => 'Meeting expired'], 410);
}

if ($meeting['meeting_type'] === 'scheduled' && (int) $meeting['not_started'] === 1) {
    json_response([
        'error' => 'Meeting not started yet',
        'scheduled_start' => $meeting['scheduled_start']
    ], 403);
}

if ($meeting['meeting_type'] === 'scheduled' && (int) $meeting['ended_by_schedule'] === 1) {
    $stop = $pdo->prepare('UPDATE meetings SET status = "ended", ended_at = NOW() WHERE id = ? AND status = "active"');
    $stop->execute([$meeting_id]);
    json_response(['error' => 'Meeting ended'], 410);
}

if ($session_token_in !== '') {
    $resume = $pdo->prepare('SELECT session_token, is_host, left_at, approval_status FROM participants WHERE meeting_id = ? AND session_token = ? LIMIT 1');
    $resume->execute([$meeting_id, $session_token_in]);
    $existing = $resume->fetch();
    if ($existing && !$existing['left_at']) {
        $approval_status = $existing['approval_status'] ?: 'approved';
        json_response([
            'meeting_id' => $meeting_id,
            'access_token' => bin2hex(random_bytes(16)),
            'is_host' => (bool) $existing['is_host'],
            'status' => $meeting['status'],
            'session_token' => $existing['session_token'],
            'approval_status' => $approval_status,
            'pending' => $approval_status === 'pending',
        ]);
    }
}

if ($host_token !== '') {
    if (!hash_equals($meeting['host_token'], $host_token)) {
        json_response(['error' => 'Invalid host token'], 401);
    }
    if ((int) $meeting['host_joined'] === 1) {
        $host_check = $pdo->prepare('SELECT session_token FROM participants WHERE meeting_id = ? AND is_host = 1 AND left_at IS NULL LIMIT 1');
        $host_check->execute([$meeting_id]);
        $existing_host = $host_check->fetch();
        if ($existing_host && isset($existing_host['session_token'])) {
            json_response([
                'meeting_id' => $meeting_id,
                'access_token' => bin2hex(random_bytes(16)),
                'is_host' => true,
                'status' => $meeting['status'],
                'session_token' => $existing_host['session_token'],
            ]);
        }
    }
} else {
    if ($meeting['password_hash']) {
        if (!password_verify($password, $meeting['password_hash'])) {
            json_response(['error' => 'Invalid password'], 401);
        }
    }
}

if ($host_token !== '') {
    $session_token = bin2hex(random_bytes(16));
    $insert = $pdo->prepare('INSERT INTO participants (meeting_id, display_name, is_host, session_token, approval_status, approved_at) VALUES (?, ?, 1, ?, "approved", NOW())');
    $insert->execute([$meeting_id, $display_name, $session_token]);
    $mark = $pdo->prepare('UPDATE meetings SET host_joined = 1 WHERE id = ?');
    $mark->execute([$meeting_id]);
} else {
    $session_token = bin2hex(random_bytes(16));
    $insert = $pdo->prepare('INSERT INTO participants (meeting_id, display_name, is_host, session_token, approval_status) VALUES (?, ?, 0, ?, "pending")');
    $insert->execute([$meeting_id, $display_name, $session_token]);
}

$is_host = $host_token !== '';
if ($is_host && !$meeting['first_joined_at']) {
    $extend = $pdo->prepare('UPDATE meetings SET first_joined_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?');
    $extend->execute([$meeting_id]);
}

$token = bin2hex(random_bytes(16));

if ($is_host) {
    audit_log($pdo, 'meeting.join', $meeting_id, 'host', $session_token, [
        'display_name' => $display_name,
        'is_host' => true
    ]);
} else {
    audit_log($pdo, 'meeting.request', $meeting_id, 'guest', $session_token, [
        'display_name' => $display_name,
        'is_host' => false
    ]);
}

json_response([
    'meeting_id' => $meeting_id,
    'access_token' => $token,
    'is_host' => $is_host,
    'status' => $meeting['status'],
    'session_token' => $session_token,
    'approval_status' => $is_host ? 'approved' : 'pending',
    'pending' => !$is_host,
]);
