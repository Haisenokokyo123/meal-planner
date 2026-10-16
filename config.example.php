<?php
// Copy to config.local.php and adjust to your local XAMPP installation.
// Never commit local credentials. phpMyAdmin manages this MariaDB/MySQL database.
return [
    'DB_HOST' => '127.0.0.1',
    'DB_PORT' => 3306,
    'DB_NAME' => 'sakto_meals',
    'DB_USER' => 'root',
    'DB_PASSWORD' => '',
    'APP_URL' => 'http://localhost/meal-planner',
    'MAIL_OUTBOX_DIR' => __DIR__ . '/.local/outbox',
];
