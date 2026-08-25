val CoroutineScope.backgroundJobs = CoroutineScope(SupervisorJob() + Dispatchers.IO)

fun SyncScheduler.scheduleSyncQueue() {
    val workRequest = PeriodicWorkRequestBuilder<SyncQueueWorker>(5, TimeUnit.MINUTES)
        .setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build()
        )
    enqueueUniquePeriodicWork(
        "sync_queue_work",
        ExistingPeriodicWorkPolicy.KEEP,
        workRequest
    )
}