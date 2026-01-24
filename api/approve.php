<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'participants.approve', 60, 60);

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';
$host_token = isset($_GET['host_token']) ? trim($_GET['host_token']) : '';
$session_token = isset($_GET['session_token']) ? trim($_GET['session_token']) : '';
$action = isset($_GET['action']) ? strtolower(trim($_GET['action'])) : '';

if ($meeting_id === '' || $session_token === '') {
    json_response(['error' => 'Meeting ID and session token are required'], 400);
}

if ($action !== 'approve' && $action !== 'deny') {
    json_response(['error' => 'Action must be approve or deny'], 400);
}

$stmt = $pdo->prepare('SELECT id, host_token, status, first_joined_at FROM meetings WHERE id = ?');
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

$participant_stmt = $pdo->prepare('SELECT id, is_host, approval_status, left_at FROM participants WHERE meeting_id = ? AND session_token = ?');
$participant_stmt->execute([$meeting_id, $session_token]);
$participant = $participant_stmt->fetch();

if (!$participant) {
    json_response(['error' => 'Participant not found'], 404);
}

if ((int) $participant['is_host'] === 1) {
    json_response(['error' => 'Cannot change host approval'], 400);
}

if ($participant['left_at']) {
    json_response(['error' => 'Participant already left'], 410);
}

if ($action === 'approve') {
    $update = $pdo->prepare('UPDATE participants SET approval_status = "approved", approved_at = NOW() WHERE id = ?');
    $update->execute([$participant['id']]);
    if (!$meeting['first_joined_at']) {
        $extend = $pdo->prepare('UPDATE meetings SET first_joined_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?');
        $extend->execute([$meeting_id]);
    }
    audit_log($pdo, 'meeting.approve', $meeting_id, 'host', $host_token, [
        'participant_id' => (string) $participant['id']
    ]);
    json_response(['status' => 'approved']);
}

$update = $pdo->prepare('UPDATE participants SET approval_status = "denied", left_at = NOW(), left_reason = "denied" WHERE id = ?');
$update->execute([$participant['id']]);
audit_log($pdo, 'meeting.deny', $meeting_id, 'host', $host_token, [
    'participant_id' => (string) $participant['id']
]);

json_response(['status' => 'denied']);
