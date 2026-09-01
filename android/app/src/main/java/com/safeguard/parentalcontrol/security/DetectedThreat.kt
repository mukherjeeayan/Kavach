package com.safeguard.parentalcontrol.security

/**
 * A single detected keylogger / surveillance threat on the device.
 *
 * @param packageName the offending package, when known
 * @param type        category of surveillance vector
 * @param severity    risk weight: 0–100, higher = more dangerous
 * @param description human-readable explanation suitable for a parent alert
 */
data class DetectedThreat(
    val packageName: String,
    val type: ThreatType,
    val severity: Int,
    val description: String
) {
    enum class ThreatType {
        KNOWN_KEYLOGGER_PACKAGE,
        SUSPICIOUS_ACCESSIBILITY_SERVICE,
        SUSPICIOUS_OVERLAY_PERMISSION,
        SUSPICIOUS_NOTIFICATION_LISTENER
    }
}
