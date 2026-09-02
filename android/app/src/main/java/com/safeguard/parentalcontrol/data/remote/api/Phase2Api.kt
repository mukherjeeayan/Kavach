package com.safeguard.parentalcontrol.data.remote.api

import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.CommunicationReportDto
import com.safeguard.parentalcontrol.data.remote.dto.DeviceHealthReportDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceCheckDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceEventDto
import com.safeguard.parentalcontrol.data.remote.dto.MoodLogDto
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto
import com.safeguard.parentalcontrol.data.remote.dto.SosEventDto
import com.safeguard.parentalcontrol.data.remote.dto.SosTriggerDto
import com.safeguard.parentalcontrol.data.remote.dto.UrlAccessRequestDto
import com.safeguard.parentalcontrol.data.remote.dto.UrlAccessRequestResponseDto
import com.safeguard.parentalcontrol.data.remote.dto.UrlFilterRuleDto
import com.safeguard.parentalcontrol.data.remote.dto.VoiceCommandReportDto
import com.safeguard.parentalcontrol.data.remote.dto.WifiLogReportDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface Phase2Api {

    @GET("api/v1/children/{childId}/url-filters/sync")
    suspend fun syncUrlFilters(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<UrlFilterRuleDto>>>

    @POST("api/v1/devices/{deviceId}/health")
    suspend fun reportDeviceHealth(
        @Path("deviceId") deviceId: String,
        @Body body: DeviceHealthReportDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/communications")
    suspend fun reportCommunications(
        @Path("deviceId") deviceId: String,
        @Body body: CommunicationReportDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/sos")
    suspend fun triggerSos(
        @Path("deviceId") deviceId: String,
        @Body body: SosTriggerDto
    ): Response<ApiResponse<SosEventDto>>

    @POST("api/v1/devices/{deviceId}/geofences/check")
    suspend fun checkGeofences(
        @Path("deviceId") deviceId: String,
        @Body body: GeofenceCheckDto
    ): Response<ApiResponse<List<GeofenceEventDto>>>

    @GET("api/v1/devices/{deviceId}/geofences")
    suspend fun getActiveGeofences(
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<List<GeofenceDto>>>

    @POST("api/v1/devices/{deviceId}/mood")
    suspend fun logMood(
        @Path("deviceId") deviceId: String,
        @Body body: MoodLogDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/security-scans")
    suspend fun reportSecurityScan(
        @Path("deviceId") deviceId: String,
        @Body body: SecurityScanReportDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/wifi-logs")
    suspend fun reportWifiLog(
        @Path("deviceId") deviceId: String,
        @Body body: WifiLogReportDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/voice-commands")
    suspend fun recordVoiceCommand(
        @Path("deviceId") deviceId: String,
        @Body body: VoiceCommandReportDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/self-harm-alerts")
    suspend fun uploadSelfHarmAlert(
        @Path("deviceId") deviceId: String,
        @Body body: com.safeguard.parentalcontrol.data.remote.dto.SelfHarmAlertUploadDto
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/children/{childId}/url-access-requests")
    suspend fun requestUrlAccess(
        @Path("childId") childId: String,
        @Body body: UrlAccessRequestDto
    ): Response<ApiResponse<UrlAccessRequestResponseDto>>

    @POST("api/v1/children/{childId}/unblock-requests/{requestId}/respond")
    suspend fun respondToUnblockRequest(
        @Path("childId") childId: String,
        @Path("requestId") requestId: String,
        @Body body: UnblockRequestResponseDto
    ): Response<ApiResponse<Unit>>
}

data class UnblockRequestResponseDto(
    val approved: Boolean
)
