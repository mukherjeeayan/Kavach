package com.safeguard.parentalcontrol.di

import com.safeguard.parentalcontrol.data.remote.api.ParentalApi
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import com.safeguard.parentalcontrol.repository.phase1.Phase1RepositoryImpl
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

/**
 * Hilt module for the Phase 1 features (screen time, scheduled locks,
 * location, contacts).
 */
@Module
@InstallIn(SingletonComponent::class)
object Phase1Module {

    @Provides
    @Singleton
    fun provideParentalApi(retrofit: Retrofit): ParentalApi {
        return retrofit.create(ParentalApi::class.java)
    }

    @Provides
    @Singleton
    fun providePhase1Repository(
        api: ParentalApi,
        dao: com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao,
        contactDao: com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao,
        screenTimeDao: com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao,
        locationDao: com.safeguard.parentalcontrol.data.local.dao.LocationDao
    ): Phase1Repository {
        return Phase1RepositoryImpl(api, dao, contactDao, screenTimeDao, locationDao)
    }
}