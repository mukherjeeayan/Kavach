package com.safeguard.parentalcontrol.data.remote.dto

/**
 * Standard API response envelope matching the backend's consistent
 * response format.
 */
data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val error: String?,
    val timestamp: String?,
    val request_id: String?
)

/**
 * DTO for a single app block rule as returned by the server.
 * Field names use snake_case to match the JSON contract.
 */
data class AppBlockRuleDto(
    val id: String,
    val device_id: String,
    val package_name: String,
    val app_name: String?,
    val is_blocked: Boolean,
    val block_reason: String?,
    val unblock_requested: Boolean,
    val unblock_reason: String?,
    val daily_limit_minutes: Int? = null,
    val created_at: String,
    val updated_at: String
)

/**
 * Request body for POST /block.
 */
data class BlockAppRequest(
    val device_id: String,
    val package_name: String,
    val app_name: String? = null,
    val block_reason: String? = null
)

/**
 * Request body for POST /unblock-request.
 */
data class RequestUnblockRequest(
    val rule_id: String,
    val reason: String
)

/**
 * Request body for POST /devices/:deviceId/tamper-alert.
 */
data class TamperAlertRequest(
    val details: String
)
