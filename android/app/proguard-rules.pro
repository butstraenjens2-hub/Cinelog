# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Add any project specific keep options here:

# React Native / Hermes / JSI
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.yoga.** { *; }
-keep class com.facebook.soloader.** { *; }
-keepclassmembers class * { @com.facebook.react.uimanager.annotations.ReactProp *; @com.facebook.react.uimanager.annotations.ReactPropGroup *; }
-keepclassmembers class * { @com.facebook.proguard.annotations.DoNotStrip *; }
-keep @com.facebook.proguard.annotations.DoNotStrip class *

# Expo modules (reflection-based module registry)
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }
-keepclassmembers class * implements expo.modules.kotlin.modules.Module { *; }

# Worklets / gesture handler / screens / webview / svg
-keep class com.swmansion.** { *; }
-keep class com.reactnativecommunity.webview.** { *; }
-keep class com.horcrux.svg.** { *; }

# Firebase / Google
-keep class com.google.firebase.** { *; }
-dontwarn com.google.firebase.**

# Kotlin metadata used by expo-modules-core reflection
-keep class kotlin.Metadata { *; }
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
