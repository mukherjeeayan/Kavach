package com.safeguard.parentalcontrol.service.location

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.content.ContextCompat
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * Foreground service that periodically records the device location
 * into the local Room buffer. The sync worker uploads the buffered
 * pings to the backend; the parent sees them on the dashboard.
 *
 * Buffering keeps the design offline-safe: pings are kept until the
 * server acknowledges them.
 */
@AndroidEntryPoint
class LocationService : Service() {

    @Inject
    lateinit var locationDao: LocationDao

    private lateinit var fusedClient: FusedLocationProviderClient
    @Volatile
    private var isTracking = false
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            serviceScope.launch {
                try {
                    locationDao.insert(
                        LocationEntryEntity(
                            latitude = location.latitude,
                            longitude = location.longitude,
                            accuracyM = location.accuracy.toDouble().takeIf { it > 0 },
                            speedKmh = if (location.hasSpeed()) location.speed * 3.6 else null,
                            recordedAt = location.time.takeIf { it > 0 } ?: System.currentTimeMillis()
                        )
                    )
                    Log.d(TAG, "Location buffered (${location.latitude}, ${location.longitude})")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to buffer location", e)
                }
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification())
        fusedClient = LocationServices.getFusedLocationProviderClient(this)
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
        if (!isTracking) {
            isTracking = true
            val request = LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, INTERVAL_MS)
                .setMinUpdateIntervalMillis(MIN_INTERVAL_MS)
                .build()
            fusedClient.requestLocationUpdates(request, locationCallback, null)
            Log.i(TAG, "Location tracking started")
        }
        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        // Stop the upload coroutine as well, otherwise the scope keeps
        // running (and may still hold the last location) after the
        // service is torn down.
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

    private fun createNotificationChannel() {
        val channel = NotificationChannel(
            CHANNEL_ID,
            "Location sharing",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shares the device location with the parent"
        }
        getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
    }

    private fun buildNotification(): Notification {
        return Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("SafeGuard Location")
            .setContentText("Sharing location with your parent")
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .build()
    }

    companion object {
        private const val TAG = "LocationService"
        private const val CHANNEL_ID = "safeguard_location"
        private const val NOTIFICATION_ID = 1003
        private const val INTERVAL_MS = 5 * 60 * 1000L   // every 5 minutes
        private const val MIN_INTERVAL_MS = 2 * 60 * 1000L
    }
}