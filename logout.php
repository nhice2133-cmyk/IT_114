<?php
/**
 * ==============================================================================
 * AirSense - Direct Access Reset
 * ==============================================================================
 */
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
$_SESSION = [];
session_destroy();

header('Location: dashboard.php');
exit;
