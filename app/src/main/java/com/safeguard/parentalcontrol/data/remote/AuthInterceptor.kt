package com.safeguard.parentalcontrol.data.remote

import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.data.remote.api.AuthApi
import com.safeguard.parentalcontrol.data.remote.dto.RefreshTokenRequest
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Inject

/**
 * Attaches the stored JWT to every API request and transparently
 * refreshes expired access tokens (the backend rotates refresh tokens,
 * so the new pair is stored on success).
 *
 * The refresh client is built without this interceptor to avoid an
 * infinite refresh loop on the refresh call itself.
 */
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore
) : Interceptor {

    private val authApi: AuthApi by lazy {
        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(OkHttpClient.Builder().build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }

    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()

        if (isAuthEndpoint(request.url.encodedPath)) {
            return chain.proceed(request)
        }

        val token = tokenStore.token
        val authenticated = if (!token.isNullOrEmpty()) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }

        val response = chain.proceed(authenticated)

        if (response.code == 401 && request.header(RETRY_HEADER) == null) {
            response.close()
            if (refreshAccessToken()) {
                val retried = request.newBuilder()
                    .header("Authorization", "Bearer ${tokenStore.token}")
                    .header(RETRY_HEADER, "true")
                    .build()
                return chain.proceed(retried)
            }
        }
        return response
    }

    private fun refreshAccessToken(): Boolean {
        val refreshToken = tokenStore.refreshToken ?: return false
        return try {
            val response = runBlocking {
                authApi.refreshToken(RefreshTokenRequest(refreshToken))
            }
            val data = response.body()?.data
            if (response.isSuccessful && data != null) {
                tokenStore.token = data.token
                tokenStore.refreshToken = data.refresh_token
                true
            } else {
                // The refresh token is dead — force a fresh login.
                tokenStore.clear()
                false
            }
        } catch (e: Exception) {
            // Offline: the original request 401'd anyway.
            false
        }
    }

    private fun isAuthEndpoint(path: String): Boolean =
        path.startsWith("api/v1/auth/")

    companion object {
        private const val RETRY_HEADER = "X-Kavach-Retry"
    }
}