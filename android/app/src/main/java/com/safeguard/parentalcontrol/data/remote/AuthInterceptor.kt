package com.safeguard.parentalcontrol.data.remote

import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.data.remote.api.AuthApi
import com.safeguard.parentalcontrol.data.remote.dto.RefreshTokenRequest
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import okhttp3.CertificatePinner
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.Interceptor
import okhttp3.Response
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit
import javax.inject.Inject

/**
 * Attaches the stored JWT to every API request and transparently
 * refreshes expired access tokens (the backend rotates refresh tokens,
 * so the new pair is stored on success).
 *
 * The refresh client is built without this interceptor to avoid an
 * infinite refresh loop on the refresh call itself. Certificate pinning
 * is handled centrally by NetworkModule — the refresh client reuses the
 * same OkHttpClient for consistency.
 */
class AuthInterceptor @Inject constructor(
    private val tokenStore: TokenStore
) : Interceptor {

    private val authApi: AuthApi by lazy {
        val clientBuilder = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)

        if (BuildConfig.CERT_PINNING_ENABLED) {
            clientBuilder.certificatePinner(buildCertificatePinner())
        }

        Retrofit.Builder()
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(clientBuilder.build())
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AuthApi::class.java)
    }

    private val refreshMutex = Mutex()

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
            // Serialize concurrent 401 handling: parallel refreshes would
            // rotate (and invalidate) each other's refresh tokens.
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

    /**
     * Synchronous token refresh using OkHttp's synchronous execute().
     * The mutex prevents concurrent refreshes from invalidating each other.
     */
    private fun refreshAccessToken(): Boolean = runBlocking {
        refreshMutex.withLock {
            val currentToken = tokenStore.refreshToken ?: return@withLock false
            return@withLock try {
                val response = authApi.refreshToken(RefreshTokenRequest(currentToken))
                val data = response.body()?.data
                if (response.isSuccessful && data != null) {
                    tokenStore.token = data.token
                    tokenStore.refreshToken = data.refresh_token
                    true
                } else {
                    tokenStore.clear()
                    false
                }
            } catch (e: Exception) {
                false
            }
        }
    }

    private fun isAuthEndpoint(path: String): Boolean =
        path.startsWith("api/v1/auth/")

    private fun buildCertificatePinner(): CertificatePinner {
        val pins = BuildConfig.CERT_PINS
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        check(pins.isNotEmpty()) {
            "Release build has certificate pinning enabled but no pins."
        }
        val host = BuildConfig.API_BASE_URL.toHttpUrl().host
        return CertificatePinner.Builder()
            .add(host, *pins.toTypedArray())
            .build()
    }

    companion object {
        private const val RETRY_HEADER = "X-Kavach-Retry"
    }
}