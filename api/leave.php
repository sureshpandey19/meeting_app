<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'meetings.leave', 30, 60);

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';
$session_token = isset($_GET['session_token']) ? trim($_GET['session_token']) : '';

if ($meeting_id === '' || $session_token === '') {
    json_response(['error' => 'Meeting ID and session token are required'], 400);
}

$stmt = $pdo->prepare('SELECT id, status FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

$participant = $pdo->prepare('SELECT id, is_host FROM participants WHERE meeting_id = ? AND session_token = ? AND left_at IS NULL');
$participant->execute([$meeting_id, $session_token]);
$row = $participant->fetch();

if (!$row) {
    json_response(['error' => 'Participant not found'], 404);
}

$leave = $pdo->prepare('UPDATE participants SET left_at = NOW(), left_reason = ? WHERE id = ?');
$leave->execute(['left', $row['id']]);

if ((int) $row['is_host'] === 1) {
    $update = $pdo->prepare('UPDATE meetings SET status = ?, ended_at = NOW(), host_joined = 0 WHERE id = ?');
    $update->execute(['ended', $meeting_id]);
    $close = $pdo->prepare('UPDATE participants SET left_at = NOW(), left_reason = ? WHERE meeting_id = ? AND left_at IS NULL');
    $close->execute(['ended', $meeting_id]);
}

audit_log($pdo, 'meeting.leave', $meeting_id, (int) $row['is_host'] === 1 ? 'host' : 'guest', $session_token, [
    'left_reason' => 'left'
]);

json_response(['status' => 'left']);
