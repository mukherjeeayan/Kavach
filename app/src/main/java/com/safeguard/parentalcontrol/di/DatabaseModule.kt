package com.safeguard.parentalcontrol.di

import androidx.room.Room
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
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

    /**
     * v1 -> v2: adds the Phase 1 tables (scheduled locks, contact rules,
     * daily screen-time aggregation and location entries). SQL matches
     * the backend migration 004 shapes (client stores local shadows).
     */
    private val MIGRATION_1_2 = object : Migration(1, 2) {
        override fun migrate(db: SupportSQLiteDatabase) {
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS scheduled_locks (
                    id TEXT NOT NULL PRIMARY KEY,
                    deviceId TEXT,
                    dayOfWeek INTEGER,
                    startTime TEXT NOT NULL,
                    endTime TEXT NOT NULL,
                    isActive INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS contact_rules (
                    id TEXT NOT NULL PRIMARY KEY,
                    phoneNumber TEXT NOT NULL,
                    contactName TEXT,
                    ruleType TEXT NOT NULL,
                    isActive INTEGER NOT NULL
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS screen_time_daily (
                    appPackage TEXT NOT NULL,
                    appCategory TEXT,
                    seconds INTEGER NOT NULL,
                    date TEXT NOT NULL,
                    PRIMARY KEY(date, appPackage)
                )
                """.trimIndent()
            )
            db.execSQL(
                """
                CREATE TABLE IF NOT EXISTS location_entries (
                    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                    latitude REAL NOT NULL,
                    longitude REAL NOT NULL,
                    accuracyM REAL,
                    speedKmh REAL,
                    recordedAt INTEGER NOT NULL,
                    synced INTEGER NOT NULL DEFAULT 0
                )
                """.trimIndent()
            )
        }
    }

    @Provides
    @Singleton
    fun provideDatabase(@ApplicationContext context: android.content.Context): SafeGuardDatabase {
        return Room.databaseBuilder(
            context,
            SafeGuardDatabase::class.java,
            "safeguard_db"
        ).addMigrations(MIGRATION_1_2)
            .fallbackToDestructiveMigration(false)
            .build()
    }

    @Provides
    fun provideAppBlockRuleDao(database: SafeGuardDatabase): AppBlockRuleDao {
        return database.appBlockRuleDao()
    }

    @Provides
    fun provideScheduledLockDao(database: SafeGuardDatabase): ScheduledLockDao {
        return database.scheduledLockDao()
    }

    @Provides
    fun provideContactRuleDao(database: SafeGuardDatabase): ContactRuleDao {
        return database.contactRuleDao()
    }

    @Provides
    fun provideScreenTimeDao(database: SafeGuardDatabase): ScreenTimeDao {
        return database.screenTimeDao()
    }

    @Provides
    fun provideLocationDao(database: SafeGuardDatabase): LocationDao {
        return database.locationDao()
    }
}