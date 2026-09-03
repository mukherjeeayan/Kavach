# SafeGuard (Kavach) release ProGuard/R8 rules.
# Release builds run with isMinifyEnabled = true (see build.gradle.kts).

# --- Kotlin coroutines ---
-dontwarn kotlinx.coroutines.**
-keepclassmembers class kotlinx.coroutines.** { volatile <fields>; }

# --- Gson ---
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.google.gson.reflect.TypeToken { *; }
-keep class * extends com.google.gson.reflect.TypeToken

# DTOs are serialized/deserialized by Gson (no-arg reflection + field names).
-keep class com.safeguard.parentalcontrol.data.remote.dto.** { *; }
-keep class com.safeguard.parentalcontrol.data.remote.api.** { *; }

# --- Retrofit ---
-dontwarn retrofit2.**
-keepattributes Exceptions, InnerClasses, EnclosingMethod
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# --- OkHttp / Okio ---
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn org.conscrypt.**
-dontwarn org.bouncycastle.**

# --- Room ---
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-keep @androidx.room.Dao class *

# --- Hilt / Dagger ---
-dontwarn dagger.hilt.**
-keep class dagger.hilt.** { *; }
-keep class javax.inject.** { *; }

# --- Socket.IO (engine.io handshake + events ride on JSONObject/JSONArray) ---
-dontwarn io.socket.**
-keep class io.socket.** { *; }

# --- AndroidX WorkManager ---
-dontwarn androidx.work.**
-keep class * extends androidx.work.Worker
-keep class * extends androidx.work.CoroutineWorker

# --- SafeGuard Entry Points ---
# Application, Services, Receivers must not be renamed.
-keep class com.safeguard.parentalcontrol.SafeGuardApplication { *; }
-keep class com.safeguard.parentalcontrol.MainActivity { *; }
-keep class com.safeguard.parentalcontrol.service.appblock.AppBlockingService { *; }
-keep class com.safeguard.parentalcontrol.service.location.LocationService { *; }
-keep class com.safeguard.parentalcontrol.service.contacts.CallScreeningService { *; }
-keep class com.safeguard.parentalcontrol.receiver.BootReceiver { *; }
-keep class com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver { *; }
-keep class com.safeguard.parentalcontrol.notifications.SafeGuardMessagingService { *; }

# --- Firebase ---
-dontwarn com.google.firebase.**
-keep class com.google.firebase.** { *; }

# --- Security Classes (prevent R8 from renaming/obfuscating critical security code) ---
# Tamper detection
-keep class com.safeguard.parentalcontrol.security.TamperDetector { *; }
-keep class com.safeguard.parentalcontrol.security.TamperState { *; }

# Device integrity
-keep class com.safeguard.parentalcontrol.security.DeviceIntegrityChecker { *; }

# Encryption
-keep class com.safeguard.parentalcontrol.security.SecureMasterKey { *; }
-keep class com.safeguard.parentalcontrol.security.KeyManager { *; }

# Keyguard/Biometric
-keep class com.safeguard.parentalcontrol.security.KeyguardManager { *; }

# Content scanning
-keep class com.safeguard.parentalcontrol.content.ContentScanner { *; }

# Device admin
-keep class com.safeguard.parentalcontrol.security.DevicePolicyService { *; }
-keep class com.safeguard.parentalcontrol.security.SafeGuardDeviceAdminReceiver { *; }

# Self-harm detection
-keep class com.safeguard.parentalcontrol.security.SelfHarmDetector { *; }
-keep class com.safeguard.parentalcontrol.security.SelfHarmAssessment { *; }

# Screenshot prevention
-keep class com.safeguard.parentalcontrol.security.ScreenshotPrevention { *; }
-keep class com.safeguard.parentalcontrol.security.ScreenshotDetector { *; }

# Keylogger detection
-keep class com.safeguard.parentalcontrol.security.KeyloggerDetector { *; }

# Keep all security model classes
-keep class com.safeguard.parentalcontrol.security.** { *; }
