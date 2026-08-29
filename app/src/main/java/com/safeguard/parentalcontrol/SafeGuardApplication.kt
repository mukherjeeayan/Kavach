package com.safeguard.parentalcontrol

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.RealtimeRulesClient
import com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService
import com.safeguard.parentalcontrol.work.SyncScheduler
import dagger.hilt.android.HiltAndroidApp
import javax.inject.Inject

@HiltAndroidApp
class SafeGuardApplication : Application(), Configuration.Provider {

    @Inject
    lateinit var workerFactory: HiltWorkerFactory

    @Inject
    lateinit var onboardingStore: OnboardingStore

    @Inject
    lateinit var realtimeRulesClient: RealtimeRulesClient

    override fun onCreate() {
        super.onCreate()
        startEnforcement()
    }

    private fun startEnforcement() {
        if (!onboardingStore.isOnboarded()) {
            return
        }
        SafeGuardMessagingService.ensureChannel(this)
        SafeGuardMessagingService.syncToken(this)

        // Start foreground enforcement services
        SyncScheduler.startEnforcementService(this)
        SyncScheduler.startLocationTrackingService(this)
        SyncScheduler.startLocationService(this)

        // Schedule periodic background workers
        SyncScheduler.schedule(this)
        SyncScheduler.scheduleSyncQueue(this)
        SyncScheduler.scheduleSecurityScan(this)
        SyncScheduler.scheduleDeviceHealth(this)
        SyncScheduler.scheduleCommunicationSync(this)
        SyncScheduler.scheduleOnlyWork(this)
        SyncScheduler.scheduleDailyLimit(this)
        SyncScheduler.scheduleBedTime(this)
        SyncScheduler.schedulePickupReminder(this)

        // Start realtime rule push
        realtimeRulesClient.start()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()
}
