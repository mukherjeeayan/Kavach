package com.safeguard.parentalcontrol.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import androidx.room.TypeConverters
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.BehaviorPredictionDao
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import com.safeguard.parentalcontrol.data.local.dao.GeofenceDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.dao.SecurityScanDao
import com.safeguard.parentalcontrol.data.local.dao.SelfHarmAlertDao
import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import com.safeguard.parentalcontrol.data.local.dao.UrlFilterDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.BehaviorPredictionEntity
import com.safeguard.parentalcontrol.data.local.entity.ContactRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.GeofenceEntity
import com.safeguard.parentalcontrol.data.local.entity.IntegrationConfigEntity
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.data.local.entity.MoodLogEntity
import com.safeguard.parentalcontrol.data.local.entity.RewardPointsEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity
import com.safeguard.parentalcontrol.data.local.entity.SecurityScanEntity
import com.safeguard.parentalcontrol.data.local.entity.SelfHarmAlertEntity
import com.safeguard.parentalcontrol.data.local.entity.StringListConverter
import com.safeguard.parentalcontrol.data.local.entity.SyncQueueEntity
import com.safeguard.parentalcontrol.data.local.entity.UrlFilterEntity
import com.safeguard.parentalcontrol.data.local.entity.VoiceCommandEntity

@Database(
    entities = [
        AppBlockRuleEntity::class,
        ScreenTimeDailyEntity::class,
        ContactRuleEntity::class,
        LocationEntryEntity::class,
        UrlFilterEntity::class,
        GeofenceEntity::class,
        SyncQueueEntity::class,
        ScheduledLockEntity::class,
        MoodLogEntity::class,
        RewardPointsEntity::class,
        BehaviorPredictionEntity::class,
        SecurityScanEntity::class,
        SelfHarmAlertEntity::class,
        VoiceCommandEntity::class,
        IntegrationConfigEntity::class
    ],
    version = 6,
    exportSchema = false
)
@TypeConverters(StringListConverter::class)
abstract class SafeGuardDatabase : RoomDatabase() {
    abstract fun appBlockRuleDao(): AppBlockRuleDao
    abstract fun screenTimeDao(): ScreenTimeDao
    abstract fun contactRuleDao(): ContactRuleDao
    abstract fun locationDao(): LocationDao
    abstract fun urlFilterDao(): UrlFilterDao
    abstract fun geofenceDao(): GeofenceDao
    abstract fun syncQueueDao(): SyncQueueDao
    abstract fun scheduledLockDao(): ScheduledLockDao
    abstract fun securityScanDao(): SecurityScanDao
    abstract fun selfHarmAlertDao(): SelfHarmAlertDao
    abstract fun behaviorPredictionDao(): BehaviorPredictionDao
}
