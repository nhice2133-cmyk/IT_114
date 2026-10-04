-- =====================================================================
-- AirSense: AC Dust Accumulation Monitoring & Maintenance System
-- Research Project MySQL Database Schema
-- Compatible with MySQL 8.x / MariaDB (XAMPP Default)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `airsense_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `airsense_db`;

-- ---------------------------------------------------------------------
-- Table 1: Users (Authorized Maintenance Personnel and Administrators)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `username` VARCHAR(50) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(100) NOT NULL,
    `role` ENUM('admin', 'technician', 'supervisor') NOT NULL DEFAULT 'technician',
    `email` VARCHAR(100) NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default Seed Users:
-- Admin: username="admin", password="password123"
-- Technician: username="tech1", password="password123"
INSERT INTO `users` (`username`, `password_hash`, `full_name`, `role`, `email`)
VALUES 
('admin', '$2y$10$tZ2y1uFjUcm5G9d.rW8k1e3R7yqGeqoE1F2R.kXo8xLwXp.t4L6re', 'System Administrator', 'admin', 'admin@airsense.local'),
('tech1', '$2y$10$tZ2y1uFjUcm5G9d.rW8k1e3R7yqGeqoE1F2R.kXo8xLwXp.t4L6re', 'Lead HVAC Technician', 'technician', 'tech1@airsense.local')
ON DUPLICATE KEY UPDATE `username`=`username`;

-- ---------------------------------------------------------------------
-- Table 2: AC Units / Sensors Registry (Supports Modular Expansion)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `ac_sensors` (
    `sensor_id` VARCHAR(50) PRIMARY KEY, -- e.g., 'sensor1'
    `ac_unit_label` VARCHAR(100) NOT NULL, -- e.g., 'AC Unit 101 - Main Server Room'
    `location` VARCHAR(150) NOT NULL,
    `model_specs` VARCHAR(150) DEFAULT 'Split-Type 2.0HP Inverter',
    `status` ENUM('active', 'maintenance', 'offline') DEFAULT 'active',
    `registered_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `ac_sensors` (`sensor_id`, `ac_unit_label`, `location`, `model_specs`)
VALUES 
('sensor1', 'AC Unit 101 - Research Lab', 'Building A, Room 302', 'Split-Type 2.5HP Inverter'),
('sensor2', 'AC Unit 102 - Server Room', 'Building A, Ground Floor', 'Floor-Mounted 3.0HP Inverter')
ON DUPLICATE KEY UPDATE `sensor_id`=`sensor_id`;

-- ---------------------------------------------------------------------
-- Table 3: Maintenance Logs (Servicing & Filter Cleaning Actions)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `maintenance_logs` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sensor_id` VARCHAR(50) NOT NULL,
    `ac_unit` VARCHAR(100) NOT NULL,
    `service_date` DATE NOT NULL,
    `dust_level_before` DECIMAL(5, 2) NOT NULL COMMENT 'Dust percentage at time of cleaning',
    `notes` TEXT NOT NULL,
    `performed_by` VARCHAR(100) NOT NULL,
    `action_taken` VARCHAR(100) DEFAULT 'Filter Cleaning & Mesh Wash',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`sensor_id`),
    INDEX (`service_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Sample Maintenance Record
INSERT INTO `maintenance_logs` (`sensor_id`, `ac_unit`, `service_date`, `dust_level_before`, `notes`, `performed_by`, `action_taken`)
VALUES 
('sensor1', 'AC Unit 101 - Research Lab', CURDATE() - INTERVAL 14 DAY, 84.50, 'Evaporator coil and primary air filter thoroughly washed and sanitized after high dust accumulation alert.', 'Lead HVAC Technician', 'Full Filter Wash & Coil Sanitize');

-- ---------------------------------------------------------------------
-- Table 4: Alert Notifications (Recorded High Dust Threshold Alerts)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `alert_notifications` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `sensor_id` VARCHAR(50) NOT NULL,
    `ac_unit` VARCHAR(100) NOT NULL,
    `dust_percentage` DECIMAL(5, 2) NOT NULL,
    `pm25_value` DECIMAL(6, 2) NOT NULL,
    `classification` VARCHAR(20) DEFAULT 'HIGH',
    `alert_status` VARCHAR(20) DEFAULT 'ACTIVE',
    `triggered_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `is_acknowledged` TINYINT(1) DEFAULT 0,
    `acknowledged_by` VARCHAR(100) NULL,
    `acknowledged_at` DATETIME NULL,
    INDEX (`sensor_id`),
    INDEX (`triggered_at`),
    INDEX (`is_acknowledged`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Sample Alert Record
INSERT INTO `alert_notifications` (`sensor_id`, `ac_unit`, `dust_percentage`, `pm25_value`, `classification`, `alert_status`, `triggered_at`, `is_acknowledged`, `acknowledged_by`, `acknowledged_at`)
VALUES 
('sensor1', 'AC Unit 101 - Research Lab', 84.50, 422.50, 'HIGH', 'RESOLVED', NOW() - INTERVAL 14 DAY, 1, 'Lead HVAC Technician', NOW() - INTERVAL 14 DAY + INTERVAL 20 MINUTE);

-- ---------------------------------------------------------------------
-- Table 5: Sensor Historical Readings (For Analytics & Trends)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sensor_history` (
    `id` BIGINT AUTO_INCREMENT PRIMARY KEY,
    `sensor_id` VARCHAR(50) NOT NULL,
    `pm1_0` DECIMAL(6, 2) NOT NULL,
    `pm2_5` DECIMAL(6, 2) NOT NULL,
    `pm10` DECIMAL(6, 2) NOT NULL,
    `dust_percentage` DECIMAL(5, 2) NOT NULL,
    `classification` ENUM('LOW', 'MODERATE', 'HIGH') NOT NULL,
    `recorded_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX (`sensor_id`),
    INDEX (`recorded_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Historical Sample Readings for Analytics Demonstration
INSERT INTO `sensor_history` (`sensor_id`, `pm1_0`, `pm2_5`, `pm10`, `dust_percentage`, `classification`, `recorded_at`)
VALUES
('sensor1', 8.2, 14.5, 22.0, 2.90, 'LOW', NOW() - INTERVAL 6 DAY),
('sensor1', 15.0, 28.0, 40.5, 5.60, 'LOW', NOW() - INTERVAL 5 DAY),
('sensor1', 34.0, 65.0, 95.0, 13.00, 'LOW', NOW() - INTERVAL 4 DAY),
('sensor1', 88.0, 160.0, 220.0, 32.00, 'LOW', NOW() - INTERVAL 3 DAY),
('sensor1', 140.0, 260.0, 340.0, 52.00, 'MODERATE', NOW() - INTERVAL 2 DAY),
('sensor1', 190.0, 375.0, 480.0, 75.00, 'MODERATE', NOW() - INTERVAL 1 DAY),
('sensor1', 225.0, 430.0, 560.0, 86.00, 'HIGH', NOW() - INTERVAL 4 HOUR);
