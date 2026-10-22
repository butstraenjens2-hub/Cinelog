package com.cinelog.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class WidgetCard(
  val title: String,
  val subtitle: String,
  val path: String,
  val posterFile: String,
)

object WidgetSnapshotStore {
  fun read(context: Context): JSONObject? {
    val raw = context.getSharedPreferences(CineLogWidgetProvider.PREFS, Context.MODE_PRIVATE)
      .getString(CineLogWidgetProvider.KEY, null)
    if (raw.isNullOrBlank()) return null
    return try {
      JSONObject(raw)
    } catch (_: Exception) {
      null
    }
  }

  fun featured(json: JSONObject?): WidgetCard {
    if (json == null) return WidgetCard("CineLog", "Discover what to watch", "", "")
    return WidgetCard(
      json.optString("title", "CineLog"),
      json.optString("subtitle", "Discover what to watch"),
      json.optString("path", ""),
      json.optString("posterFile", ""),
    )
  }

  fun cards(json: JSONObject?): List<WidgetCard> {
    val items = mutableListOf<WidgetCard>()
    val list = json?.optJSONArray("items")
    if (list != null) {
      for (index in 0 until minOf(list.length(), 4)) {
        val row = list.optJSONObject(index) ?: continue
        items += WidgetCard(
          row.optString("title", "CineLog"),
          row.optString("subtitle", ""),
          row.optString("path", ""),
          row.optString("posterFile", ""),
        )
      }
    }
    if (items.isEmpty()) items += WidgetCard("CineLog", "Your watchlist", "", "")
    return items
  }

  fun enrich(context: Context, json: String): String {
    val root = try {
      JSONObject(json)
    } catch (_: Exception) {
      return json
    }
    val featured = cachePoster(context, root.optString("poster"))
    if (featured != null) root.put("posterFile", featured)
    val items = root.optJSONArray("items") ?: return root.toString()
    for (index in 0 until items.length()) {
      val row = items.optJSONObject(index) ?: continue
      val saved = cachePoster(context, row.optString("poster"))
      if (saved != null) row.put("posterFile", saved)
    }
    return root.toString()
  }

  fun bitmap(path: String?, maxPx: Int = 220): Bitmap? {
    if (path.isNullOrBlank()) return null
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(path, bounds)
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null
    var sample = 1
    while (bounds.outWidth / sample > maxPx * 2 || bounds.outHeight / sample > maxPx * 2) {
      sample *= 2
    }
    val decoded = BitmapFactory.decodeFile(path, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return null
    val longest = maxOf(decoded.width, decoded.height)
    if (longest <= maxPx) return decoded
    val scale = maxPx.toFloat() / longest.toFloat()
    val scaled = Bitmap.createScaledBitmap(
      decoded,
      (decoded.width * scale).toInt().coerceAtLeast(1),
      (decoded.height * scale).toInt().coerceAtLeast(1),
      true,
    )
    if (scaled != decoded) decoded.recycle()
    return scaled
  }

  private fun cachePoster(context: Context, url: String?): String? {
    if (url.isNullOrBlank() || !(url.startsWith("https://") || url.startsWith("http://"))) return null
    val dir = File(context.cacheDir, "widget-posters").apply { mkdirs() }
    val file = File(dir, url.hashCode().toUInt().toString(16) + ".img")
    if (file.exists() && file.length() > 0L) return file.absolutePath
    val connection = (URL(url).openConnection() as HttpURLConnection).apply {
      connectTimeout = 8000
      readTimeout = 8000
      instanceFollowRedirects = true
      setRequestProperty("User-Agent", "CineLog/1.0.35")
    }
    try {
      if (connection.responseCode !in 200..299) return null
      connection.inputStream.use { input ->
        file.outputStream().use { output -> input.copyTo(output) }
      }
    } catch (_: Exception) {
      file.delete()
      return null
    } finally {
      connection.disconnect()
    }
    return if (file.length() > 0L) file.absolutePath else null
  }
}
