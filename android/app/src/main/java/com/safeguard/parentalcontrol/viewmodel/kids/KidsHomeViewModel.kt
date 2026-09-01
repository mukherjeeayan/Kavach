package com.safeguard.parentalcontrol.viewmodel.kids

import android.app.Application
import android.app.usage.UsageStatsManager
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.safeguard.parentalcontrol.data.local.OnboardingStore
import com.safeguard.parentalcontrol.data.local.dao.AppBlockRuleDao
import com.safeguard.parentalcontrol.data.local.dao.GeofenceDao
import com.safeguard.parentalcontrol.data.local.dao.LocationDao
import com.safeguard.parentalcontrol.data.local.dao.ScheduledLockDao
import com.safeguard.parentalcontrol.data.local.dao.ScreenTimeDao
import com.safeguard.parentalcontrol.data.local.entity.AppBlockRuleEntity
import com.safeguard.parentalcontrol.data.local.entity.GeofenceEntity
import com.safeguard.parentalcontrol.data.local.entity.LocationEntryEntity
import com.safeguard.parentalcontrol.data.local.entity.ScheduledLockEntity
import com.safeguard.parentalcontrol.data.local.entity.ScreenTimeDailyEntity
import com.safeguard.parentalcontrol.repository.phase2.Phase2Repository
import com.safeguard.parentalcontrol.security.ScreenshotDetector
import com.safeguard.parentalcontrol.work.DailyLimitWorker
import com.safeguard.parentalcontrol.work.BedTimeWorker
import com.safeguard.parentalcontrol.work.OnlyWorkWorker
import com.safeguard.parentalcontrol.work.PickupReminderWorker
import com.safeguard.parentalcontrol.work.SyncQueueWorker
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

data class KidsHomeState(
    val childName: String = "",
    val deviceId: String = "",
    val blockedApps: List<AppBlockRuleEntity> = emptyList(),
    val scheduledLocks: List<ScheduledLockEntity> = emptyList(),
    val screenTimeToday: List<ScreenTimeDailyEntity> = emptyList(),
    val recentLocations: List<LocationEntryEntity> = emptyList(),
    val geofences: List<GeofenceEntity> = emptyList(),
    val totalScreenTimeMinutes: Int = 0,
    val isLoading: Boolean = true,
    val error: String? = null
)

/**
 * ViewModel for the Kids' home dashboard. Exposes real data from the
 * local Room database and triggers background WorkManager jobs for
 * periodic sync, geofencing checks, and enforcement workers.
 */
@HiltViewModel
class KidsHomeViewModel @Inject constructor(
    application: Application,
    private val onboardingStore: OnboardingStore,
    private val appBlockRuleDao: AppBlockRuleDao,
    private val scheduledLockDao: ScheduledLockDao,
    private val screenTimeDao: ScreenTimeDao,
    private val locationDao: LocationDao,
    private val geofenceDao: GeofenceDao,
    private val phase2Repository: Phase2Repository
) : AndroidViewModel(application) {

    private val _error = MutableStateFlow<String?>(null)
    private val _isLoading = MutableStateFlow(true)

    private val childId: String get() = onboardingStore.childId ?: ""
    private val deviceId: String get() = onboardingStore.deviceId ?: ""

    private data class Combine1(
        val blocked: List<AppBlockRuleEntity>,
        val locks: List<ScheduledLockEntity>,
        val screenTime: List<ScreenTimeDailyEntity>,
        val locations: List<LocationEntryEntity>
    )

    val uiState: StateFlow<KidsHomeState> = combine(
        combine(
            appBlockRuleDao.getAllRulesFlow(deviceId),
            scheduledLockDao.getAll(),
            screenTimeDao.flowByDate(todayKey()),
            locationDao.flowRecent()
        ) { b, l, s, loc -> Combine1(b, l, s, loc) },
        geofenceDao.getActiveGeofences(),
        _isLoading,
        _error
    ) { c1, geofences, loading, error ->
        val totalMinutes = c1.screenTime.sumOf { it.seconds } / 60
        KidsHomeState(
            childName = onboardingStore.childName ?: "Child",
            deviceId = deviceId,
            blockedApps = c1.blocked,
            scheduledLocks = c1.locks,
            screenTimeToday = c1.screenTime,
            recentLocations = c1.locations,
            geofences = geofences,
            totalScreenTimeMinutes = totalMinutes,
            isLoading = loading,
            error = error
        )
    }.stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), KidsHomeState())

    init {
        schedulePeriodicJobs()
        startScreenshotDetection()
    }

    private fun schedulePeriodicJobs() {
        val workManager = WorkManager.getInstance(getApplication())

        // Periodic sync queue worker (every 15 min — WorkManager minimum)
        val syncQueueRequest = PeriodicWorkRequestBuilder<SyncQueueWorker>(
            15, java.util.concurrent.TimeUnit.MINUTES
        ).setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        ).build()
        workManager.enqueueUniquePeriodicWork(
            "kids_sync_queue",
            ExistingPeriodicWorkPolicy.KEEP,
            syncQueueRequest
        )

        // OnlyWorkWorker — screen time limit enforcement (every 15 min)
        val onlyWorkRequest = PeriodicWorkRequestBuilder<OnlyWorkWorker>(
            15, java.util.concurrent.TimeUnit.MINUTES
        ).build()
        workManager.enqueueUniquePeriodicWork(
            "kids_only_work",
            ExistingPeriodicWorkPolicy.KEEP,
            onlyWorkRequest
        )

        // DailyLimitWorker — per-app daily limit check (every 15 min)
        val dailyLimitRequest = PeriodicWorkRequestBuilder<DailyLimitWorker>(
            15, java.util.concurrent.TimeUnit.MINUTES
        ).build()
        workManager.enqueueUniquePeriodicWork(
            "kids_daily_limit",
            ExistingPeriodicWorkPolicy.KEEP,
            dailyLimitRequest
        )

        // BedTimeWorker — bedtime enforcement (every 15 min)
        val bedTimeRequest = PeriodicWorkRequestBuilder<BedTimeWorker>(
            15, java.util.concurrent.TimeUnit.MINUTES
        ).build()
        workManager.enqueueUniquePeriodicWork(
            "kids_bedtime",
            ExistingPeriodicWorkPolicy.KEEP,
            bedTimeRequest
        )

        // PickupReminderWorker — inactivity reminder (every 1 hour)
        val pickupRequest = PeriodicWorkRequestBuilder<PickupReminderWorker>(
            1, java.util.concurrent.TimeUnit.HOURS
        ).build()
        workManager.enqueueUniquePeriodicWork(
            "kids_pickup_reminder",
            ExistingPeriodicWorkPolicy.KEEP,
            pickupRequest
        )

        // One-shot initial sync to populate data immediately
        val initialSync = OneTimeWorkRequestBuilder<SyncQueueWorker>().build()
        workManager.enqueue(initialSync)
    }

    private fun startScreenshotDetection() {
        viewModelScope.launch {
            try {
                val detector = ScreenshotDetector(getApplication())
                detector.start()
                detector.screenshotEvents.collect { event ->
                    phase2Repository.reportSecurityScan(
                        com.safeguard.parentalcontrol.data.remote.dto.SecurityScanReportDto(
                            isRooted = false,
                            hasKeylogger = false,
                            appIntegrityOk = true
                        )
                    )
                }
            } catch (e: Exception) {
                _error.value = "Screenshot detection failed: ${e.message}"
            }
        }
    }

    fun refreshData() {
        viewModelScope.launch {
            _isLoading.value = true
            try {
                phase2Repository.syncGeofences()
            } catch (e: Exception) {
                _error.value = "Sync failed: ${e.message}"
            } finally {
                _isLoading.value = false
            }
        }
    }

    private fun todayKey(): String =
        LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.US))
}
