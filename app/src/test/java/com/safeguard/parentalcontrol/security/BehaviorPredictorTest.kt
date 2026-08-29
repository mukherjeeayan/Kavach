package com.safeguard.parentalcontrol.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class BehaviorPredictorTest {

    private val dayMs = 24L * 60L * 60L * 1000L
    private val baseTs = 1_700_000_000_000L

    private fun screenEvent(day: Int, minutes: Double) = BehaviorEvent(
        type = BehaviorEventType.SCREEN_TIME_MINUTES,
        timestamp = baseTs + day * dayMs,
        value = minutes
    )

    private fun lateEvent(day: Int, minutes: Double) = BehaviorEvent(
        type = BehaviorEventType.LATE_NIGHT_USAGE_MINUTES,
        timestamp = baseTs + day * dayMs,
        value = minutes
    )

    private fun moodEvent(day: Int, score: Double) = BehaviorEvent(
        type = BehaviorEventType.MOOD_SCORE,
        timestamp = baseTs + day * dayMs,
        value = score
    )

    private fun uninstallEvent(day: Int, count: Double) = BehaviorEvent(
        type = BehaviorEventType.APP_UNINSTALL_COUNT,
        timestamp = baseTs + day * dayMs,
        value = count
    )

    @Test
    fun `high screen time increases risk score`() {
        // 7 days of 420 minutes/day = 7h/day, well above the 360-minute threshold.
        val events = (0..6).map { screenEvent(it, 420.0) }

        val prediction = BehaviorPredictor.predictBehavior("child-1", events)

        assertTrue(
            "Expected riskScore >= 25 for 7h/day screen time, got ${prediction.riskScore}",
            prediction.riskScore >= 25
        )
        assertTrue(
            prediction.contributingFactors.any { it.contains("screen time", ignoreCase = true) }
        )
        assertTrue(prediction.riskLevel == RiskLevel.MODERATE || prediction.riskLevel == RiskLevel.HIGH)
    }

    @Test
    fun `mood drops increase risk score`() {
        // 7 days of mood scores averaging ~3/10 -> 20-point bump.
        val events = listOf(2.5, 3.0, 2.0, 3.5, 3.0, 2.5, 4.0).mapIndexed { i, v ->
            moodEvent(i, v)
        }

        val prediction = BehaviorPredictor.predictBehavior("child-1", events)

        assertTrue(
            "Expected riskScore >= 20 for low mood, got ${prediction.riskScore}",
            prediction.riskScore >= 20
        )
        assertTrue(
            prediction.contributingFactors.any { it.contains("mood", ignoreCase = true) }
        )
    }

    @Test
    fun `clean behavior produces low risk`() {
        // 7 days of modest screen time, healthy mood, no spikes.
        val events = buildList {
            (0..6).forEach { i ->
                add(screenEvent(i, 90.0))
                add(lateEvent(i, 5.0))
                add(moodEvent(i, 8.0))
            }
        }

        val prediction = BehaviorPredictor.predictBehavior("child-1", events)

        assertEquals(RiskLevel.LOW, prediction.riskLevel)
        assertTrue(
            "Expected low risk score, got ${prediction.riskScore}",
            prediction.riskScore < 30
        )
        // No concerning patterns -> a baseline reassurance recommendation.
        assertTrue(prediction.recommendations.isNotEmpty())
    }

    @Test
    fun `empty events returns a placeholder recommendation`() {
        val prediction = BehaviorPredictor.predictBehavior("child-1", emptyList())

        assertEquals(0, prediction.riskScore)
        assertEquals(RiskLevel.LOW, prediction.riskLevel)
        assertEquals(0, prediction.dataWindowDays)
        assertTrue(prediction.recommendations.isNotEmpty())
        assertNotNull(prediction.recommendations.first())
    }

    @Test
    fun `recommendations are provided when risk is elevated`() {
        val events = buildList {
            (0..6).forEach { i ->
                add(screenEvent(i, 420.0))   // +25 (>=6h)
                add(lateEvent(i, 70.0))      // +20 (>=60 min late-night)
                add(moodEvent(i, 2.0))       // +20 (avg <4)
                add(uninstallEvent(i, 1.0))  // not enough alone (need >=5)
            }
        }

        val prediction = BehaviorPredictor.predictBehavior("child-1", events)

        assertTrue(prediction.recommendations.isNotEmpty())
        assertTrue(
            prediction.riskScore >= 60,
            "Expected HIGH risk score, got ${prediction.riskScore}"
        )
        assertEquals(RiskLevel.HIGH, prediction.riskLevel)
    }

    @Test
    fun `risk score is clamped to 0-100`() {
        // Stack every contributing factor.
        val events = buildList {
            (0..6).forEach { i ->
                add(screenEvent(i, 500.0))
                add(lateEvent(i, 90.0))
                add(moodEvent(i, 1.0))
                add(uninstallEvent(i, 1.0))
            }
        }

        val prediction = BehaviorPredictor.predictBehavior("child-1", events)

        assertTrue(prediction.riskScore in 0..100)
    }
}
