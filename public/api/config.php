<?php
/**
 * Tema Metro Education Directorate (GES) - cPanel Database Configuration
 * Subdomain: https://temametro.codecasticgh.com
 *
 * INSTRUCTIONS FOR CPANEL:
 * 1. In cPanel -> MySQL Database Wizard, create your database and user (with ALL PRIVILEGES).
 * 2. Update DB_NAME, DB_USER, and DB_PASS below with your cPanel MySQL credentials.
 */

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

define('DB_HOST', getenv('CPANEL_DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('CPANEL_DB_NAME') ?: 'codecast_temametro');
define('DB_USER', getenv('CPANEL_DB_USER') ?: 'codecast_temauser');
define('DB_PASS', getenv('CPANEL_DB_PASS') ?: 'CHANGE_ME_IN_CPANEL');

function get_db_connection(): PDO {
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }

    $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
    ];

    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);

    // Ensure core tables exist automatically on first connection
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS `users` (
          `id` VARCHAR(128) NOT NULL,
          `email` VARCHAR(191) DEFAULT NULL,
          `password_hash` VARCHAR(255) DEFAULT NULL,
          `role` VARCHAR(50) DEFAULT 'teacher',
          `staffId` VARCHAR(64) DEFAULT NULL,
          `isOnline` TINYINT(1) DEFAULT 0,
          `lastActive` VARCHAR(64) DEFAULT NULL,
          `data_json` LONGTEXT NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_users_email` (`email`),
          KEY `idx_users_staffId` (`staffId`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `submissions` (
          `id` VARCHAR(128) NOT NULL,
          `staffId` VARCHAR(64) DEFAULT NULL,
          `teacherName` VARCHAR(255) DEFAULT NULL,
          `email` VARCHAR(191) DEFAULT NULL,
          `category` VARCHAR(100) DEFAULT NULL,
          `circuit` VARCHAR(150) DEFAULT NULL,
          `school` VARCHAR(255) DEFAULT NULL,
          `currentRank` VARCHAR(150) DEFAULT NULL,
          `status` VARCHAR(50) DEFAULT 'submitted',
          `submittedBy` VARCHAR(128) DEFAULT NULL,
          `photoUrl` TEXT DEFAULT NULL,
          `data_json` LONGTEXT NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_sub_staffId` (`staffId`),
          KEY `idx_sub_circuit` (`circuit`),
          KEY `idx_sub_school` (`school`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

        CREATE TABLE IF NOT EXISTS `schools` (
          `id` VARCHAR(128) NOT NULL,
          `emis` VARCHAR(64) DEFAULT NULL,
          `name` VARCHAR(255) DEFAULT NULL,
          `circuit` VARCHAR(150) DEFAULT NULL,
          `type` VARCHAR(64) DEFAULT 'PUBLIC',
          `levels` VARCHAR(128) DEFAULT NULL,
          `head` VARCHAR(255) DEFAULT NULL,
          `data_json` LONGTEXT NOT NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_sch_emis` (`emis`),
          KEY `idx_sch_name` (`name`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    ");

    return $pdo;
}
