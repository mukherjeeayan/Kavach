package com.safeguard.parentalcontrol.service.location

/**
 * Simplified Kalman filter for smoothing noisy GPS readings.
 *
 * The filter reduces GPS drift by predicting the next position based
 * on the previous state and a process noise estimate. It is especially
 * effective at filtering out multipath interference indoors where
 * accuracy degrades from ±5m to ±200m.
 *
 * Reference: https://en.wikipedia.org/wiki/Kalman_filter
 */
class KalmanFilter(
    private val processNoise: Double = 1.0,
    private val measurementNoise: Double = 5.0
) {
    private var isInitialized = false
    private var latEstimate = 0.0
    private var lonEstimate = 0.0
    private var latErrorEstimate = 1.0
    private var lonErrorEstimate = 1.0

    /**
     * Update the filter with a new measurement.
     *
     * @param latitude  Measured latitude
     * @param longitude Measured longitude
     * @param accuracyM Measurement accuracy in meters (from GPS provider)
     * @return Filtered [latitude, longitude] pair
     */
    fun update(latitude: Double, longitude: Double, accuracyM: Double = measurementNoise): DoubleArray {
        if (!isInitialized) {
            latEstimate = latitude
            lonEstimate = longitude
            latErrorEstimate = accuracyM.coerceAtLeast(1.0)
            lonErrorEstimate = accuracyM.coerceAtLeast(1.0)
            isInitialized = true
            return doubleArrayOf(latitude, longitude)
        }

        // Kalman gain calculation
        val latGain = latErrorEstimate / (latErrorEstimate + accuracyM.coerceAtLeast(1.0))
        val lonGain = lonErrorEstimate / (lonErrorEstimate + accuracyM.coerceAtLeast(1.0))

        // Update estimate with measurement
        latEstimate += latGain * (latitude - latEstimate)
        lonEstimate += lonGain * (longitude - lonEstimate)

        // Update error estimates
        latErrorEstimate = (1.0 - latGain) * latErrorEstimate + processNoise
        lonErrorEstimate = (1.0 - lonGain) * lonErrorEstimate + processNoise

        return doubleArrayOf(latEstimate, lonEstimate)
    }

    /**
     * Reset the filter state (e.g., after a long period of no updates).
     */
    fun reset() {
        isInitialized = false
        latEstimate = 0.0
        lonEstimate = 0.0
        latErrorEstimate = 1.0
        lonErrorEstimate = 1.0
    }

    /**
     * Check if the filter has been initialized with at least one measurement.
     */
    val isReady: Boolean get() = isInitialized
}
