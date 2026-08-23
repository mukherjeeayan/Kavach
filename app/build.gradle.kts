// app/build.gradle.kts
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    id("com.google.devtools.ksp")
    id("com.google.dagger.hilt.android")
}

// Firebase is optional: the Google Services plugin hard-fails when
// google-services.json is missing, so it is only applied when the file
// is present (drop the real firebase config in app/google-services.json
// to enable FCM). FCM_ENABLED lets the app guard Firebase calls at
// runtime so builds without the file still install and run.
val googleServicesFile = file("google-services.json")
if (googleServicesFile.exists()) {
    apply(plugin = "com.google.gms.google-services")
}

android {
    namespace = "com.safeguard.parentalcontrol"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.safeguard.parentalcontrol"
        minSdk = 26
        targetSdk = 34
        // Version code is auto-incremented from CI or manually via:
        // ./gradlew :app:assembleRelease -PVERSION_CODE=2
        versionCode = (System.getenv("VERSION_CODE")?.toIntOrNull() 
            ?: project.findProperty("VERSION_CODE")?.toString()?.toIntOrNull() 
            ?: 1)
        versionName = "1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        
        // Hilt configuration for Room
        javaCompileOptions {
            annotationProcessorOptions {
                arguments += mapOf(
                    "room.schemaLocation" to "$projectDir/schemas",
                    "room.incremental" to "true",
                    "room.expandProjection" to "true"
                )
            }
        }
    }

    buildTypes {
        debug {
// Local backend as seen from the Android emulator
        buildConfigField("String", "API_BASE_URL", "\"http://10.0.2.2:3000/\"")
        buildConfigField("boolean", "FCM_ENABLED", googleServicesFile.exists().toString())
        buildConfigField("boolean", "CERT_PINNING_ENABLED", "false")
        buildConfigField("String", "CERT_PINS", "\"\"")
        }
        release {
            isMinifyEnabled = true
            // Set via local.properties or CI env: -PAPI_BASE_URL=https://your-api-domain.com/
            val apiBaseUrl = project.findProperty("API_BASE_URL") as? String
            requireNotNull(apiBaseUrl) { "API_BASE_URL must be set for release builds. Pass -PAPI_BASE_URL=https://your-api-domain.com/ to Gradle." }
            buildConfigField("String", "API_BASE_URL", "\"$apiBaseUrl\"")
            buildConfigField("boolean", "FCM_ENABLED", googleServicesFile.exists().toString())
            // Certificate pinning is mandatory in release. Supply the
            // production SHA-256 pins via -PSAFEGUARD_PINS="sha256/...,sha256/..."
            // (see NetworkModule). An empty list fails closed at startup.
            buildConfigField("boolean", "CERT_PINNING_ENABLED", "true")
            buildConfigField(
                "String",
                "CERT_PINS",
                "\"${providers.gradleProperty("SAFEGUARD_PINS").getOrElse("")}\""
            )
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlin {
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
        }
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }
    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }

    testOptions {
        unitTests {
            isReturnDefaultValues = true
            isIncludeAndroidResources = true
        }
    }
}

dependencies {
    val composeBomVersion = "2024.02.00"
    val lifecycleVersion = "2.7.0"
    val roomVersion = "2.7.2"
    val retrofitVersion = "2.9.0"
    val okhttpVersion = "4.12.0"
    val hiltVersion = "2.60.1"
    val workVersion = "2.9.0"
    val coroutinesVersion = "1.7.3"
    
    // Core & Lifecycle
    implementation("androidx.core:core-ktx:1.12.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:$lifecycleVersion")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:$lifecycleVersion")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:$lifecycleVersion")

    // Jetpack Compose
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation(platform("androidx.compose:compose-bom:$composeBomVersion"))
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("com.google.android.material:material:1.11.0")
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // Hilt (Dependency Injection)
    implementation("com.google.dagger:hilt-android:$hiltVersion")
    ksp("com.google.dagger:hilt-android-compiler:$hiltVersion")
    implementation("androidx.hilt:hilt-navigation-compose:1.1.0")
    implementation("androidx.hilt:hilt-work:1.1.0")
    ksp("androidx.hilt:hilt-compiler:1.1.0")

    // Room (Database)
    implementation("androidx.room:room-runtime:$roomVersion")
    implementation("androidx.room:room-ktx:$roomVersion")
    ksp("androidx.room:room-compiler:$roomVersion")

    // Retrofit & OkHttp (Networking)
    implementation("com.squareup.retrofit2:retrofit:$retrofitVersion")
    implementation("com.squareup.retrofit2:converter-gson:$retrofitVersion")
    implementation("com.squareup.okhttp3:okhttp:$okhttpVersion")
    implementation("com.squareup.okhttp3:logging-interceptor:$okhttpVersion")

    // Socket.IO (realtime rule:changed push from the backend)
    implementation("io.socket:socket.io-client:2.1.0")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:$coroutinesVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:$coroutinesVersion")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-play-services:$coroutinesVersion")

    // WorkManager
    implementation("androidx.work:work-runtime-ktx:$workVersion")

    // Biometric Authentication
    implementation("androidx.biometric:biometric:1.2.0-alpha05")

    // Security (EncryptedSharedPreferences)
    implementation("androidx.security:security-crypto:1.1.0-alpha06")

    // Firebase
    implementation(platform("com.google.firebase:firebase-bom:32.7.2"))
    implementation("com.google.firebase:firebase-analytics")
    implementation("com.google.firebase:firebase-messaging")

    // Google Play Services (Location)
    implementation("com.google.android.gms:play-services-location:21.1.0")

    // Unit Testing
    testImplementation("junit:junit:4.13.2")
    testImplementation("androidx.test:core:1.5.0")
    testImplementation("org.robolectric:robolectric:4.16.1")
    testImplementation("org.mockito.kotlin:mockito-kotlin:5.2.1")
    // Mockito 5 uses the inline mock maker by default; the core/byte-buddy
    // bumps add JDK 25 class-file support (older ByteBuddy cannot
    // instrument on newer JVMs).
    testImplementation("org.mockito:mockito-core:5.20.0")
    testImplementation("net.bytebuddy:byte-buddy:1.17.7")
    testImplementation("net.bytebuddy:byte-buddy-agent:1.17.7")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:$coroutinesVersion")

    // Android/Compose UI Testing
    androidTestImplementation("androidx.test.ext:junit:1.1.5")
    androidTestImplementation("androidx.test:core:1.5.0")
    androidTestImplementation("androidx.test.espresso:espresso-core:3.5.1")
    androidTestImplementation(platform("androidx.compose:compose-bom:$composeBomVersion"))
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
