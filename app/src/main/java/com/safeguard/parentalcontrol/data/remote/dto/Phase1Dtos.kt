package com.safeguard.parentalcontrol.data.remote.dto

/**
 * Scheduled lock window as returned by the server.
 */
data class ScheduledLockDto(
    val id: String,
    val child_id: String,
    val device_id: String?,
    val day_of_week: Int?,
    val start_time: String,
    val end_time: String,
    val is_active: Boolean,
    val created_at: String,
    val updated_at: String
)

/**
 * Request body for POST/PUT /children/:childId/locks.
 */
data class LockInput(
    val device_id: String? = null,
    val day_of_week: Int? = null,
    val start_time: String,
    val end_time: String,
    val is_active: Boolean = true
)

/**
 * Allow/block rule for a phone number as returned by the server.
 */
data class ContactRuleDto(
    val id: String,
    val child_id: String,
    val device_id: String?,
    val phone_number: String,
    val contact_name: String?,
    val rule_type: String,
    val is_active: Boolean,
    val created_at: String,
    val updated_at: String
)

/**
 * Request body for POST/PUT /children/:childId/contacts.
 */
data class ContactInput(
    val phone_number: String,
    val contact_name: String? = null,
    val rule_type: String = "BLOCK",
    val device_id: String? = null
)

/**
 * One screen-time upload entry (device POST endpoint).
 */
data class ScreenTimeUploadEntry(
    val app_package: String,
    val app_category: String? = null,
    val seconds: Int,
    val date: String? = null
)

/**
 * Per-app usage row for a single date.
 */
data class ScreenTimeRowDto(
    val device_id: String,
    val app_package: String,
    val app_category: String?,
    val total_seconds: Int
)

/**
 * day/week/month summary payload.
 */
data class ScreenTimeSummaryDto(
    val range: String,
    val total_seconds: Long,
    val daily: List<DailyTotalDto>,
    val by_app: List<AppTotalDto>
)

data class DailyTotalDto(
    val date_recorded: String,
    val total_seconds: Long
)

data class AppTotalDto(
    val app_package: String,
    val app_category: String,
    val total_seconds: Long
)

/**
 * One GPS ping as returned by the server.
 */
data class LocationDto(
    val id: String,
    val child_id: String,
    val device_id: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy_m: Double?,
    val speed_kmh: Double?,
    val recorded_at: String
)

/**
 * Request body for POST /devices/:deviceId/location.
 */
data class LocationUploadRequest(
    val latitude: Double,
    val longitude: Double,
    val accuracy_m: Double? = null,
    val speed_kmh: Double? = null,
    val recorded_at: String? = null
)