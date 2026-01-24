<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'participants.remove', 20, 60);

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';
$host_token = isset($_GET['host_token']) ? trim($_GET['host_token']) : '';
$session_token = isset($_GET['session_token']) ? trim($_GET['session_token']) : '';

if ($meeting_id === '' || $session_token === '') {
    json_response(['error' => 'Meeting ID and session token are required'], 400);
}

$stmt = $pdo->prepare('SELECT id, host_token, status FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

$admin = null;
if ($host_token === '' || !hash_equals($meeting['host_token'], $host_token)) {
    $admin = validate_admin_key($pdo, get_api_key());
    if (!$admin) {
        json_response(['error' => 'Invalid host token or API key'], 401);
    }
}

$participant = $pdo->prepare('SELECT id, is_host FROM participants WHERE meeting_id = ? AND session_token = ?');
$participant->execute([$meeting_id, $session_token]);
$row = $participant->fetch();

if (!$row) {
    json_response(['error' => 'Participant not found'], 404);
}

if ((int) $row['is_host'] === 1) {
    json_response(['error' => 'Cannot remove host'], 400);
}

$leave = $pdo->prepare('UPDATE participants SET left_at = NOW(), left_reason = ? WHERE id = ?');
$leave->execute(['removed', $row['id']]);

audit_log($pdo, 'participant.remove', $meeting_id, $admin ? 'admin' : 'host', $admin ? $admin['key_prefix'] : substr($host_token, 0, 8), [
    'session_token' => $session_token
]);

json_response(['status' => 'removed']);
