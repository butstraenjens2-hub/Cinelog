package com.cinelog.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import com.cinelog.app.MainActivity
import com.cinelog.app.R
import org.json.JSONObject

/**
 * Larger home-screen widget: up to four watchlist titles.
 * The compact "up next" widget stays in CineLogWidgetProvider.
 */
class CineLogWatchlistWidgetProvider : AppWidgetProvider() {
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
    private val titleIds = intArrayOf(R.id.row0_title, R.id.row1_title, R.id.row2_title, R.id.row3_title)
    private val subIds = intArrayOf(R.id.row0_sub, R.id.row1_sub, R.id.row2_sub, R.id.row3_sub)
    private val rowIds = intArrayOf(R.id.row0, R.id.row1, R.id.row2, R.id.row3)

    fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.cinelog_widget_list)
      val raw = context.getSharedPreferences(CineLogWidgetProvider.PREFS, Context.MODE_PRIVATE)
        .getString(CineLogWidgetProvider.KEY, null)
      val items = mutableListOf<Triple<String, String, String>>()
      if (!raw.isNullOrBlank()) {
        try {
          val json = JSONObject(raw)
          val list = json.optJSONArray("items")
          if (list != null) {
            for (index in 0 until minOf(list.length(), 4)) {
              val row = list.optJSONObject(index) ?: continue
              items += Triple(
                row.optString("title", "CineLog"),
                row.optString("subtitle", ""),
                row.optString("path", ""),
              )
            }
          }
        } catch (_: Exception) {
          // Keep the empty state when the snapshot cannot be read.
        }
      }
      if (items.isEmpty()) {
        items += Triple("CineLog", "Your watchlist", "")
      }
      for (index in 0 until 4) {
        val item = items.getOrNull(index)
        views.setTextViewText(titleIds[index], item?.first ?: "")
        views.setTextViewText(subIds[index], item?.second ?: "")
        val launch = Intent(context, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
          val path = item?.third ?: ""
          if (path.startsWith("/movie/") || path.startsWith("/series/")) {
            data = Uri.parse("cinelog://$path")
          }
        }
        val pending = PendingIntent.getActivity(
          context,
          20 + index,
          launch,
          PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        views.setOnClickPendingIntent(rowIds[index], pending)
      }
      return views
    }
  }
}
