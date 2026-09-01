package com.safeguard.parentalcontrol.service.contacts

import android.telecom.Call
import android.telecom.CallScreeningService
import android.telecom.CallScreeningService.CallResponse
import android.util.Log
import com.safeguard.parentalcontrol.data.local.dao.ContactRuleDao
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Rejects incoming calls from numbers matching the parent's BLOCK
 * rules. Rules live in Room (server-synced), so screening works
 * offline. Allow rules are implicit — anything not blocked passes.
 *
 * The system grants the call-screening role; on API < 29 this
 * service is never invoked.
 */
@AndroidEntryPoint
class CallScreeningService : CallScreeningService() {

    @Inject
    lateinit var contactRuleDao: ContactRuleDao

    private val serviceScope = CoroutineScope(Dispatchers.Default + SupervisorJob())

    @Volatile
    private var blockedNumbers: Set<String> = emptySet()

    override fun onCreate() {
        super.onCreate()
        serviceScope.launch {
            contactRuleDao.getActiveBlocks().collect { rules ->
                blockedNumbers = rules
                    .map { normalize(it.phoneNumber) }
                    .filter { it.isNotEmpty() }
                    .toSet()
            }
        }
    }

    override fun onScreenCall(details: Call.Details) {
        val number = normalize(details.handle?.schemeSpecificPart ?: "")
        if (number.isEmpty()) {
            respondToCall(details, CallResponse.Builder().build())
            return
        }

        val blocked = blockedNumbers.any { blocked ->
            // Match the full normalized number or its last 7 digits
            // (handles +91/international-prefix variations).
            blocked == number ||
                (number.length >= 7 && blocked.endsWith(number.takeLast(7)))
        }

        if (blocked) {
            Log.i(TAG, "Rejecting call from $number (parent BLOCK rule)")
            respondToCall(
                details,
                CallResponse.Builder()
                    .setDisallowCall(true)
                    .setRejectCall(true)
                    .setSkipCallLog(true)
                    .setSkipNotification(true)
                    .build()
            )
        } else {
            respondToCall(details, CallResponse.Builder().build())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        (serviceScope.coroutineContext[Job])?.cancel()
    }

    private fun normalize(raw: String): String =
        raw.filter(Char::isDigit)

    companion object {
        private const val TAG = "CallScreening"
    }
}
