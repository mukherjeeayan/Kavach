package com.safeguard.parentalcontrol.di

import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.ParentPinStore
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.data.remote.api.AuthApi
import com.safeguard.parentalcontrol.repository.onboarding.OnboardingRepository
import com.safeguard.parentalcontrol.repository.onboarding.OnboardingRepositoryImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

/**
 * Hilt module for the parent-onboarding feature.
 * Binds the repository interface to its implementation and provides
 * the AuthApi Retrofit interface.
 */
@Module
@InstallIn(SingletonComponent::class)
object OnboardingModule {

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi {
        return retrofit.create(AuthApi::class.java)
    }

    @Provides
    @Singleton
    fun provideOnboardingRepository(
        api: AuthApi,
        tokenStore: TokenStore,
        onboardingStore: OnboardingStore,
        parentPinStore: ParentPinStore
    ): OnboardingRepository {
        return OnboardingRepositoryImpl(api, tokenStore, onboardingStore, parentPinStore)
    }
}