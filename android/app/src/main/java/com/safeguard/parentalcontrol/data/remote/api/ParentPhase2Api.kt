package com.safeguard.parentalcontrol.data.remote.api

import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.BehaviorPredictionDto
import com.safeguard.parentalcontrol.data.remote.dto.CreateGeofenceDto
import com.safeguard.parentalcontrol.data.remote.dto.CreateUrlFilterDto
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceDto
import com.safeguard.parentalcontrol.data.remote.dto.MoodLogResponseDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardCatalogDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardPointsDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardRedemptionDto
import com.safeguard.parentalcontrol.data.remote.dto.RewardRedemptionRequestDto
import com.safeguard.parentalcontrol.data.remote.dto.SecurityScanDto
import com.safeguard.parentalcontrol.data.remote.dto.SelfHarmAlertDto
import com.safeguard.parentalcontrol.data.remote.dto.UrlFilterRuleDto
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ParentPhase2Api {

    @GET("api/v1/children/{childId}/url-filters")
    suspend fun getUrlFilters(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<UrlFilterRuleDto>>>

    @POST("api/v1/children/{childId}/url-filters")
    suspend fun createUrlFilter(
        @Path("childId") childId: String,
        @Body body: CreateUrlFilterDto
    ): Response<ApiResponse<UrlFilterRuleDto>>

    @DELETE("api/v1/children/{childId}/url-filters/{ruleId}")
    suspend fun deleteUrlFilter(
        @Path("childId") childId: String,
        @Path("ruleId") ruleId: String
    ): Response<ApiResponse<Unit>>

    @GET("api/v1/children/{childId}/geofences")
    suspend fun getGeofences(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<GeofenceDto>>>

    @POST("api/v1/children/{childId}/geofences")
    suspend fun createGeofence(
        @Path("childId") childId: String,
        @Body body: CreateGeofenceDto
    ): Response<ApiResponse<GeofenceDto>>

    @DELETE("api/v1/children/{childId}/geofences/{geofenceId}")
    suspend fun deleteGeofence(
        @Path("childId") childId: String,
        @Path("geofenceId") geofenceId: String
    ): Response<ApiResponse<Unit>>

    @GET("api/v1/children/{childId}/mood")
    suspend fun getMoodLogs(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<MoodLogResponseDto>>>

    @GET("api/v1/rewards/catalog")
    suspend fun getRewardCatalog(): Response<ApiResponse<List<RewardCatalogDto>>>

    @GET("api/v1/children/{childId}/rewards/points")
    suspend fun getChildPoints(
        @Path("childId") childId: String
    ): Response<ApiResponse<RewardPointsDto>>

    @POST("api/v1/rewards/redeem")
    suspend fun requestRedemption(
        @Body body: RewardRedemptionRequestDto
    ): Response<ApiResponse<RewardRedemptionDto>>

    @GET("api/v1/children/{childId}/rewards/redemptions")
    suspend fun getRedemptions(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<RewardRedemptionDto>>>

    @GET("api/v1/children/{childId}/predictions")
    suspend fun getPredictions(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<BehaviorPredictionDto>>>

    @GET("api/v1/children/{childId}/self-harm-alerts")
    suspend fun getSelfHarmAlerts(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<SelfHarmAlertDto>>>

    @GET("api/v1/children/{childId}/devices/{deviceId}/security-scans")
    suspend fun getSecurityScans(
        @Path("childId") childId: String,
        @Path("deviceId") deviceId: String
    ): Response<ApiResponse<List<SecurityScanDto>>>
}
