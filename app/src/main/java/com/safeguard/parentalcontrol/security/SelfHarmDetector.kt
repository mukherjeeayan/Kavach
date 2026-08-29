package com.safeguard.parentalcontrol.security

import java.util.Locale

/**
 * Lightweight, on-device keyword-based detector for self-harm and
 * crisis indicators in text the child sends or receives.
 *
 * The intent is **not** to be a clinical instrument — it's a safety
 * net that surfaces obvious red flags so a parent can be looped in
 * and crisis resources can be shown. All matching is
 * case-insensitive and whole-word.
 *
 * On a [Severity.MEDIUM] or higher hit, the [SelfHarmAlertMonitor]
 * should both show crisis resources to the child and notify the
 * parent.
 */
object SelfHarmDetector {

    private const val TAG = "SelfHarmDetector"

    private const val CRISIS_HOTLINE =
        "iCall: 9152987821, Vandrevala Foundation: 1860-2662-345"

    /**
     * Scan [text] for concerning language. Returns an immutable
     * assessment describing the worst signal found.
     */
    fun analyzeText(text: String): SelfHarmAssessment {
        if (text.isBlank()) {
            return SelfHarmAssessment(
                severity = Severity.NONE,
                matchedPhrases = emptyList(),
                recommendedAction = SelfHarmAssessment.RecommendedAction.NONE,
                snippet = "",
                crisisHotline = CRISIS_HOTLINE
            )
        }

        val lower = text.lowercase(Locale.ROOT)
        val matched = mutableListOf<String>()

        for (phrase in HIGH_SEVERITY_PHRASES) {
            if (containsWord(lower, phrase)) matched += phrase
        }
        if (matched.isNotEmpty()) {
            return SelfHarmAssessment(
                severity = Severity.HIGH,
                matchedPhrases = matched.distinct(),
                recommendedAction = SelfHarmAssessment.RecommendedAction
                    .SHOW_CRISIS_RESOURCES_AND_NOTIFY_PARENT,
                snippet = makeSnippet(text),
                crisisHotline = CRISIS_HOTLINE
            )
        }

        for (phrase in MEDIUM_SEVERITY_PHRASES) {
            if (containsWord(lower, phrase)) matched += phrase
        }
        if (matched.isNotEmpty()) {
            return SelfHarmAssessment(
                severity = Severity.MEDIUM,
                matchedPhrases = matched.distinct(),
                recommendedAction = SelfHarmAssessment.RecommendedAction
                    .SHOW_CRISIS_RESOURCES_AND_NOTIFY_PARENT,
                snippet = makeSnippet(text),
                crisisHotline = CRISIS_HOTLINE
            )
        }

        for (phrase in LOW_SEVERITY_PHRASES) {
            if (containsWord(lower, phrase)) matched += phrase
        }
        if (matched.isNotEmpty()) {
            return SelfHarmAssessment(
                severity = Severity.LOW,
                matchedPhrases = matched.distinct(),
                recommendedAction = SelfHarmAssessment.RecommendedAction.NOTIFY_PARENT,
                snippet = makeSnippet(text),
                crisisHotline = CRISIS_HOTLINE
            )
        }

        return SelfHarmAssessment(
            severity = Severity.NONE,
            matchedPhrases = emptyList(),
            recommendedAction = SelfHarmAssessment.RecommendedAction.NONE,
            snippet = "",
            crisisHotline = CRISIS_HOTLINE
        )
    }

    private fun containsWord(haystack: String, needle: String): Boolean {
        val pattern = Regex(
            "(?<![A-Za-z0-9])" + Regex.escape(needle) + "(?![A-Za-z0-9])"
        )
        return pattern.containsMatchIn(haystack)
    }

    private fun makeSnippet(text: String, max: Int = 140): String {
        val clean = text.replace("\\s+".toRegex(), " ").trim()
        return if (clean.length <= max) clean else clean.substring(0, max) + "..."
    }

    private val HIGH_SEVERITY_PHRASES = listOf(
        "kill myself",
        "end my life",
        "end it all",
        "want to die",
        "wanna die",
        "rather be dead",
        "suicide",
        "commit suicide",
        "take my own life",
        "no reason to live",
        "better off dead",
        "i should die",
        "i want to die",
        "going to end it",
        "goodbye forever",
        "final goodbye"
    )

    private val MEDIUM_SEVERITY_PHRASES = listOf(
        "self harm",
        "self-harm",
        "cut myself",
        "cutting myself",
        "hurt myself",
        "harming myself",
        "overdose",
        "jump off",
        "hang myself",
        "nobody cares about me",
        "no one cares",
        "i hate my life",
        "wish i was dead",
        "wish i were dead",
        "i can't go on",
        "cant go on anymore",
        "nothing matters anymore",
        "give up on life"
    )

    private val LOW_SEVERITY_PHRASES = listOf(
        "so tired of everything",
        "feel empty",
        "feel hopeless",
        "feel worthless",
        "can't take it",
        "cant take it anymore",
        "i'm breaking down",
        "falling apart",
        "hate myself",
        "no way out",
        "lost all hope",
        "don't want to wake up",
        "dont want to wake up"
    )
}
