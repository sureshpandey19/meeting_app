<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('GET');
enforce_rate_limit($pdo, 'meetings.info', 60, 60);
$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';

if ($meeting_id === '') {
    json_response(['error' => 'Meeting ID is required'], 400);
}

$stmt = $pdo->prepare('SELECT id, title, status, meeting_type, scheduled_start, duration_minutes, host_joined, expires_at FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

if ($meeting['meeting_type'] === 'scheduled' && $meeting['scheduled_start'] && $meeting['duration_minutes'] && $meeting['status'] === 'active') {
    $end_stmt = $pdo->prepare('SELECT DATE_ADD(?, INTERVAL ? MINUTE) <= NOW() AS ended');
    $end_stmt->execute([$meeting['scheduled_start'], (int) $meeting['duration_minutes']]);
    $end_row = $end_stmt->fetch();
    if ($end_row && (int) $end_row['ended'] === 1) {
        $stop = $pdo->prepare('UPDATE meetings SET status = "ended", ended_at = NOW() WHERE id = ?');
        $stop->execute([$meeting_id]);
        $meeting['status'] = 'ended';
    }
}

json_response([
    'meeting_id' => $meeting['id'],
    'title' => $meeting['title'],
    'status' => $meeting['status'],
    'meeting_type' => $meeting['meeting_type'],
    'scheduled_start' => $meeting['scheduled_start'],
    'duration_minutes' => $meeting['duration_minutes'],
    'host_joined' => (bool) $meeting['host_joined'],
    'expires_at' => $meeting['expires_at'],
]);
