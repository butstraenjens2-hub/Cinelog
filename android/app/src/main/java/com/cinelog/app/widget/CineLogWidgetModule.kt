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
    reactContext
      .getSharedPreferences(CineLogWidgetProvider.PREFS, android.content.Context.MODE_PRIVATE)
      .edit()
      .putString(CineLogWidgetProvider.KEY, json)
      .apply()
    CineLogWidgetProvider.requestUpdate(reactContext)
  }
}
