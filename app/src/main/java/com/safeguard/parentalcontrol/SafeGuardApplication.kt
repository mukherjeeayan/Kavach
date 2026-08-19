package com.safeguard.parentalcontrol

import android.app.Application
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.RealtimeRulesClient
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
        // Initialize Timber, Analytics, and Crashlytics here if applicable (excluding debug environments)
        startEnforcement()
    }

    private fun startEnforcement() {
        // Enforcement and sync only make sense after the parent
        // completed onboarding (real device + child IDs exist).
        if (!onboardingStore.isOnboarded()) {
            return
        }
        // Start the foreground enforcement/location services, the
        // periodic sync, and the realtime rule push on every app
        // launch (boot is handled by BootReceiver).
        SyncScheduler.startEnforcementService(this)
        SyncScheduler.startLocationService(this)
        SyncScheduler.schedule(this)
        realtimeRulesClient.start()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setWorkerFactory(workerFactory)
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()
}
