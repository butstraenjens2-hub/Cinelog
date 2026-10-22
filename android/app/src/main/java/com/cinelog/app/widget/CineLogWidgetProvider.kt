package com.cinelog.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.cinelog.app.MainActivity
import com.cinelog.app.R
import org.json.JSONObject

class CineLogWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(
    context: Context,
    appWidgetManager: AppWidgetManager,
    appWidgetIds: IntArray,
  ) {
    for (id in appWidgetIds) {
      appWidgetManager.updateAppWidget(id, buildViews(context))
    }
  }

  companion object {
    fun requestUpdate(context: Context) {
      broadcastUpdate(context, CineLogWidgetProvider::class.java)
      broadcastUpdate(context, CineLogWatchlistWidgetProvider::class.java)
    }

    private fun broadcastUpdate(context: Context, provider: Class<out AppWidgetProvider>) {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, provider))
      if (ids.isEmpty()) return
      val intent = Intent(context, provider).apply {
        action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
        putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
      }
      context.sendBroadcast(intent)
    }

    fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.cinelog_widget)
      val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, null)
      var title = "CineLog"
      var subtitle = "Discover what to watch"
      var path = ""
      if (!raw.isNullOrBlank()) {
        try {
          val json = JSONObject(raw)
          title = json.optString("title", title)
          subtitle = json.optString("subtitle", subtitle)
          path = json.optString("path", "")
        } catch (_: Exception) {
          // Keep the default copy if the snapshot is unreadable.
        }
      }
      views.setTextViewText(R.id.widget_title, title)
      views.setTextViewText(R.id.widget_subtitle, subtitle)
      val launch = Intent(context, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        if (path.startsWith("/movie/") || path.startsWith("/series/")) {
          data = Uri.parse("cinelog://$path")
        }
      }
      val pending = PendingIntent.getActivity(
        context,
        0,
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
      views.setOnClickPendingIntent(R.id.widget_root, pending)
      return views
    }

    const val PREFS = "cinelog_widget"
    const val KEY = "snapshot"
  }
}
