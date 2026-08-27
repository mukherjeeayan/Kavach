package com.safeguard.parentalcontrol.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.remote.RealtimeRulesClient
import com.safeguard.parentalcontrol.work.SyncScheduler
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class BootReceiver : BroadcastReceiver() {

    @Inject
    lateinit var onboardingStore: OnboardingStore

    @Inject
    lateinit var realtimeRulesClient: RealtimeRulesClient

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED && onboardingStore.isOnboarded()) {
            try {
                SyncScheduler.startEnforcementService(context)
            } catch (e: Exception) {
                Log.w("BootReceiver", "Failed to start enforcement service", e)
            }
            try {
                SyncScheduler.startLocationService(context)
            } catch (e: Exception) {
                Log.w("BootReceiver", "Failed to start location service", e)
            }
            try {
                SyncScheduler.schedule(context)
            } catch (e: Exception) {
                Log.w("BootReceiver", "Failed to schedule sync", e)
            }
            try {
                realtimeRulesClient.start()
            } catch (e: Exception) {
                Log.w("BootReceiver", "Failed to start realtime client", e)
            }
        }
    }
}
