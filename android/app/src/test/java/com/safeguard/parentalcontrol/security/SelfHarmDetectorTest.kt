package com.safeguard.parentalcontrol.security

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SelfHarmDetectorTest {

    @Test
    fun `high-severity text is flagged as HIGH`() {
        val result = SelfHarmDetector.analyzeText("I want to kill myself tonight")

        assertEquals(Severity.HIGH, result.severity)
        assertEquals(
            SelfHarmAssessment.RecommendedAction.SHOW_CRISIS_RESOURCES_AND_NOTIFY_PARENT,
            result.recommendedAction
        )
        assertTrue(result.matchedPhrases.contains("kill myself"))
    }

    @Test
    fun `medium-severity text is flagged as MEDIUM`() {
        val result = SelfHarmDetector.analyzeText("I keep hurting myself when things get bad")

        assertEquals(Severity.MEDIUM, result.severity)
        assertEquals(
            SelfHarmAssessment.RecommendedAction.SHOW_CRISIS_RESOURCES_AND_NOTIFY_PARENT,
            result.recommendedAction
        )
        assertTrue(result.matchedPhrases.any { it.contains("hurt") })
    }

    @Test
    fun `low-severity text is flagged as LOW`() {
        val result = SelfHarmDetector.analyzeText("I feel empty and I'm falling apart lately")

        assertEquals(Severity.LOW, result.severity)
        assertEquals(
            SelfHarmAssessment.RecommendedAction.NOTIFY_PARENT,
            result.recommendedAction
        )
        assertTrue(result.matchedPhrases.isNotEmpty())
    }

    @Test
    fun `normal text returns NONE severity`() {
        val result = SelfHarmDetector.analyzeText("Had a great day at school, see you later!")

        assertEquals(Severity.NONE, result.severity)
        assertEquals(
            SelfHarmAssessment.RecommendedAction.NONE,
            result.recommendedAction
        )
        assertTrue(result.matchedPhrases.isEmpty())
        assertTrue(result.crisisHotline.isNotBlank())
    }

    @Test
    fun `matched phrases are returned and distinct`() {
        val result = SelfHarmDetector.analyzeText("I want to die, I really want to die")

        assertEquals(Severity.HIGH, result.severity)
        // "want to die" appears in the source list; the detector must report
        // it at most once even if the text contains it twice.
        val occurrences = result.matchedPhrases.count { it == "want to die" }
        assertEquals(1, occurrences)
    }

    @Test
    fun `blank text returns NONE severity`() {
        val result = SelfHarmDetector.analyzeText("   ")

        assertEquals(Severity.NONE, result.severity)
        assertTrue(result.matchedPhrases.isEmpty())
        assertTrue(result.snippet.isEmpty())
    }

    @Test
    fun `matching is case insensitive`() {
        val result = SelfHarmDetector.analyzeText("KILL MYSELF please")

        assertEquals(Severity.HIGH, result.severity)
        assertFalse(result.matchedPhrases.isEmpty())
    }

    @Test
    fun `snippet contains the original text up to 140 chars`() {
        val text = "I want to end my life"
        val result = SelfHarmDetector.analyzeText(text)

        assertNotNull(result.snippet)
        assertTrue(result.snippet.contains("end my life"))
    }
}
