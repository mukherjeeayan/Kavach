package com.safeguard.parentalcontrol.data.remote

import android.util.Log
import com.safeguard.parentalcontrol.BuildConfig
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.TokenStore
import com.safeguard.parentalcontrol.repository.appblock.AppBlockingRepository
import com.safeguard.parentalcontrol.repository.phase1.Phase1Repository
import io.socket.client.IO
import io.socket.client.Socket
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.launch
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Realtime bridge to the backend's Socket.IO broadcast.
 *
 * The backend pushes `rule:changed` to the room of the affected child
 * whenever a parent changes a block rule, lock window or contact rule
 * from the dashboard. On receipt we re-sync the local Room caches so
 * enforcement applies the new policy within seconds — no 15-minute
 * wait for the periodic sync worker.
 *
 * The socket handshake carries the parent access token — the server
 * rejects unauthenticated connections and unauthorized room joins.
 *
 * The socket is a singleton: it lives for the whole app process and is
 * (re)started from the Application, after onboarding completes, and
 * from the BootReceiver after a reboot. If the socket is unavailable
 * (no network, blocked websockets) the periodic sync worker remains
 * the fallback — never fail closed.
 */
@Singleton
class RealtimeRulesClient @Inject constructor(
    private val onboardingStore: OnboardingStore,
    private val tokenStore: TokenStore,
    private val appBlockingRepository: AppBlockingRepository,
    private val phase1Repository: Phase1Repository
) {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var socket: Socket? = null

    /**
     * Connect (or reconnect) and subscribe to the current child's room.
     * No-op before onboarding completes — there is no child to watch.
     */
    @Synchronized
    fun start() {
        if (socket?.connected() == true) return
        val childId = onboardingStore.childId ?: return
        val deviceId = onboardingStore.deviceId ?: return
        val token = tokenStore.token ?: return

        val options = IO.Options().apply {
            reconnection = true
            reconnectionAttempts = Int.MAX_VALUE
            reconnectionDelay = 1_000  // Start with 1 second
            reconnectionDelayMax = 30_000  // Max 30 seconds
            timeout = 10_000
            // Socket.IO handles exponential backoff automatically
            // when reconnectionDelayMax is set
            auth = mapOf("token" to "Bearer $token")
        }
        val newSocket = IO.socket(serverUrl(), options)

        newSocket.on(Socket.EVENT_CONNECT) {
            Log.i(TAG, "Realtime connected — subscribing to child $childId")
            newSocket.emit(SUBSCRIBE_EVENT, childId)
        }
        newSocket.on(Socket.EVENT_DISCONNECT) {
            Log.i(TAG, "Realtime disconnected")
        }
        newSocket.on(Socket.EVENT_CONNECT_ERROR) { args ->
            Log.w(TAG, "Realtime connect error: ${args.firstOrNull()}")
        }
        newSocket.on(RULE_CHANGED_EVENT) { args ->
            val payload = (args.firstOrNull() as? JSONObject)?.toString() ?: "{}"
            Log.i(TAG, "rule:changed received — refreshing caches: $payload")
            refreshCaches(childId, deviceId)
        }

        socket = newSocket
        newSocket.connect()
    }

    @Synchronized
    fun stop() {
        socket?.disconnect()
        socket = null
        scope.coroutineContext.cancelChildren()
    }

    private fun refreshCaches(childId: String, deviceId: String) {
        scope.launch {
            try {
                appBlockingRepository.syncFromServer(childId, deviceId)
                phase1Repository.syncLocks(childId)
                phase1Repository.syncContacts(childId)
            } catch (_: Exception) {
                // Best-effort sync; will retry on next rule:changed event
            }
        }
    }

    /**
     * Socket.IO connects to the origin of the API (same host and port).
     * BuildConfig.API_BASE_URL ends with a trailing slash; the engine.io
     * handshake must not include the "/api/v1" prefix, so the path is
     * stripped.
     */
    private fun serverUrl(): String {
        val base = BuildConfig.API_BASE_URL
        return base.substringBeforeLast('/', base.dropLast(1))
    }

    companion object {
        private const val TAG = "RealtimeRulesClient"
        private const val SUBSCRIBE_EVENT = "subscribe:child"
        private const val RULE_CHANGED_EVENT = "rule:changed"
    }
}