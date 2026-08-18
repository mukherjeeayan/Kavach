package com.safeguard.parentalcontrol.work

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.safeguard.parentalcontrol.service.appblock.AppBlockingService
import java.util.concurrent.TimeUnit

/**
 * Central entry points for starting the enforcement service and the
 * periodic rules sync. Called on app launch and on BOOT_COMPLETED.
 */
object SyncScheduler {

    private const val SYNC_WORK_NAME = "rules_sync_worker"
    // WorkManager platform minimum for periodic work is 15 minutes;
    // the MVP spec asked for 5 minutes, which the platform disallows
    // for PeriodicWorkRequest.
    private const val SYNC_INTERVAL_MINUTES = 15L

    fun startEnforcementService(context: Context) {
        val intent = Intent(context, AppBlockingService::class.java)
        ContextCompat.startForegroundService(context, intent)
    }

    fun schedule(context: Context) {
        val request = PeriodicWorkRequestBuilder<SyncRulesWorker>(SYNC_INTERVAL_MINUTES, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            SYNC_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            request
        )
    }
}