<?php

return [
    'db_host' => getenv('MEETING_DB_HOST') ?: '127.0.0.1',
    'db_port' => getenv('MEETING_DB_PORT') ?: '3306',
    'db_name' => getenv('MEETING_DB_NAME') ?: 'meeting_app',
    'db_user' => getenv('MEETING_DB_USER') ?: 'meeting_user',
    'db_pass' => getenv('MEETING_DB_PASS') ?: 'meeting_pass',
];
