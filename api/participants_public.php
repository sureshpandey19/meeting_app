<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('GET');
enforce_rate_limit($pdo, 'participants.public', 60, 60);

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';

if ($meeting_id === '') {
    json_response(['error' => 'Meeting ID is required'], 400);
}

$stmt = $pdo->prepare('SELECT id, status FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

$list = $pdo->prepare('SELECT display_name, is_host, left_at, left_reason FROM participants WHERE meeting_id = ? AND left_at IS NULL AND approval_status = "approved" ORDER BY joined_at ASC');
$list->execute([$meeting_id]);
$participants = $list->fetchAll();
$active_count = count($participants);

json_response([
    'status' => $meeting['status'],
    'active_count' => $active_count,
    'participants' => $participants,
]);
