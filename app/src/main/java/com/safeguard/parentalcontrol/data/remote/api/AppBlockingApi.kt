package com.safeguard.parentalcontrol.data.remote.api

import com.safeguard.parentalcontrol.data.remote.dto.AppBlockRuleDto
import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.BlockAppRequest
import com.safeguard.parentalcontrol.data.remote.dto.RequestUnblockRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Retrofit interface matching the backend routes at
 * /api/v1/children/:childId/apps/
 *
 * Every call returns Response<ApiResponse<T>> so the repository can
 * inspect HTTP status codes and fall back to cached data on failure
 * without crashing (mandatory per the Android skill).
 */
interface AppBlockingApi {

    @GET("api/v1/children/{childId}/apps/blocked")
    suspend fun getBlockedApps(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<AppBlockRuleDto>>>

    @POST("api/v1/children/{childId}/apps/block")
    suspend fun blockApp(
        @Path("childId") childId: String,
        @Body request: BlockAppRequest
    ): Response<ApiResponse<AppBlockRuleDto>>

    @DELETE("api/v1/children/{childId}/apps/block/{ruleId}")
    suspend fun unblockApp(
        @Path("childId") childId: String,
        @Path("ruleId") ruleId: String
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/children/{childId}/apps/unblock-request")
    suspend fun requestUnblock(
        @Path("childId") childId: String,
        @Body request: RequestUnblockRequest
    ): Response<ApiResponse<AppBlockRuleDto>>

    @GET("api/v1/children/{childId}/apps/unblock-requests")
    suspend fun getUnblockRequests(
        @Path("childId") childId: String
    ): Response<ApiResponse<List<AppBlockRuleDto>>>
}
