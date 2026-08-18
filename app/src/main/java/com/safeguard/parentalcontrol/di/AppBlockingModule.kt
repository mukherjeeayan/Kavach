package com.safeguard.parentalcontrol.di

import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.remote.api.AppBlockingApi
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepositoryImpl
import com.safeguard.parentalcontrol.security.TamperState
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import retrofit2.Retrofit
import javax.inject.Singleton

/**
 * Hilt module for the App Blocking feature.
 * Binds the repository interface to its implementation and provides
 * the Retrofit API interface.
 */
@Module
@InstallIn(SingletonComponent::class)
object AppBlockingModule {

    @Provides
    @Singleton
    fun provideAppBlockingApi(retrofit: Retrofit): AppBlockingApi {
        return retrofit.create(AppBlockingApi::class.java)
    }

    @Provides
    @Singleton
    fun provideAppBlockingRepository(
        dao: AppBlockRuleDao,
        api: AppBlockingApi,
        tamperState: TamperState
    ): AppBlockingRepository {
        return AppBlockingRepositoryImpl(dao, api, tamperState)
    }
}
