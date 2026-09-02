package com.safeguard.parentalcontrol.service.usage

import android.os.SystemClock
import android.util.Log
import java.util.concurrent.atomic.AtomicLong
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Time tracking service that uses the hardware monotonic clock
 * (elapsedRealtimeNanos) instead of System.currentTimeMillis().
 *
 * This prevents children from bypassing screen time limits by
 * adjusting the system clock backward in Android settings:
 *   Settings > Date & Time > Set Automatically: OFF
 *
 * elapsedRealtimeNanos is:
 * - Initialized at device boot
 * - Cannot be modified by changing system time
 * - Pauses during deep sleep (Doze mode)
 * - Only resets on device reboot
 *
 * The service tracks accumulated usage time across app foreground
 * transitions and checks against the daily quota.
 */
@Singleton
class TimeTrackingService @Inject constructor() {

    private val lastRecordedBootTime = AtomicLong(SystemClock.elapsedRealtimeNanos())
    private val accumulatedUsageMillis = AtomicLong(0L)
    private var dailyQuotaMillis = 0L
    private var isTracking = false

    /**
     * Start tracking usage time. Call when the child's screen turns on
     * or an app enters the foreground.
     */
    fun startTracking() {
        lastRecordedBootTime.set(SystemClock.elapsedRealtimeNanos())
        isTracking = true
        Log.d(TAG, "Time tracking started")
    }

    /**
     * Stop tracking usage time. Call when the child's screen turns off
     * or the app enters the background.
     */
    fun stopTracking() {
        if (!isTracking) return
        val delta = computeDeltaMillis()
        accumulatedUsageMillis.addAndGet(delta)
        isTracking = false
        Log.d(TAG, "Time tracking stopped, delta: ${delta}ms, total: ${accumulatedUsageMillis.get()}ms")
    }

    /**
     * Register a usage delta and check against the daily quota.
     * Uses the monotonic hardware clock to prevent time manipulation.
     *
     * @param quotaMillis The daily screen time quota in milliseconds
     * @return true if the quota has been exceeded, false otherwise
     */
    fun registerUsageDelta(quotaMillis: Long): Boolean {
        dailyQuotaMillis = quotaMillis
        val delta = computeDeltaMillis()
        accumulatedUsageMillis.addAndGet(delta)
        val total = accumulatedUsageMillis.get()

        Log.d(TAG, "Usage delta: ${delta}ms, total: ${total}ms, quota: ${quotaMillis}ms")

        return total >= quotaMillis
    }

    /**
     * Check if the daily quota has been exceeded without updating the timer.
     */
    fun isQuotaExceeded(): Boolean {
        val total = accumulatedUsageMillis.get()
        return dailyQuotaMillis > 0 && total >= dailyQuotaMillis
    }

    /**
     * Get the current accumulated usage in milliseconds.
     */
    fun getAccumulatedUsageMillis(): Long {
        return accumulatedUsageMillis.get()
    }

    /**
     * Get remaining time in the daily quota.
     * Returns 0 if quota is already exceeded.
     */
    fun getRemainingMillis(): Long {
        if (dailyQuotaMillis <= 0) return Long.MAX_VALUE
        val remaining = dailyQuotaMillis - accumulatedUsageMillis.get()
        return maxOf(0, remaining)
    }

    /**
     * Reset the daily counter. Call at midnight or when a new day starts.
     */
    fun resetDailyCounter() {
        accumulatedUsageMillis.set(0L)
        lastRecordedBootTime.set(SystemClock.elapsedRealtimeNanos())
        Log.i(TAG, "Daily counter reset")
    }

    /**
     * Compute the delta in milliseconds since the last recorded boot time.
     * Uses elapsedRealtimeNanos which cannot be manipulated by changing
     * the system clock.
     */
    private fun computeDeltaMillis(): Long {
        val currentBootTime = SystemClock.elapsedRealtimeNanos()
        val lastBootTime = lastRecordedBootTime.getAndSet(currentBootTime)
        val deltaNanos = currentBootTime - lastBootTime
        // Convert nanoseconds to milliseconds, ensuring non-negative
        return maxOf(0, deltaNanos / 1_000_000)
    }

    companion object {
        private const val TAG = "TimeTrackingService"
    }
}
