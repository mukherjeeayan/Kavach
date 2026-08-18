package com.safeguard.parentalcontrol.security

import javax.inject.Inject
import javax.inject.Singleton

/**
 * Shared tamper/lockdown state between the enforcement service and
 * the repository. When [lockdown] is active the repository refuses
 * to weaken the enforced policy (fail-closed hardening): cached
 * blocked apps stay blocked even if the server reports them unblocked.
 */
@Singleton
class TamperState @Inject constructor() {
    @Volatile
    var lockdown: Boolean = false
}