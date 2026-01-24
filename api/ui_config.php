<?php

require __DIR__ . '/db.php';
require __DIR__ . '/helpers.php';

require_method('GET');

$config = get_ui_config();

json_response([
    'livekit_debug' => (bool) ($config['livekit_debug'] ?? false)
]);
