<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'meetings.create', 10, 60);
$body = get_json_body();

$type = isset($body['type']) ? trim($body['type']) : 'instant';
$title = isset($body['title']) ? trim($body['title']) : '';
$password = isset($body['password']) ? trim($body['password']) : '';
$created_by = isset($body['created_by']) ? trim($body['created_by']) : null;
$scheduled_date = isset($body['scheduled_date']) ? trim($body['scheduled_date']) : '';
$scheduled_time = isset($body['scheduled_time']) ? trim($body['scheduled_time']) : '';
$duration_minutes = isset($body['duration_minutes']) ? (int) $body['duration_minutes'] : null;

if ($type !== 'instant' && $type !== 'scheduled') {
    json_response(['error' => 'Invalid meeting type'], 400);
}

if ($type === 'scheduled') {
    if ($title === '' || $scheduled_date === '' || $scheduled_time === '' || !$duration_minutes) {
        json_response(['error' => 'Title, date, time, and duration are required'], 400);
    }
} else {
    if ($title === '') {
        $title = 'Instant Meeting';
    }
}

$meeting_id = null;
$attempts = 0;
while ($meeting_id === null && $attempts < 5) {
    $candidate = (string) random_int(1000000000, 9999999999);
    $check = $pdo->prepare('SELECT id FROM meetings WHERE id = ?');
    $check->execute([$candidate]);
    if (!$check->fetch()) {
        $meeting_id = $candidate;
    }
    $attempts++;
}

if ($meeting_id === null) {
    json_response(['error' => 'Could not generate meeting id'], 500);
}
$password_hash = null;
if ($password !== '') {
    $password_hash = password_hash($password, PASSWORD_DEFAULT);
}

$host_token = bin2hex(random_bytes(16));
$scheduled_start = null;
if ($type === 'scheduled') {
    $scheduled_start = $scheduled_date . ' ' . $scheduled_time . ':00';
}
if ($type === 'instant') {
    $expires_at = date('Y-m-d H:i:s', time() + 3600);
} else {
    $base_time = $scheduled_start ?: date('Y-m-d H:i:s');
    $expires_at = date('Y-m-d H:i:s', strtotime($base_time) + 86400);
}

$stmt = $pdo->prepare(
    'INSERT INTO meetings (id, title, password_hash, created_by, status, meeting_type, scheduled_start, duration_minutes, host_token, host_joined, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
);
$stmt->execute([
    $meeting_id,
    $title,
    $password_hash,
    $created_by,
    'active',
    $type,
    $scheduled_start,
    $duration_minutes,
    $host_token,
    0,
    $expires_at
]);

$join_link = '/meeting_app/join.html?meetingId=' . $meeting_id;
$host_link = '/meeting_app/join.html?meetingId=' . $meeting_id . '&hostToken=' . $host_token;

audit_log($pdo, 'meeting.create', $meeting_id, 'system', null, [
    'type' => $type,
    'created_by' => $created_by
]);

json_response([
    'meeting_id' => $meeting_id,
    'join_link' => $join_link,
    'host_link' => $host_link,
    'title' => $title,
    'meeting_type' => $type,
    'scheduled_start' => $scheduled_start,
    'duration_minutes' => $duration_minutes,
]);
