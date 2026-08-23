package com.safeguard.parentalcontrol.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity

/**
 * Room database for SafeGuard local persistence.
 *
 * Version history:
 * 1 — Initial: app_block_rules
 * 2 — Added: scheduled_locks, contact_rules, screen_time_daily, location_entries
 * 3 — Added: daily_limit_minutes column to app_block_rules
 *
 * Schema exported to `$projectDir/schemas` for migration testing.
 */
@Database(
    entities = [
        AppBlockRuleEntity::class,
        ScheduledLockEntity::class,
        ContactRuleEntity::class,
        ScreenTimeDailyEntity::class,
        LocationEntryEntity::class
    ],
    version = 3,
    exportSchema = true
)
abstract class SafeGuardDatabase : RoomDatabase() {
    abstract fun appBlockRuleDao(): AppBlockRuleDao
    abstract fun scheduledLockDao(): ScheduledLockDao
    abstract fun contactRuleDao(): ContactRuleDao
    abstract fun screenTimeDao(): ScreenTimeDao
    abstract fun locationDao(): LocationDao
}