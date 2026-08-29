package com.safeguard.parentalcontrol.work

import android.content.Context
import android.content.Intent
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.safeguard.parentalcontrol.service.appblock.AppBlockingService
import com.safeguard.parentalcontrol.service.geofencing.GeofenceService
import com.safeguard.parentalcontrol.service.location.LocationService
import java.util.concurrent.TimeUnit

object SyncScheduler {

    fun startEnforcementService(context: Context) {
        val intent = Intent(context, AppBlockingService::class.java)
        context.startForegroundService(intent)
    }

    fun startLocationService(context: Context) {
        val intent = Intent(context, GeofenceService::class.java)
        context.startForegroundService(intent)
    }

    fun startLocationTrackingService(context: Context) {
        val intent = Intent(context, LocationService::class.java)
        context.startForegroundService(intent)
    }

    fun schedule(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<SyncRulesWorker>(15, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "sync_rules_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleSyncQueue(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<SyncQueueWorker>(5, TimeUnit.MINUTES)
            .setConstraints(
                Constraints.Builder()
                    .setRequiredNetworkType(NetworkType.CONNECTED)
                    .build()
            )
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "sync_queue_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleSecurityScan(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<SecurityScanWorker>(12, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "security_scan_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleDeviceHealth(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<DeviceHealthWorker>(6, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "device_health_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleCommunicationSync(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<CommunicationSyncWorker>(1, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "communication_sync_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleOnlyWork(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<OnlyWorkWorker>(15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "only_work_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleDailyLimit(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<DailyLimitWorker>(15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "daily_limit_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun scheduleBedTime(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<BedTimeWorker>(15, TimeUnit.MINUTES)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "bedtime_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }

    fun schedulePickupReminder(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<PickupReminderWorker>(1, TimeUnit.HOURS)
            .build()
        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            "pickup_reminder_work",
            ExistingPeriodicWorkPolicy.KEEP,
            workRequest
        )
    }
}
