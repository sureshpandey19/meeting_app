<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('GET');
enforce_rate_limit($pdo, 'participants.list', 60, 60);

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

if ($host_token === '' || !hash_equals($meeting['host_token'], $host_token)) {
    $admin = validate_admin_key($pdo, get_api_key());
    if (!$admin) {
        json_response(['error' => 'Invalid host token or API key'], 401);
    }
}

$list = $pdo->prepare('SELECT display_name, is_host, joined_at, left_at, left_reason, session_token, approval_status FROM participants WHERE meeting_id = ? AND left_at IS NULL ORDER BY joined_at ASC');
$list->execute([$meeting_id]);
$participants = $list->fetchAll();

json_response([
    'status' => $meeting['status'],
    'participants' => $participants,
]);
