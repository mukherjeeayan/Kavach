package com.safeguard.parentalcontrol.security

import java.util.concurrent.TimeUnit
import kotlin.math.max
import kotlin.math.min

/**
 * Rule-based behaviour predictor. Consumes a window of
 * [BehaviorEvent]s and produces a 0–100 risk score with
 * contributing factors and recommendations. No ML is used — the
 * intent is to surface obvious, explainable patterns for the
 * parent dashboard.
 */
object BehaviorPredictor {

    private const val TAG = "BehaviorPredictor"

    /**
     * Analyze [recentEvents] for [childId] and return a prediction.
     *
     * @param childId      the child this prediction is for (used in
     *                     logging only; results are stateless w.r.t. id)
     * @param recentEvents events ordered by [BehaviorEvent.timestamp]
     *                     ascending; older events may be ignored
     */
    fun predictBehavior(
        childId: String,
        recentEvents: List<BehaviorEvent>
    ): BehaviorPrediction {
        if (recentEvents.isEmpty()) {
            return BehaviorPrediction(
                riskScore = 0,
                riskLevel = RiskLevel.LOW,
                contributingFactors = emptyList(),
                recommendations = listOf("Not enough data yet — keep using the device to build a baseline."),
                dataWindowDays = 0
            )
        }

        val sorted = recentEvents.sortedBy { it.timestamp }
        val oldestMs = sorted.first().timestamp
        val newestMs = sorted.last().timestamp
        val windowDays = max(
            1,
            TimeUnit.MILLISECONDS.toDays(newestMs - oldestMs).toInt() + 1
        )

        val screenTimes = sorted.filter { it.type == BehaviorEventType.SCREEN_TIME_MINUTES }
        val lateNightMinutes = sorted.filter { it.type == BehaviorEventType.LATE_NIGHT_USAGE_MINUTES }
        val moods = sorted.filter { it.type == BehaviorEventType.MOOD_SCORE }
        val uninstalls = sorted.filter { it.type == BehaviorEventType.APP_UNINSTALL_COUNT }
        val comm = sorted.filter { it.type == BehaviorEventType.COMMUNICATION_VOLUME }
        val geofence = sorted.filter { it.type == BehaviorEventType.GEOFENCE_BREACH_COUNT }

        var score = 0
        val factors = mutableListOf<String>()
        val recs = mutableListOf<String>()

        // 1) Increased screen time — daily average above 6h is a concern.
        val screenPerDay = if (windowDays > 0)
            sum(screenTimes) / windowDays.toDouble()
        else 0.0
        if (screenPerDay >= 360) {
            score += 25
            factors += "Average daily screen time is ${screenPerDay.toInt()} min (>= 6h)"
            recs += "Consider setting a screen-time schedule and reviewing the most-used apps together."
        } else if (screenPerDay >= 240) {
            score += 12
            factors += "Average daily screen time is ${screenPerDay.toInt()} min (>= 4h)"
        }

        // 2) Late-night usage — more than 30 min/day between 23:00 and 04:00.
        val latePerDay = if (windowDays > 0)
            sum(lateNightMinutes) / windowDays.toDouble()
        else 0.0
        if (latePerDay >= 60) {
            score += 20
            factors += "Late-night usage averaging ${latePerDay.toInt()} min/day"
            recs += "Enable a device bedtime schedule to restrict late-night phone use."
        } else if (latePerDay >= 30) {
            score += 10
            factors += "Moderate late-night usage (${latePerDay.toInt()} min/day)"
        }

        // 3) Mood — average below 4/10 is concerning.
        val avgMood = average(moods)
        if (moods.isNotEmpty() && avgMood < 4.0) {
            score += 20
            factors += "Average mood score is ${"%.1f".format(avgMood)}/10"
            recs += "Have a supportive conversation; consider sharing crisis resources if mood stays low."
        } else if (moods.isNotEmpty() && avgMood < 6.0) {
            score += 8
            factors += "Below-average mood score (${"%.1f".format(avgMood)}/10)"
        }

        // 4) Social isolation proxy — sharp drop in communication volume.
        if (comm.size >= 4) {
            val firstHalf = average(comm.take(comm.size / 2))
            val secondHalf = average(comm.takeLast(comm.size / 2))
            if (firstHalf > 0 && secondHalf < firstHalf * 0.4) {
                score += 15
                factors += "Communication volume dropped >60% versus earlier in the window"
                recs += "Check in about friendships; sudden withdrawal from calls/messages can be a red flag."
            }
        }

        // 5) Multiple app uninstalls — could indicate avoidance of oversight.
        val totalUninstalls = sum(uninstalls).toInt()
        if (totalUninstalls >= 5) {
            score += 10
            factors += "$totalUninstalls apps uninstalled in the window"
            recs += "Review recently uninstalled apps in the device admin report."
        }

        // 6) Geofence breaches.
        val breaches = sum(geofence).toInt()
        if (breaches >= 3) {
            score += 10
            factors += "$breaches geofence breaches in the window"
            recs += "Confirm the geofence rules still match the child's typical routine."
        }

        score = min(100, max(0, score))
        val level = when {
            score >= 60 -> RiskLevel.HIGH
            score >= 30 -> RiskLevel.MODERATE
            else -> RiskLevel.LOW
        }

        if (recs.isEmpty()) {
            recs += "No concerning patterns detected in the current window."
        }

        return BehaviorPrediction(
            riskScore = score,
            riskLevel = level,
            contributingFactors = factors,
            recommendations = recs,
            dataWindowDays = windowDays
        )
    }

    private fun sum(events: List<BehaviorEvent>): Double =
        events.sumOf { it.value }

    private fun average(events: List<BehaviorEvent>): Double =
        if (events.isEmpty()) 0.0 else sum(events) / events.size
}
