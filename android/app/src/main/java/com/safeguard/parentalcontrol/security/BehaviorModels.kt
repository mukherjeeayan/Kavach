package com.safeguard.parentalcontrol.security

import java.util.Locale

/**
 * A single behavioural signal observed on a child's device.
 *
 * @param type        what was observed
 * @param timestamp   event time, millis since epoch
 * @param value       payload (e.g. minutes of screen time, mood
 *                    score 1–10, hour-of-day 0–23). Zero / null
 *                    means "not applicable".
 */
data class BehaviorEvent(
    val type: BehaviorEventType,
    val timestamp: Long,
    val value: Double
)

enum class BehaviorEventType {
    SCREEN_TIME_MINUTES,
    LATE_NIGHT_USAGE_MINUTES,
    MOOD_SCORE,
    APP_UNINSTALL_COUNT,
    COMMUNICATION_VOLUME,
    GEOFENCE_BREACH_COUNT
}

/**
 * What the predictor thinks the child's recent behaviour is
 * pointing at.
 */
enum class RiskLevel {
    LOW,
    MODERATE,
    HIGH
}

/**
 * Output of [BehaviorPredictor.predictBehavior].
 */
data class BehaviorPrediction(
    val riskScore: Int,
    val riskLevel: RiskLevel,
    val contributingFactors: List<String>,
    val recommendations: List<String>,
    val dataWindowDays: Int
)
