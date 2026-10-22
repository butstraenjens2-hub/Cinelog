package com.cinelog.app.iptv

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import java.io.File
import java.net.URI
import java.util.concurrent.Executors
import okhttp3.Headers
import okhttp3.Request

class IptvFetchModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val io = Executors.newSingleThreadExecutor()

  override fun getName(): String = "IptvHttp"

  @ReactMethod
  fun exchange(url: String, userAgent: String, promise: Promise) {
    io.execute {
      try {
        val wire = arrayOfNulls<Headers>(1)
        val client = IptvHttp.client(userAgent) { request -> wire[0] = request.headers }
        val response = client.newCall(Request.Builder().url(url).get().build()).execute()
        response.use { result ->
          val file = File(reactContext.cacheDir, "iptv-${System.nanoTime()}.body")
          result.body?.byteStream()?.use { input ->
            file.outputStream().use { output -> input.copyTo(output) }
          }
          val status = result.code
          val ok = status in 200..299
          val map = Arguments.createMap()
          map.putBoolean("ok", ok)
          map.putInt("status", status)
          map.putString("message", if (ok) "" else plain(readStart(file, 2048)))
          map.putString("path", file.absolutePath)
          map.putString("preview", readStart(file, 16))
          map.putString("scheme", schemeNote(url, result.request.url.toString()))
          map.putMap("requestHeaders", headerMap(wire[0]))
          map.putMap("responseHeaders", headerMap(result.headers))
          promise.resolve(map)
        }
      } catch (error: Exception) {
        promise.reject("iptv", safeError(error))
      }
    }
  }

  @ReactMethod
  fun readText(path: String, promise: Promise) {
    io.execute {
      try {
        val file = ownedFile(path)
        if (file.length() > 48L * 1024L * 1024L) {
          promise.reject("iptv", "The response is too large to read as text.")
          return@execute
        }
        val text = file.readText()
        file.delete()
        promise.resolve(text)
      } catch (error: Exception) {
        promise.reject("iptv", safeError(error))
      }
    }
  }

  @ReactMethod
  fun parseM3u(path: String, promise: Promise) {
    io.execute {
      try {
        val file = ownedFile(path)
        val rows = Arguments.createArray()
        var pending: Extinf? = null
        file.bufferedReader().useLines { lines ->
          lines.forEach { raw ->
            val line = raw.trim()
            if (line.isEmpty()) return@forEach
            if (line.startsWith("#EXTINF")) {
              pending = parseExtinf(line)
              return@forEach
            }
            if (line.startsWith("#")) return@forEach
            if (!line.startsWith("http://") && !line.startsWith("https://")) return@forEach
            val meta = pending ?: Extinf("Channel", "", "", "")
            pending = null
            rows.pushMap(entryMap(rows.size() + 1, meta, line))
          }
        }
        file.delete()
        promise.resolve(rows)
      } catch (error: Exception) {
        promise.reject("iptv", safeError(error))
      }
    }
  }

  private fun ownedFile(path: String): File {
    val file = File(path)
    val root = reactContext.cacheDir.canonicalFile
    val canonical = file.canonicalFile
    if (!canonical.path.startsWith(root.path) || !canonical.isFile) {
      throw IllegalArgumentException("The playlist file is missing.")
    }
    return canonical
  }

  private fun entryMap(id: Int, meta: Extinf, url: String): WritableMap {
    val kind = kindFor(url, meta.group)
    return Arguments.createMap().apply {
      putString("id", id.toString())
      putString("name", meta.name)
      putString("group", meta.group)
      putString("tvgId", meta.tvgId)
      putString("logo", meta.logo)
      putString("url", url)
      putString("kind", kind)
    }
  }

  private fun kindFor(url: String, group: String): String {
    val blob = "$url $group".lowercase()
    if (Regex("/series/|/serie/|\\bseries\\b").containsMatchIn(blob)) return "series"
    if (Regex("/movie/|/vod/|\\bmovies?\\b|\\bvod\\b").containsMatchIn(blob)) return "movie"
    return "live"
  }

  private fun parseExtinf(line: String): Extinf {
    val attrs = linkedMapOf<String, String>()
    val re = Regex("([\\w-]+)=\"([^\"]*)\"")
    for (match in re.findAll(line)) attrs[match.groupValues[1]] = match.groupValues[2]
    val comma = line.lastIndexOf(',')
    val name = if (comma >= 0) line.substring(comma + 1).trim() else ""
    return Extinf(
      name.ifBlank { attrs["tvg-name"] ?: "Channel" },
      attrs["group-title"] ?: "",
      attrs["tvg-id"] ?: "",
      attrs["tvg-logo"] ?: "",
    )
  }

  private fun headerMap(headers: Headers?): WritableMap {
    val map = Arguments.createMap()
    if (headers == null) return map
    for (index in 0 until headers.size) {
      val name = headers.name(index)
      if (name.equals("Host", true)) continue
      val hidden = name.equals("Location", true) || name.equals("Set-Cookie", true) || name.equals("Cookie", true)
      map.putString(name, if (hidden) "(hidden)" else headers.value(index).take(180))
    }
    return map
  }

  private fun readStart(file: File, limit: Int): String {
    if (!file.exists() || file.length() == 0L) return ""
    file.inputStream().use { input ->
      val buffer = ByteArray(limit)
      val count = input.read(buffer)
      if (count <= 0) return ""
      return String(buffer, 0, count, Charsets.UTF_8)
    }
  }

  private fun plain(body: String): String {
    val titled = Regex("<title>([^<]{1,180})</title>", RegexOption.IGNORE_CASE).find(body)
    val text = titled?.groupValues?.get(1) ?: body.replace(Regex("<[^>]+>"), " ")
    return text.replace(Regex("\\s+"), " ").trim().take(180)
  }

  private fun schemeNote(original: String, finalUrl: String): String {
    val from = runCatching { URI(original).scheme }.getOrNull().orEmpty()
    val to = runCatching { URI(finalUrl).scheme }.getOrNull().orEmpty()
    if (from.isEmpty() || to.isEmpty()) return ""
    return if (from == to) "Scheme stayed $from." else "Scheme changed from $from to $to."
  }

  private fun safeError(error: Exception): String {
    val text = (error.message ?: "The request failed.").replace(Regex("https?://\\S+"), "").trim()
    return text.ifBlank { "The request failed." }.take(180)
  }

  private data class Extinf(val name: String, val group: String, val tvgId: String, val logo: String)
}
