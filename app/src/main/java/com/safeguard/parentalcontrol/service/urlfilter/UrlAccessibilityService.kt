package com.safeguard.parentalcontrol.service.urlfilter

import android.accessibilityservice.AccessibilityService
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import com.safeguard.parentalcontrol.data.local.dao.UrlFilterDao
import com.safeguard.parentalcontrol.data.local.entity.UrlFilterEntity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.collect
import java.net.URI
import javax.inject.Inject

/**
 * Accessibility service that observes browser URL bars and enforces
 * the server-synced URL filter rules. Listens for window content /
 * state change events from known browsers, extracts the URL from
 * their URL bar widgets, and launches [BlockedUrlActivity] on a hit.
 *
 * The rule set is read from Room via [UrlFilterDao] and cached
 * in-memory so the hot path (every window-content change) doesn't
 * hit the database. Caches are refreshed whenever the Flow emits.
 */
@AndroidEntryPoint
class UrlAccessibilityService : AccessibilityService() {

    @Inject
    lateinit var urlFilterDao: UrlFilterDao

    private val scope = CoroutineScope(Dispatchers.Default + SupervisorJob())
    private var cacheJob: Job? = null

    @Volatile
    private var rules: List<UrlFilterEntity> = emptyList()

    // Per-process debounce so we don't spam the overlay when the
    // browser re-renders the URL bar while the page loads.
    private var lastBlockedUrl: String? = null
    private var lastBlockedAtMs: Long = 0L
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        startRuleCache()
        Log.i(TAG, "UrlAccessibilityService connected")
    }

    override fun onUnbind(intent: Intent?): Boolean {
        instance = null
        cacheJob?.cancel()
        scope.coroutineContext[Job]?.cancel()
        Log.i(TAG, "UrlAccessibilityService unbound")
        return super.onUnbind(intent)
    }

    override fun onInterrupt() {
        // Required stub; nothing to cancel.
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        val pkg = event?.packageName?.toString() ?: return
        if (pkg !in SUPPORTED_BROWSERS) return
        if (event.eventType != AccessibilityEvent.TYPE_WINDOW_CONTENT_CHANGED &&
            event.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED
        ) return

        val root = rootInActiveWindow ?: return
        try {
            val url = extractUrl(root, pkg) ?: return
            evaluate(url, pkg)
        } catch (e: Exception) {
            Log.w(TAG, "Failed to process event from $pkg: ${e.message}")
        } finally {
            root.recycle()
        }
    }

    // ── Rule cache ────────────────────────────────────────────────

    private fun startRuleCache() {
        cacheJob?.cancel()
        cacheJob = scope.launch {
            urlFilterDao.getActiveRules().collect { active ->
                rules = active
                Log.i(TAG, "Rule cache refreshed: ${active.size} active rules")
            }
        }
    }

    // ── URL extraction ────────────────────────────────────────────

    private fun extractUrl(root: AccessibilityNodeInfo, pkg: String): String? {
        val ids = URL_BAR_IDS[pkg] ?: DEFAULT_URL_BAR_IDS
        for (id in ids) {
            val nodes = root.findAccessibilityNodeInfosByViewId(id)
            for (node in nodes) {
                val text = node.text?.toString()?.trim()
                if (!text.isNullOrEmpty() && looksLikeUrl(text)) {
                    return text
                }
            }
        }
        // Fallback: walk the tree looking for an EditText that holds a URL.
        return findUrlInTree(root)
    }

    private fun findUrlInTree(node: AccessibilityNodeInfo?): String? {
        if (node == null) return null
        val text = node.text?.toString()?.trim()
        if (!text.isNullOrEmpty() && looksLikeUrl(text) && text.length < 2048) {
            return text
        }
        for (i in 0 until node.childCount) {
            val found = findUrlInTree(node.getChild(i))
            if (found != null) return found
        }
        return null
    }

    private fun looksLikeUrl(s: String): Boolean {
        if (s.isEmpty()) return false
        val lower = s.lowercase()
        if (lower.startsWith("http://") || lower.startsWith("https://")) return true
        // Bare hostnames like "example.com" or "www.example.com/path"
        if (lower.startsWith("www.")) return true
        // Must contain a dot and no whitespace; reject sentences.
        if (' ' in s || '\n' in s) return false
        val firstDot = s.indexOf('.')
        if (firstDot <= 0 || firstDot == s.length - 1) return false
        val host = s.substring(0, firstDot)
        return host.all { it.isLetterOrDigit() || it == '-' }
    }

    // ── Evaluation ────────────────────────────────────────────────

    private fun evaluate(url: String, sourcePackage: String) {
        if (rules.isEmpty()) return

        val host = hostOf(url) ?: return
        val match = rules.firstOrNull { rule ->
            rule.ruleType.equals("BLOCK", ignoreCase = true) && matches(rule, host, url)
        }
        if (match != null) {
            Log.i(TAG, "Blocked URL: $url (rule=${match.id} type=${match.ruleType} category=${match.category})")
            launchBlockScreen(url)
        }
    }

    private fun matches(rule: UrlFilterEntity, host: String, fullUrl: String): Boolean {
        val pattern = rule.pattern.trim().lowercase()
        if (pattern.isEmpty()) return false

        // Category match: rule.pattern is a category name (e.g. "adult",
        // "violence") and the URL contains it as a token. The full URL
        // is checked rather than the host so category rules can match
        // anywhere in the address.
        if (rule.category.equals("CATEGORY", ignoreCase = true) ||
            pattern.startsWith("category:")
        ) {
            val categoryName = pattern.removePrefix("category:").trim()
            if (categoryName.isEmpty()) return false
            return fullUrl.lowercase().contains(categoryName)
        }

        val ruleHost = hostOf(pattern) ?: pattern
        val hostLower = host.lowercase()
        val ruleHostLower = ruleHost.lowercase()

        // Exact match
        if (hostLower == ruleHostLower) return true
        if (fullUrl.equals(pattern, ignoreCase = true)) return true
        // Wildcard domain: *.example.com matches foo.example.com
        if (ruleHostLower.startsWith("*.")) {
            val base = ruleHostLower.removePrefix("*.")
            return hostLower == base || hostLower.endsWith(".$base")
        }
        // Suffix match: pattern "example.com" matches any subdomain.
        if (hostLower == ruleHostLower || hostLower.endsWith(".$ruleHostLower")) {
            return true
        }
        // Substring match on the URL itself for path-style rules.
        if (fullUrl.lowercase().contains(pattern)) return true
        return false
    }

    private fun hostOf(urlOrPattern: String): String? {
        return try {
            val normalized = if (urlOrPattern.contains("://")) urlOrPattern else "http://$urlOrPattern"
            URI(normalized).host?.lowercase()
        } catch (e: Exception) {
            // Wildcards / non-URI patterns: strip the leading wildcard
            // and return whatever looks like a host portion.
            urlOrPattern.trim().lowercase()
                .removePrefix("*.")
                .removePrefix("http://")
                .removePrefix("https://")
                .substringBefore('/')
                .takeIf { it.isNotEmpty() }
        }
    }

    // ── Block screen launcher ─────────────────────────────────────

    private fun launchBlockScreen(url: String) {
        val now = System.currentTimeMillis()
        // Debounce: same URL within 2s -> skip. Different URL -> always launch.
        if (url == lastBlockedUrl && now - lastBlockedAtMs < BLOCK_DEBOUNCE_MS) return
        lastBlockedUrl = url
        lastBlockedAtMs = now

        mainHandler.post {
            try {
                val intent = Intent(this, BlockedUrlActivity::class.java).apply {
                    putExtra(BlockedUrlActivity.EXTRA_BLOCKED_URL, url)
                    addFlags(
                        Intent.FLAG_ACTIVITY_NEW_TASK or
                            Intent.FLAG_ACTIVITY_CLEAR_TOP or
                            Intent.FLAG_ACTIVITY_NO_ANIMATION
                    )
                }
                startActivity(intent)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to launch BlockedUrlActivity for $url", e)
            }
        }
    }

    companion object {
        private const val TAG = "UrlAccessibility"

        // Browser package names we know how to read a URL from.
        private val SUPPORTED_BROWSERS = setOf(
            "com.android.chrome",
            "org.mozilla.firefox",
            "com.brave.browser",
            "com.opera.browser",
            "com.opera.mini.native",
            "com.sec.android.app.sbrowser",
            "com.UCMobile.intl",
            "com.duckduckgo.mobile.android",
            "com.microsoft.emmx",
            "com.kiwibrowser.browser",
            "com.vivaldi.browser",
            "org.torproject.torbrowser"
        )

        // View IDs of each browser's URL bar. Different Chrome versions
        // ship different IDs, so we probe a small set per browser.
        private val URL_BAR_IDS: Map<String, List<String>> = mapOf(
            "com.android.chrome" to listOf(
                "com.android.chrome:id/url_bar",
                "com.android.chrome:id/search_box_text",
                "com.android.chrome:id/location_bar"
            ),
            "org.mozilla.firefox" to listOf(
                "org.mozilla.firefox:id/url_bar_title",
                "org.mozilla.firefox:id/url_bar",
                "org.mozilla.firefox:id/search"
            ),
            "com.brave.browser" to listOf(
                "com.brave.browser:id/url_bar",
                "com.brave.browser:id/search_box"
            ),
            "com.sec.android.app.sbrowser" to listOf(
                "com.sec.android.app.sbrowser:id/location_bar_edit_text",
                "com.sec.android.app.sbrowser:id/url_bar"
            ),
            "com.microsoft.emmx" to listOf(
                "com.microsoft.emmx:id/url_bar",
                "com.microsoft.emmx:id/search_box_text"
            ),
            "com.UCMobile.intl" to listOf(
                "com.UCMobile.intl:id/urlEditText",
                "com.UCMobile.intl:id/searchEditText"
            ),
            "com.duckduckgo.mobile.android" to listOf(
                "com.duckduckgo.mobile.android:id/omnibarTextInput"
            )
        )

        private val DEFAULT_URL_BAR_IDS = listOf(
            "url_bar",
            "urlBar",
            "search_box_text",
            "searchEditText"
        )

        private const val BLOCK_DEBOUNCE_MS = 2000L

        @Volatile
        private var instance: UrlAccessibilityService? = null

        fun isRunning(): Boolean = instance != null
    }
}
