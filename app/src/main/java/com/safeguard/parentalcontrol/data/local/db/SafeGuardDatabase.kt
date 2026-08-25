@Database(entities = [
    AppBlockRuleEntity::class,
    ScreenTimeDailyEntity::class,
    ContactRuleEntity::class,
    LocationEntryEntity::class,
    UrlFilterEntity::class,
    GeofenceEntity::class,
    SyncQueueEntity::class,
    MoodLogResponseDto::class,
    RewardPointsDto::class,
    BehaviorPredictionDto::class,
    SecurityScanDto::class,
    SelfHarmAlertDto::class,
    VoiceCommandDto::class,
    IntegrationConfig::class
], version = 5, exportSchema = false)
abstract class SafeGuardDatabase : RoomDatabase() {