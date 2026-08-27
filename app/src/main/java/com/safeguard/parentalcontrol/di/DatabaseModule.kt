package com.safeguard.parentalcontrol.di

import android.content.Context
import androidx.room.Room
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.dao.GeofenceDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import com.safeguard.parentalcontrol.data.local.dao.UrlFilterDao
import com.safeguard.parentalcontrol.data.local.db.EncryptedDatabase
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
        val factory = EncryptedDatabase.createFactory(context)
        return Room.databaseBuilder(
            context,
            SafeGuardDatabase::class.java,
            "safeguard_database"
        )
            .openHelperFactory(factory)
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides fun provideAppBlockRuleDao(db: SafeGuardDatabase): AppBlockRuleDao = db.appBlockRuleDao()
    @Provides fun provideScreenTimeDao(db: SafeGuardDatabase): ScreenTimeDao = db.screenTimeDao()
    @Provides fun provideContactRuleDao(db: SafeGuardDatabase): ContactRuleDao = db.contactRuleDao()
    @Provides fun provideLocationDao(db: SafeGuardDatabase): LocationDao = db.locationDao()
    @Provides fun provideUrlFilterDao(db: SafeGuardDatabase): UrlFilterDao = db.urlFilterDao()
    @Provides fun provideGeofenceDao(db: SafeGuardDatabase): GeofenceDao = db.geofenceDao()
    @Provides fun provideSyncQueueDao(db: SafeGuardDatabase): SyncQueueDao = db.syncQueueDao()
    @Provides fun provideScheduledLockDao(db: SafeGuardDatabase): ScheduledLockDao = db.scheduledLockDao()
}
