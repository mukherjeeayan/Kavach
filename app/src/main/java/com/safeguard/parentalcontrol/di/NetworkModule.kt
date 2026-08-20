package com.safeguard.parentalcontrol.di

import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.remote.AuthInterceptor
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import okhttp3.CertificatePinner
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
        if (!BuildConfig.DEBUG) {
            builder.certificatePinner(
                CertificatePinner.Builder()
                    .add(
                        PINNED_HOST,
                        // TODO(ops): replace with the SHA-256 of the
                        // production leaf/intermediate cert, e.g.
                        // "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
                        // (run `keytool -printcert -jarfile app.aab` on
                        //  the deployed cert, or use the CA intermediate).
                        "sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
                    )
                    .build()
            )
        }
        return builder.build()
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

    /**
     * Host pattern pinned in release builds. Keep in sync with the
     * release [BuildConfig.API_BASE_URL] host — a mismatch would
     * silently disable the pin (CertificatePinner only matches
     * configured hosts).
     */
    private const val PINNED_HOST = "api.kavach.example.com"
}