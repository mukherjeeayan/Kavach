package com.safeguard.parentalcontrol.data.remote.api

import com.safeguard.parentalcontrol.data.remote.dto.ApiResponse
import com.safeguard.parentalcontrol.data.remote.dto.ChildDto
import com.safeguard.parentalcontrol.data.remote.dto.CreateChildRequest
import com.safeguard.parentalcontrol.data.remote.dto.ChildrenListResponse
import com.safeguard.parentalcontrol.data.remote.dto.CreateChildResponse
import com.safeguard.parentalcontrol.data.remote.dto.LoginRequest
import com.safeguard.parentalcontrol.data.remote.dto.LoginResponse
import com.safeguard.parentalcontrol.data.remote.dto.RefreshTokenRequest
import com.safeguard.parentalcontrol.data.remote.dto.RefreshTokenResponse
import com.safeguard.parentalcontrol.data.remote.dto.RegisterDeviceRequest
import com.safeguard.parentalcontrol.data.remote.dto.RegisterDeviceResponse
import com.safeguard.parentalcontrol.data.remote.dto.SetPinRequest
import com.safeguard.parentalcontrol.data.remote.dto.VerifyPinRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT

/**
 * Retrofit interface for auth and onboarding endpoints.  Same
 * Response<ApiResponse<T>> envelope convention as [AppBlockingApi].
 */
interface AuthApi {

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<ApiResponse<LoginResponse>>

    @POST("api/v1/auth/refresh-token")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<ApiResponse<RefreshTokenResponse>>

    @GET("api/v1/children")
    suspend fun listChildren(): Response<ApiResponse<ChildrenListResponse>>

    @POST("api/v1/children")
    suspend fun createChild(@Body request: CreateChildRequest): Response<ApiResponse<CreateChildResponse>>

    @POST("api/v1/devices/register")
    suspend fun registerDevice(@Body request: RegisterDeviceRequest): Response<ApiResponse<RegisterDeviceResponse>>

    /** Sets/rotates the parental unlock PIN (parent JWT required). */
    @PUT("api/v1/auth/pin")
    suspend fun setPin(@Body request: SetPinRequest): Response<ApiResponse<Unit>>

    /** Verifies the PIN against the stored hash (used by the dashboard). */
    @POST("api/v1/auth/pin/verify")
    suspend fun verifyPin(@Body request: VerifyPinRequest): Response<ApiResponse<Unit>>
}