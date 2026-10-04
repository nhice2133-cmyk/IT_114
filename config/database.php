<?php
/**
 * ==============================================================================
 * AirSense - Session & Auth Helper (Firebase-Only Mode)
 * ==============================================================================
 * No MySQL dependency. All sensor data comes from Firebase Realtime Database
 * via the client-side JavaScript SDK.
 */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

/**
 * Checks if the current user is logged in (Always true for direct dashboard access).
 * @return bool
 */
function isLoggedIn(): bool {
    return true;
}

/**
 * Enforces authentication. (Direct access enabled)
 */
function requireLogin(): void {
    // Direct access allowed
}

/**
 * Returns current active maintenance user details.
 * @return array
 */
function getCurrentUser(): array {
    return [
        'id'        => $_SESSION['user_id'] ?? 1,
        'username'  => $_SESSION['username'] ?? 'technician',
        'full_name' => $_SESSION['full_name'] ?? 'HVAC Maintenance Personnel',
        'role'      => $_SESSION['user_role'] ?? 'technician'
    ];
}
