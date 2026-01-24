<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('POST');
enforce_rate_limit($pdo, 'livekit.token', 30, 60);

$meeting_id = isset($_GET['meeting_id']) ? trim($_GET['meeting_id']) : '';
$session_token = isset($_GET['session_token']) ? trim($_GET['session_token']) : '';
$body = get_json_body();

if ($meeting_id === '' || $session_token === '') {
    json_response(['error' => 'Meeting ID and session token are required'], 400);
}

$stmt = $pdo->prepare('SELECT id, status, host_joined FROM meetings WHERE id = ?');
$stmt->execute([$meeting_id]);
$meeting = $stmt->fetch();

if (!$meeting) {
    json_response(['error' => 'Meeting not found'], 404);
}

if ($meeting['status'] !== 'active') {
    json_response(['error' => 'Meeting ended'], 410);
}

$participant_stmt = $pdo->prepare('SELECT id, display_name, is_host, left_at, approval_status FROM participants WHERE meeting_id = ? AND session_token = ?');
$participant_stmt->execute([$meeting_id, $session_token]);
$participant = $participant_stmt->fetch();

if (!$participant) {
    json_response(['error' => 'Participant not found'], 404);
}

if ($participant['left_at']) {
    json_response(['error' => 'Participant left'], 410);
}

if (($participant['approval_status'] ?? 'approved') !== 'approved') {
    json_response(['error' => 'Awaiting host approval'], 403);
}

if (!$meeting['host_joined'] && !(int) $participant['is_host']) {
    json_response(['error' => 'Host not joined yet'], 403);
}

$livekit_config = get_livekit_config();
$api_key = $livekit_config['api_key'];
$api_secret = $livekit_config['api_secret'];
$livekit_url = $livekit_config['url'] !== '' ? $livekit_config['url'] : 'ws://192.168.25.144:7880';

if ($api_key === '' || $api_secret === '') {
    json_response(['error' => 'LiveKit credentials not configured'], 500);
}

$room_name = sprintf('meeting_%s', $meeting_id);
$identity = sprintf('participant_%s', $participant['id']);
$expires = time() + 60 * 15;
$device = isset($body['device']) ? trim((string) $body['device']) : 'web';

$claims = [
    'iss' => $api_key,
    'sub' => $identity,
    'name' => $participant['display_name'],
    'exp' => $expires,
    'nbf' => time() - 10,
    'video' => [
        'room' => $room_name,
        'roomJoin' => true,
        'canPublish' => true,
        'canSubscribe' => true,
        'canPublishData' => true
    ],
    'metadata' => json_encode([
        'meeting_id' => $meeting_id,
        'participant_id' => (string) $participant['id'],
        'device' => $device,
        'is_host' => (int) $participant['is_host']
    ])
];

$token = create_livekit_token($api_key, $api_secret, $claims);

audit_log($pdo, 'livekit.token', $meeting_id, (int) $participant['is_host'] ? 'host' : 'guest', (string) $participant['id'], [
    'room' => $room_name,
    'identity' => $identity
]);

json_response([
    'token' => $token,
    'url' => $livekit_url,
    'room' => $room_name,
    'participant' => $identity
]);
