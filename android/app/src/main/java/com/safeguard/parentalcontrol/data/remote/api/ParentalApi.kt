package com.safeguard.parentalcontrol.data.remote.api

import com.safeguard.parentalcontrol.data.remote.dto.AdminStatusRequest
import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.FcmTokenRequest
import com.safeguard.parentalcontrol.data.remote.dto.ContactInput
import com.safeguard.parentalcontrol.data.remote.dto.ContactRuleDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationDto
import com.safeguard.parentalcontrol.data.remote.dto.LocationUploadRequest
import com.safeguard.parentalcontrol.data.remote.dto.LockInput
import com.safeguard.parentalcontrol.data.remote.dto.ScheduledLockDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeRowDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeSummaryDto
import com.safeguard.parentalcontrol.data.remote.dto.ScreenTimeUploadEntry
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Retrofit interface for the Phase 1 features:
 * screen time, scheduled locks, location and contacts.
 * Endpoints mirror the backend mounts:
 * /api/v1/children/:childId/... and /api/v1/devices/:deviceId/...
 */
interface ParentalApi {

    // ── Scheduled locks ────────────────────────────────────────────

    @GET("api/v1/children/{childId}/locks")
    suspend fun listLocks(
        @Path("childId") childId: String
    ): Response<ApiResponse<LocksPayload>>

    @POST("api/v1/children/{childId}/locks")
    suspend fun createLock(
        @Path("childId") childId: String,
        @Body input: LockInput
    ): Response<ApiResponse<ScheduledLockDto>>

    @PUT("api/v1/children/{childId}/locks/{lockId}")
    suspend fun updateLock(
        @Path("childId") childId: String,
        @Path("lockId") lockId: String,
        @Body input: LockInput
    ): Response<ApiResponse<ScheduledLockDto>>

    @DELETE("api/v1/children/{childId}/locks/{lockId}")
    suspend fun deleteLock(
        @Path("childId") childId: String,
        @Path("lockId") lockId: String
    ): Response<ApiResponse<Unit>>

    // ── Contacts ───────────────────────────────────────────────────

    @GET("api/v1/children/{childId}/contacts")
    suspend fun listContacts(
        @Path("childId") childId: String
    ): Response<ApiResponse<ContactsPayload>>

    @POST("api/v1/children/{childId}/contacts")
    suspend fun createContact(
        @Path("childId") childId: String,
        @Body input: ContactInput
    ): Response<ApiResponse<ContactRuleDto>>

    @PUT("api/v1/children/{childId}/contacts/{contactId}")
    suspend fun updateContact(
        @Path("childId") childId: String,
        @Path("contactId") contactId: String,
        @Body input: ContactInput
    ): Response<ApiResponse<ContactRuleDto>>

    @DELETE("api/v1/children/{childId}/contacts/{contactId}")
    suspend fun deleteContact(
        @Path("childId") childId: String,
        @Path("contactId") contactId: String
    ): Response<ApiResponse<Unit>>

    // ── Screen time ────────────────────────────────────────────────

    @GET("api/v1/children/{childId}/screen-time")
    suspend fun getDailyScreenTime(
        @Path("childId") childId: String,
        @Query("date") date: String
    ): Response<ApiResponse<List<ScreenTimeRowDto>>>

    @GET("api/v1/children/{childId}/screen-time/summary")
    suspend fun getScreenTimeSummary(
        @Path("childId") childId: String,
        @Query("range") range: String
    ): Response<ApiResponse<ScreenTimeSummaryDto>>

    @POST("api/v1/devices/{deviceId}/screen-time")
    suspend fun uploadScreenTime(
        @Path("deviceId") deviceId: String,
        @Body body: ScreenTimeUploadBody
    ): Response<ApiResponse<Unit>>

    // ── Location ───────────────────────────────────────────────────

    @POST("api/v1/devices/{deviceId}/location")
    suspend fun uploadLocation(
        @Path("deviceId") deviceId: String,
        @Body request: LocationUploadRequest
    ): Response<ApiResponse<Unit>>

    @POST("api/v1/devices/{deviceId}/location/batch")
    suspend fun uploadLocationBatch(
        @Path("deviceId") deviceId: String,
        @Body request: List<LocationUploadRequest>
    ): Response<ApiResponse<Unit>>

    // ── Device admin status ─────────────────────────────────────────

    @PUT("api/v1/devices/{deviceId}/admin-status")
    suspend fun reportAdminStatus(
        @Path("deviceId") deviceId: String,
        @Body body: AdminStatusRequest
    ): Response<ApiResponse<Unit>>

    @PUT("api/v1/devices/{deviceId}/fcm-token")
    suspend fun reportFcmToken(
        @Path("deviceId") deviceId: String,
        @Body body: FcmTokenRequest
    ): Response<ApiResponse<Unit>>

    @GET("api/v1/children/{childId}/locations/current")
    suspend fun getCurrentLocations(
        @Path("childId") childId: String
    ): Response<ApiResponse<LocationPayload>>

    @GET("api/v1/children/{childId}/locations/history")
    suspend fun getLocationHistory(
        @Path("childId") childId: String,
        @Query("limit") limit: Int = 100
    ): Response<ApiResponse<LocationPayload>>

    // ── Payload wrappers ───────────────────────────────────────────

    data class LocksPayload(val locks: List<ScheduledLockDto>)
    data class ContactsPayload(val contacts: List<ContactRuleDto>)
    data class LocationPayload(val locations: List<LocationDto>)
    data class ScreenTimeUploadBody(val entries: List<ScreenTimeUploadEntry>)
}