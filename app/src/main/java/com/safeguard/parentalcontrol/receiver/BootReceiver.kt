package com.safeguard.parentalcontrol.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.safeguard.parentalcontrol.work.SyncScheduler

/**
 * Restarts enforcement and the periodic rules sync after a reboot —
 * otherwise the child could simply power-cycle the device to escape
 * app blocking.
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            SyncScheduler.startEnforcementService(context)
            SyncScheduler.schedule(context)
        }
    }
}