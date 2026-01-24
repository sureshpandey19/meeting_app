<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('GET');
enforce_rate_limit($pdo, 'meetings.status', 60, 60);

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

$participant = $pdo->prepare('SELECT left_at, is_host, approval_status FROM participants WHERE meeting_id = ? AND session_token = ?');
$participant->execute([$meeting_id, $session_token]);
$row = $participant->fetch();

if (!$row) {
    json_response(['error' => 'Participant not found'], 404);
}

json_response([
    'meeting_status' => $meeting['status'],
    'left_at' => $row['left_at'],
    'is_host' => (int) $row['is_host'],
    'approval_status' => $row['approval_status'] ?: 'approved',
]);
