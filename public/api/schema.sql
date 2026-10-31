-- ============================================================================
-- Tema Metro Education Directorate (GES) - cPanel MySQL Database Schema
-- Subdomain: https://temametro.codecasticgh.com
-- ============================================================================

SET NAMES utf8mb4;
SET TIME_ZONE = '+00:00';

-- 1. USERS TABLE (Teachers, Metro Officers, Editors, Admins)
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
  KEY `idx_users_staffId` (`staffId`),
  KEY `idx_users_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. SUBMISSIONS TABLE (Teacher Personal Record Forms & Attached Documents)
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
  KEY `idx_sub_school` (`school`),
  KEY `idx_sub_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. SCHOOLS TABLE (EDMS School Census, Enrolment, Staffing, Facilities, Textbooks)
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
  KEY `idx_sch_name` (`name`),
  KEY `idx_sch_circuit` (`circuit`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
