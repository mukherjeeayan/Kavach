package com.safeguard.parentalcontrol.di

import android.content.Context
import androidx.room.Room
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.db.SafeGuardDatabase
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: Context): SafeGuardDatabase {
        return Room.databaseBuilder(
            context,
            SafeGuardDatabase::class.java,
            "safeguard_db"
        ).build()
    }

    @Provides
    fun provideAppBlockRuleDao(database: SafeGuardDatabase): AppBlockRuleDao {
        return database.appBlockRuleDao()
    }
}
