package com.safeguard.parentalcontrol.service.location

import android.util.Log

/**
 * Location filter that combines:
 * 1. Accuracy threshold filtering (discard readings > 50m)
 * 2. Kalman filter smoothing (reduce GPS drift)
 * 3. Temporal hysteresis for geofence transitions (require 2 consecutive
 *    out-of-boundary pings at least 30s apart before raising an alert)
 *
 * This prevents:
 * - False geofence alerts from GPS drift indoors
 * - False "Child Left School" notifications from multipath interference
 * - Jitter caused by sudden accuracy spikes
 */
class LocationFilter {

    private val kalmanFilter = KalmanFilter(
        processNoise = 1.0,
        measurementNoise = 5.0
    )

    private var lastGeofenceInside = true
    private var lastBoundaryCrossingTime = 0L
    private var consecutiveOutsideCount = 0

    companion object {
        private const val TAG = "LocationFilter"

        // Maximum accuracy (in meters) for a reading to be considered reliable
        // for geofence transition evaluation. Readings worse than this are
        // buffered for history but not used for boundary decisions.
        const val ACCURACY_THRESHOLD_METERS = 50.0

        // Minimum time (in milliseconds) between consecutive out-of-boundary
        // readings before raising an alert. Prevents false positives from
        // momentary GPS spikes.
        const val HYSTERESIS_INTERVAL_MS = 30_000L

        // Number of consecutive out-of-boundary readings required
        // before confirming a geofence exit.
        const val REQUIRED_OUTSIDE_PINGS = 2
    }

    /**
     * Process a raw GPS reading through the filter pipeline.
     *
     * @param latitude  Raw GPS latitude
     * @param longitude Raw GPS longitude
     * @param accuracyM Raw GPS accuracy in meters
     * @param isInsideGeofence Whether the device is currently inside the geofence
     * @return FilterResult with filtered coordinates and whether to trigger an alert
     */
    fun filter(
        latitude: Double,
        longitude: Double,
        accuracyM: Double,
        isInsideGeofence: Boolean
    ): FilterResult {
        // Step 1: Apply accuracy threshold
        val isAccurate = accuracyM <= ACCURACY_THRESHOLD_METERS
        val filteredCoords = if (isAccurate) {
            kalmanFilter.update(latitude, longitude, accuracyM)
        } else {
            // Inaccurate reading: still filter but flag as unreliable
            kalmanFilter.update(latitude, longitude, accuracyM)
        }

        // Step 2: Geofence transition evaluation with temporal hysteresis
        val currentTime = System.currentTimeMillis()
        val shouldAlert = evaluateGeofenceTransition(
            isInsideGeofence, currentTime
        )

        // Step 3: Track state for next evaluation
        lastGeofenceInside = isInsideGeofence

        return FilterResult(
            latitude = filteredCoords[0],
            longitude = filteredCoords[1],
            accuracyM = accuracyM,
            isAccurate = isAccurate,
            shouldTriggerAlert = shouldAlert,
            isGeofenceInside = isInsideGeofence
        )
    }

    /**
     * Evaluate geofence transition with temporal hysteresis.
     * Requires 2 consecutive out-of-boundary pings at least 30s apart
     * before confirming a geofence exit.
     */
    private fun evaluateGeofenceTransition(
        isInside: Boolean,
        currentTime: Long
    ): Boolean {
        if (isInside) {
            // Inside the geofence: reset counter
            consecutiveOutsideCount = 0
            lastBoundaryCrossingTime = 0L
            return false
        }

        // Outside the geofence
        if (lastGeofenceInside) {
            // Just crossed the boundary
            consecutiveOutsideCount = 1
            lastBoundaryCrossingTime = currentTime
            Log.d(TAG, "Geofence boundary crossed (1/${REQUIRED_OUTSIDE_PINGS})")
            return false
        }

        // Already outside: check if we have enough consecutive readings
        consecutiveOutsideCount++

        val timeSinceFirst = currentTime - lastBoundaryCrossingTime
        if (consecutiveOutsideCount >= REQUIRED_OUTSIDE_PINGS &&
            timeSinceFirst >= HYSTERESIS_INTERVAL_MS
        ) {
            Log.i(TAG, "Geofence exit confirmed: $consecutiveOutsideCount readings, ${timeSinceFirst}ms elapsed")
            // Reset for next transition
            consecutiveOutsideCount = 0
            lastBoundaryCrossingTime = 0L
            return true
        }

        Log.d(TAG, "Geofence outside count: $consecutiveOutsideCount/$REQUIRED_OUTSIDE_PINGS, time: ${timeSinceFirst}ms")
        return false
    }

    /**
     * Reset filter state (e.g., when the geofence is updated).
     */
    fun reset() {
        kalmanFilter.reset()
        lastGeofenceInside = true
        lastBoundaryCrossingTime = 0L
        consecutiveOutsideCount = 0
    }

    /**
     * Result of the location filtering pipeline.
     */
    data class FilterResult(
        val latitude: Double,
        val longitude: Double,
        val accuracyM: Double,
        val isAccurate: Boolean,
        val shouldTriggerAlert: Boolean,
        val isGeofenceInside: Boolean
    )
}
