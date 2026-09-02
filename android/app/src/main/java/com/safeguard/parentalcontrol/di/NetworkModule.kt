package com.safeguard.parentalcontrol.di

import android.content.Context
import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.remote.AuthInterceptor
import com.safeguard.parentalcontrol.security.SecureMasterKey
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.CertificatePinner
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideMasterKey(@ApplicationContext context: Context): MasterKey {
        return SecureMasterKey.build(context)
    }

    @Provides
    @Singleton
    fun provideLoggingInterceptor(): HttpLoggingInterceptor {
        return HttpLoggingInterceptor().apply {
            // Full bodies only in debug builds — release must not log
            // credentials or tokens to logcat.
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.BASIC
            }
        }
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(
        loggingInterceptor: HttpLoggingInterceptor,
        authInterceptor: AuthInterceptor
    ): OkHttpClient {
        val builder = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            // Explicit timeouts: mobile networks are slow and flaky, and
            // the default 10s connect / 10s read is too tight for
            // multi-day offline buffers uploading in one burst.
            .connectTimeout(15, java.util.concurrent.TimeUnit.SECONDS)
            .readTimeout(30, java.util.concurrent.TimeUnit.SECONDS)
            .writeTimeout(30, java.util.concurrent.TimeUnit.SECONDS)

        // Certificate pinning (security skill): release builds pin the
        // production API certificate. Debug builds connect to a local
        // backend (10.0.2.2) whose cert changes constantly, so pinning
        // there would break development — never do that.
        if (BuildConfig.CERT_PINNING_ENABLED) {
            builder.certificatePinner(buildCertificatePinner())
        }
        return builder.build()
    }

    /**
     * Builds the pinner from BuildConfig.CERT_PINS (comma-separated
     * "sha256/..." hashes supplied via -PSAFEGUARD_PINS).
     *
     * Fail-closed: a release build without pins refuses to start
     * instead of silently running unpinned. The pinned host is derived
     * from BuildConfig.API_BASE_URL so the pin can never drift from
     * the host it protects.
     */
    private fun buildCertificatePinner(): CertificatePinner {
        val pins = BuildConfig.CERT_PINS
            .split(",")
            .map { it.trim() }
            .filter { it.isNotEmpty() }
        check(pins.isNotEmpty()) {
            "Release build has certificate pinning enabled but no pins. " +
                "Supply them via -PSAFEGUARD_PINS=\"sha256/...,sha256/...\"."
        }

        val host = BuildConfig.API_BASE_URL.toHttpUrl().host
        return CertificatePinner.Builder()
            .add(host, *pins.toTypedArray())
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            // Per-build-type URL from BuildConfig (debug: local backend,
            // release: production). Never a hardcoded placeholder domain.
            .baseUrl(BuildConfig.API_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }
}