package com.safeguard.parentalcontrol.service.geofencing

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.Geofence
import com.google.android.gms.location.GeofencingClient
import com.google.android.gms.location.GeofencingRequest
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.GeofenceDao
import com.safeguard.parentalcontrol.data.local.entity.GeofenceEntity
import com.safeguard.parentalcontrol.data.remote.api.Phase2Api
import com.safeguard.parentalcontrol.data.remote.dto.GeofenceCheckDto
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground service that registers geofences with Android's
 * [GeofencingClient] and monitors the device location. On geofence
 * enter/exit events, it checks with the backend and broadcasts
 * the result.
 *
 * Uses FusedLocationProviderClient for efficient location updates
 * and [GeofencingClient] for geofence boundary detection.
 */
@AndroidEntryPoint
class GeofenceService : Service() {

    @Inject
    lateinit var phase2Api: Phase2Api

    @Inject
    lateinit var onboardingStore: OnboardingStore

    @Inject
    lateinit var geofenceDao: GeofenceDao

    private lateinit var fusedClient: FusedLocationProviderClient
    private lateinit var geofencingClient: GeofencingClient
    @Volatile
    private var isTracking = false
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var pendingGeofenceIds = mutableListOf<String>()

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            serviceScope.launch {
                try {
                    val deviceId = onboardingStore.deviceId ?: return@launch
                    val response = phase2Api.checkGeofences(
                        deviceId,
                        GeofenceCheckDto(
                            latitude = location.latitude,
                            longitude = location.longitude
                        )
                    )
                    if (response.isSuccessful && response.body()?.data != null) {
                        val events = response.body()!!.data!!
                        if (events.isNotEmpty()) {
                            for (event in events) {
                                val intent = Intent(GEOFENCE_ACTION).apply {
                                    setPackage(packageName)
                                    putExtra(EXTRA_EVENT_TYPE, event.eventType)
                                    putExtra(EXTRA_GEOFENCE_ID, event.geofenceId)
                                    putExtra(EXTRA_EVENT_ID, event.id)
                                }
                                sendBroadcast(intent)
                                Log.d(TAG, "Geofence event: ${event.eventType} for ${event.geofenceId}")
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Geofence check failed", e)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        geofencingClient = LocationServices.getGeofencingClient(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION)
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Location permission missing — stopping")
            stopSelf()
            return START_NOT_STICKY
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q &&
            ContextCompat.checkSelfPermission(this, "android.permission.ACCESS_BACKGROUND_LOCATION")
            != PackageManager.PERMISSION_GRANTED
        ) {
            Log.w(TAG, "Background location permission missing — stopping")
            stopSelf()
            return START_NOT_STICKY
        }

        when (intent?.action) {
            ACTION_REGISTER_GEOFENCES -> {
                serviceScope.launch {
                    registerGeofencesFromDb()
                }
            }
            ACTION_REMOVE_GEOFENCES -> {
                removeAllGeofences()
            }
        }

        if (!isTracking) {
            isTracking = true
            val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, INTERVAL_MS)
                .setMinUpdateIntervalMillis(MIN_INTERVAL_MS)
                .build()
            fusedClient.requestLocationUpdates(request, locationCallback, null)
            Log.i(TAG, "Geofence location tracking started")
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceScope.cancel()
        if (isTracking) {
            try {
                fusedClient.removeLocationUpdates(locationCallback)
            } catch (_: Exception) {
            }
            isTracking = false
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    /**
     * Fetches geofences from the local Room database and registers
     * them with Android's [GeofencingClient].
     */
    private suspend fun registerGeofencesFromDb() {
        try {
            val geofences = geofenceDao.getActiveGeofences()
            geofences.collect { entities ->
                registerWithGeofencingClient(entities)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register geofences", e)
        }
    }

    /**
     * Registers a list of [GeofenceEntity] objects with Android's
     * [GeofencingClient]. Uses a PendingIntent broadcast to receive
     * enter/exit events.
     */
    private fun registerWithGeofencingClient(entities: List<GeofenceEntity>) {
        if (entities.isEmpty()) return

        // Remove old geofences first
        if (pendingGeofenceIds.isNotEmpty()) {
            geofencingClient.removeGeofences(pendingGeofenceIds)
            pendingGeofenceIds.clear()
        }

        val geofenceList = entities.map { entity ->
            val requestId = entity.id
            pendingGeofenceIds.add(requestId)

            Geofence.Builder()
                .setRequestId(requestId)
                .setCircularRegion(
                    entity.latitude,
                    entity.longitude,
                    entity.radiusMeters.toFloat()
                )
                .setExpirationDuration(Geofence.NEVER_EXPIRE)
                .setTransitionTypes(
                    Geofence.GEOFENCE_TRANSITION_ENTER or Geofence.GEOFENCE_TRANSITION_EXIT
                )
                .setLoiteringDelay(30_000) // 30 seconds dwell time
                .build()
        }

        val pendingIntent = PendingIntent.getBroadcast(
            this,
            GEOFENCE_REQUEST_CODE,
            Intent(GEOFENCE_ACTION).setPackage(packageName),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE
        )

        val request = GeofencingRequest.Builder().apply {
            setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER or GeofencingRequest.INITIAL_TRIGGER_EXIT)
            addGeofences(geofenceList)
        }.build()

        try {
            geofencingClient.addGeofences(
                request,
                pendingIntent
            ).addOnSuccessListener {
                Log.i(TAG, "Geofences registered: ${entities.size} zones")
            }.addOnFailureListener { e ->
                Log.e(TAG, "Geofence registration failed", e)
            }
        } catch (e: SecurityException) {
            Log.e(TAG, "Missing permission for geofence registration", e)
        }
    }

    private fun removeAllGeofences() {
        if (pendingGeofenceIds.isNotEmpty()) {
            geofencingClient.removeGeofences(pendingGeofenceIds)
                .addOnSuccessListener {
                    Log.i(TAG, "All geofences removed")
                }
                .addOnFailureListener { e ->
                    Log.e(TAG, "Failed to remove geofences", e)
                }
            pendingGeofenceIds.clear()
        }
    }

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Geofence monitoring",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Monitors location for geofence boundaries"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("SafeGuard Geofence")
            .setContentText("Monitoring location boundaries")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "GeofenceService"
        private const val CHANNEL_ID = "safeguard_geofence"
        private const val NOTIFICATION_ID = 1004
        private const val INTERVAL_MS = 30_000L   // every 30 seconds
        private const val MIN_INTERVAL_MS = 15_000L
        private const val GEOFENCE_REQUEST_CODE = 1005
        const val GEOFENCE_ACTION = "com.safeguard.parentalcontrol.GEOFENCE_EVENT"
        const val EXTRA_EVENT_TYPE = "event_type"
        const val EXTRA_GEOFENCE_ID = "geofence_id"
        const val EXTRA_EVENT_ID = "event_id"
        const val ACTION_REGISTER_GEOFENCES = "com.safeguard.parentalcontrol.REGISTER_GEOFENCES"
        const val ACTION_REMOVE_GEOFENCES = "com.safeguard.parentalcontrol.REMOVE_GEOFENCES"
    }
}
