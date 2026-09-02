package com.safeguard.parentalcontrol.di

import com.safeguard.parentalcontrol.data.remote.api.ParentPhase2Api
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import com.safeguard.parentalcontrol.repository.phase2.Phase2RepositoryImpl
import com.safeguard.parentalcontrol.service.sos.SmsFallbackService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object Phase2Module {

    @Provides
    @Singleton
    fun providePhase2Api(retrofit: Retrofit): Phase2Api {
        return retrofit.create(Phase2Api::class.java)
    }

    @Provides
    @Singleton
    fun provideParentPhase2Api(retrofit: Retrofit): ParentPhase2Api {
        return retrofit.create(ParentPhase2Api::class.java)
    }

    @Provides
    @Singleton
    fun providePhase2Repository(
        api: Phase2Api,
        onboardingStore: com.safeguard.parentalcontrol.data.local.OnboardingStore,
        urlFilterDao: com.safeguard.parentalcontrol.data.local.dao.UrlFilterDao,
        geofenceDao: com.safeguard.parentalcontrol.data.local.dao.GeofenceDao,
        smsFallbackService: SmsFallbackService
    ): Phase2Repository {
        return Phase2RepositoryImpl(api, onboardingStore, urlFilterDao, geofenceDao, smsFallbackService)
    }
}
