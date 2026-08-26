plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.nexretail.catchchallenge"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nexretail.catchchallenge"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        buildConfig = true
    }

    packaging {
        resources.excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.7")
    // WebViewAssetLoader (secure https origin for the bundled site) and
    // addDocumentStartJavaScript (inject the camera shim before page scripts run).
    implementation("androidx.webkit:webkit:1.12.1")
    // USB (UVC) camera over libuvc. This is what makes a USB camera work on devices
    // whose Camera2 HAL never exposes external cameras — at the cost of one system
    // permission dialog per device, which the game's own button triggers.
    implementation("com.herohan:UVCAndroid:1.0.13")
}

/**
 * Copies the built web game into the APK assets.
 *
 * Run `npm run build` in the repository root first; this task then mirrors
 * `dist/` into `assets/web/`. Kept as a plain copy so the Android build never
 * depends on Node being installed on the build machine.
 */
tasks.register<Copy>("syncWebBuild") {
    val distDir = rootProject.file("../dist")
    from(distDir)
    into(layout.projectDirectory.dir("src/main/assets/web"))
    onlyIf { distDir.exists() }
}
