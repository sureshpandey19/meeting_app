<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'meetings.stop', 20, 60);

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';
$host_token = isset($_GET['host_token']) ? trim($_GET['host_token']) : '';

if ($meeting_id === '') {
    json_response(['error' => 'Meeting ID is required'], 400);
}

$stmt = $pdo->prepare('SELECT id, host_token, status FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

if ($meeting['status'] !== 'active') {
    json_response(['error' => 'Meeting already ended'], 400);
}

$admin = null;
if ($host_token === '' || !hash_equals($meeting['host_token'], $host_token)) {
    $admin = validate_admin_key($pdo, get_api_key());
    if (!$admin) {
        json_response(['error' => 'Invalid host token or API key'], 401);
    }
}

$update = $pdo->prepare('UPDATE meetings SET status = ?, ended_at = NOW(), host_joined = 0 WHERE id = ?');
$update->execute(['ended', $meeting_id]);
$close = $pdo->prepare('UPDATE participants SET left_at = NOW(), left_reason = ? WHERE meeting_id = ? AND left_at IS NULL');
$close->execute(['ended', $meeting_id]);

audit_log($pdo, 'meeting.stop', $meeting_id, $admin ? 'admin' : 'host', $admin ? $admin['key_prefix'] : substr($host_token, 0, 8), [
    'status' => 'ended'
]);

json_response(['status' => 'ended']);
