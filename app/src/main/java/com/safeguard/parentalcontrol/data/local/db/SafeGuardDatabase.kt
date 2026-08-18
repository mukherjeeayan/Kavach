package com.safeguard.parentalcontrol.data.local.db

import androidx.room.Database
import androidx.room.RoomDatabase
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity

@Database(
    entities = [AppBlockRuleEntity::class],
    version = 1,
    exportSchema = false
)
abstract class SafeGuardDatabase : RoomDatabase() {
    abstract fun appBlockRuleDao(): AppBlockRuleDao
}
