package com.safeguard.parentalcontrol.security

/**
 * Risk level produced by [SelfHarmDetector.analyzeText].
 *
 * Ordered by severity so callers can use ordinal / compareTo if
 * they want, but the API returns the explicit [Severity] value to
 * avoid surprises.
 */
enum class Severity {
    NONE,
    LOW,
    MEDIUM,
    HIGH
}

/**
 * The outcome of scanning a piece of text for self-harm / crisis
 * indicators.
 *
 * @param severity        overall risk level
 * @param matchedPhrases  every concerning phrase that was matched
 * @param recommendedAction what the app should do next
 * @param snippet         a short, redacted preview of the content
 *                        (safe to log / show to a parent)
 * @param crisisHotline   hotline information for the user's region
 */
data class SelfHarmAssessment(
    val severity: Severity,
    val matchedPhrases: List<String>,
    val recommendedAction: RecommendedAction,
    val snippet: String,
    val crisisHotline: String
) {
    enum class RecommendedAction {
        NONE,
        LOG_ONLY,
        NOTIFY_PARENT,
        SHOW_CRISIS_RESOURCES_AND_NOTIFY_PARENT
    }
}
