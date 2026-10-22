package com.cinelog.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import com.cinelog.app.MainActivity
import com.cinelog.app.R

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
    private val posterIds = intArrayOf(R.id.poster0, R.id.poster1, R.id.poster2, R.id.poster3)

    fun buildViews(context: Context): RemoteViews {
      val views = RemoteViews(context.packageName, R.layout.cinelog_widget_list)
      val items = WidgetSnapshotStore.cards(WidgetSnapshotStore.read(context))
      for (index in 0 until 4) {
        val item = items.getOrNull(index)
        views.setTextViewText(titleIds[index], item?.title ?: "")
        views.setTextViewText(subIds[index], item?.subtitle ?: "")
        val poster = WidgetSnapshotStore.bitmap(item?.posterFile, 220)
        if (poster != null) {
          views.setImageViewBitmap(posterIds[index], poster)
          views.setViewVisibility(posterIds[index], View.VISIBLE)
        } else {
          views.setViewVisibility(posterIds[index], View.GONE)
        }
        val launch = Intent(context, MainActivity::class.java).apply {
          flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
          val path = item?.path ?: ""
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
