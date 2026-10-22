package com.cinelog.app.widget

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class CineLogWidgetModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "CineLogWidget"

  @ReactMethod
  fun setSnapshot(json: String) {
    Thread {
      val stored = try {
        WidgetSnapshotStore.enrich(reactContext, json)
      } catch (_: Exception) {
        json
      }
      reactContext
        .getSharedPreferences(CineLogWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE)
        .edit()
        .putString(CineLogWidgetProvider.KEY, stored)
        .apply()
      CineLogWidgetProvider.requestUpdate(reactContext)
    }.start()
  }
}
