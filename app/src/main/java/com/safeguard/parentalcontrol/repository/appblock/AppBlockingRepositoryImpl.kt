package repository.appblock

import com.safeguard.parentalcontrol.data.local.dao.SyncQueueDao
import com.safeguard.parentalcontrol.data.local.entity.SyncQueueEntity
import com.safeguard.parentalcontrol.service.api.Phase2Api
import kotlinx.coroutines.flow.MutableSharedFlow

class AppBlockingRepositoryImpl @Inject constructor(
    private val api: Phase2Api,
    @Inject private val syncQueueDao: SyncQueueDao,
    @Inject private val onboardingStore: OnboardingStore
) : AppBlockingRepository {
    override suspend fun blockApp(childId: String, packageName: String, reason: String?): Result {
        try {
            api.blockApp(childId, packageName, reason)
            return Result.success()
        } catch (e: Exception) {
            // Queue for offline sync instead of failing
            syncQueueDao.insert(SyncQueueEntity(
                featureType = "APP_BLOCK",
                action = "CREATE",
                payloadJson = Gson().toJson(mapOf(
                    "childId" to childId,
                    "packageName" to packageName,
                    "reason" to reason
                ))
            ))
            return Result.success() // Queued for later sync
        }
    }

    override suspend fun unblockApp(childId: String, ruleId: String): Result {
        try {
            api.unblockApp(childId, ruleId)
            return Result.success()
        } catch (e: Exception) {
            syncQueueDao.insert(SyncQueueEntity(
                featureType = "APP_BLOCK",
                action = "DELETE",
                payloadJson = Gson().toJson(mapOf(
                    "childId" to childId,
                    "ruleId" to ruleId
                ))
            ))
            return Result.success()
        }
    }

    // Similar pattern for other methods...
}