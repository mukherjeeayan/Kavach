package com.safeguard.parentalcontrol.data.remote.dto

import com.google.gson.annotations.SerializedName

data class UrlFilterRuleDto(
    @SerializedName("id") val id: String,
    @SerializedName("child_id") val childId: String,
    @SerializedName("pattern") val pattern: String,
    @SerializedName("rule_type") val ruleType: String,
    @SerializedName("category") val category: String?,
    @SerializedName("is_active") val isActive: Boolean
)

data class CreateUrlFilterDto(
    @SerializedName("pattern") val pattern: String,
    @SerializedName("rule_type") val ruleType: String = "BLOCK",
    @SerializedName("category") val category: String? = null
)

data class DeviceHealthReportDto(
    @SerializedName("battery_level") val batteryLevel: Int,
    @SerializedName("battery_status") val batteryStatus: String,
    @SerializedName("storage_total_bytes") val storageTotalBytes: Long,
    @SerializedName("storage_used_bytes") val storageUsedBytes: Long,
    @SerializedName("storage_available_bytes") val storageAvailableBytes: Long,
    @SerializedName("is_rooted") val isRooted: Boolean = false,
    @SerializedName("is_debugger_attached") val isDebuggerAttached: Boolean = false,
    @SerializedName("os_version") val osVersion: String,
    @SerializedName("security_patch_level") val securityPatchLevel: String? = null,
    @SerializedName("disk_encryption") val diskEncryption: Boolean = false,
    @SerializedName("unknown_sources") val unknownSources: Boolean = false
)

data class CommunicationReportDto(
    @SerializedName("entries") val entries: List<CommunicationEntryDto>
)

data class CommunicationEntryDto(
    @SerializedName("comm_type") val commType: String,
    @SerializedName("direction") val direction: String,
    @SerializedName("peer_number") val peerNumber: String,
    @SerializedName("content_preview") val contentPreview: String? = null,
    @SerializedName("duration_seconds") val durationSeconds: Int? = null,
    @SerializedName("timestamp") val timestamp: String
)

data class SosTriggerDto(
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null,
    @SerializedName("trigger_method") val triggerMethod: String = "BUTTON"
)

data class SosEventDto(
    @SerializedName("id") val id: String,
    @SerializedName("status") val status: String,
    @SerializedName("trigger_method") val triggerMethod: String,
    @SerializedName("created_at") val createdAt: String
)

data class GeofenceCheckDto(
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double
)

data class GeofenceDto(
    @SerializedName("id") val id: String,
    @SerializedName("child_id") val childId: String,
    @SerializedName("name") val name: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("radius_meters") val radiusMeters: Double,
    @SerializedName("zone_type") val zoneType: String,
    @SerializedName("is_active") val isActive: Boolean
)

data class GeofenceEventDto(
    @SerializedName("id") val id: String,
    @SerializedName("geofence_id") val geofenceId: String,
    @SerializedName("event_type") val eventType: String,
    @SerializedName("created_at") val createdAt: String
)

data class CreateGeofenceDto(
    @SerializedName("name") val name: String,
    @SerializedName("latitude") val latitude: Double,
    @SerializedName("longitude") val longitude: Double,
    @SerializedName("radius_meters") val radiusMeters: Double,
    @SerializedName("zone_type") val zoneType: String = "SAFE"
)

data class MoodLogDto(
    @SerializedName("mood_score") val moodScore: Int,
    @SerializedName("mood_label") val moodLabel: String? = null,
    @SerializedName("note") val note: String? = null
)

data class MoodLogResponseDto(
    @SerializedName("id") val id: String,
    @SerializedName("child_id") val childId: String,
    @SerializedName("mood_score") val moodScore: Int,
    @SerializedName("mood_label") val moodLabel: String?,
    @SerializedName("note") val note: String?,
    @SerializedName("logged_at") val loggedAt: String
)

data class SecurityScanReportDto(
    @SerializedName("is_rooted") val isRooted: Boolean,
    @SerializedName("has_keylogger") val hasKeylogger: Boolean,
    @SerializedName("wifi_ssid") val wifiSsid: String? = null,
    @SerializedName("wifi_bssid") val wifiBssid: String? = null,
    @SerializedName("is_open_network") val isOpenNetwork: Boolean = false,
    @SerializedName("app_integrity_ok") val appIntegrityOk: Boolean = true
)

data class SecurityScanDto(
    @SerializedName("id") val id: String,
    @SerializedName("child_id") val childId: String,
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("is_rooted") val isRooted: Boolean,
    @SerializedName("has_keylogger") val hasKeylogger: Boolean,
    @SerializedName("wifi_ssid") val wifiSsid: String?,
    @SerializedName("wifi_bssid") val wifiBssid: String?,
    @SerializedName("is_open_network") val isOpenNetwork: Boolean,
    @SerializedName("app_integrity_ok") val appIntegrityOk: Boolean,
    @SerializedName("scan_result") val scanResult: String,
    @SerializedName("created_at") val createdAt: String
)

data class WifiLogReportDto(
    @SerializedName("wifi_ssid") val wifiSsid: String,
    @SerializedName("wifi_bssid") val wifiBssid: String,
    @SerializedName("wifi_security") val wifiSecurity: String,
    @SerializedName("is_open_network") val isOpenNetwork: Boolean,
    @SerializedName("latitude") val latitude: Double? = null,
    @SerializedName("longitude") val longitude: Double? = null
)

data class VoiceCommandReportDto(
    @SerializedName("command_text") val commandText: String,
    @SerializedName("intent") val intent: String? = null,
    @SerializedName("was_executed") val wasExecuted: Boolean = false
)

data class RewardCatalogDto(
    @SerializedName("id") val id: String,
    @SerializedName("name") val name: String,
    @SerializedName("description") val description: String?,
    @SerializedName("points_cost") val pointsCost: Int,
    @SerializedName("is_active") val isActive: Boolean
)

data class RewardPointsDto(
    @SerializedName("child_id") val childId: String,
    @SerializedName("total_earned") val totalEarned: Int,
    @SerializedName("total_redeemed") val totalRedeemed: Int,
    @SerializedName("available") val available: Int
)

data class BehaviorPredictionDto(
    @SerializedName("id") val id: String,
    @SerializedName("child_id") val childId: String,
    @SerializedName("prediction_type") val predictionType: String,
    @SerializedName("risk_score") val riskScore: Double,
    @SerializedName("explanation") val explanation: String,
    @SerializedName("data_window_days") val dataWindowDays: Int,
    @SerializedName("created_at") val createdAt: String
)

data class SelfHarmAlertDto(
    @SerializedName("id") val id: String,
    @SerializedName("child_id") val childId: String,
    @SerializedName("source_type") val sourceType: String,
    @SerializedName("detected_keywords") val detectedKeywords: List<String>,
    @SerializedName("content_snippet") val contentSnippet: String?,
    @SerializedName("risk_level") val riskLevel: String,
    @SerializedName("is_acknowledged") val isAcknowledged: Boolean,
    @SerializedName("created_at") val createdAt: String
)
