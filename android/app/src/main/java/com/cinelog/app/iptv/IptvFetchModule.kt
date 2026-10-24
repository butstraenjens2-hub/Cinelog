package com.cinelog.app.iptv

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import java.io.File
import java.io.IOException
import java.net.URI
import java.util.concurrent.Executors
import java.util.zip.GZIPInputStream
import okhttp3.Call
import okhttp3.Headers
import okhttp3.Request

class IptvFetchModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val io = Executors.newSingleThreadExecutor()
  @Volatile private var active: Call? = null
  @Volatile private var stop = false

  override fun getName(): String = "IptvHttp"

  @ReactMethod
  fun copyText(text: String, promise: Promise) {
    reactContext.runOnUiQueueThread {
      try {
        val clipboard = reactContext.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        clipboard.setPrimaryClip(ClipData.newPlainText("CineLog", text.take(8000)))
        promise.resolve(true)
      } catch (error: Exception) {
        promise.reject("iptv", "Could not copy diagnostics.")
      }
    }
  }

  @ReactMethod
  fun cancel(promise: Promise) {
    stop = true
    active?.cancel()
    promise.resolve(true)
  }

  @ReactMethod
  fun exchange(url: String, userAgent: String, promise: Promise) {
    io.execute {
      var file: File? = null
      val callHolder = arrayOfNulls<Call>(1)
      try {
        stop = false
        val wire = arrayOfNulls<Headers>(1)
        val client = IptvHttp.client(userAgent) { request -> wire[0] = request.headers }
        val call = client.newCall(Request.Builder().url(url).get().build())
        callHolder[0] = call
        active = call
        val response = call.execute()
        response.use { result ->
          file = File(reactContext.cacheDir, "iptv-${System.nanoTime()}.body")
          val target = file ?: return@use
          var total = 0L
          var lastEmit = 0L
          result.body?.byteStream()?.use { input ->
            target.outputStream().use { output ->
              val buffer = ByteArray(8192)
              while (true) {
                if (stop || call.isCanceled()) throw IOException("Cancelled")
                val count = input.read(buffer)
                if (count < 0) break
                output.write(buffer, 0, count)
                total += count
                if (total - lastEmit >= 256L * 1024L) {
                  lastEmit = total
                  emitProgress(total, "download", 0)
                }
              }
            }
          }
          emitProgress(total, "download", 0)
          val inflated = inflateIfGzip(target)
          val ready = inflated.first
          file = ready
          val status = result.code
          val ok = status in 200..299
          val snippet = inflated.second.ifBlank { snippetOf(ready) }
          if (!ok) ready.delete()
          val map = Arguments.createMap()
          map.putBoolean("ok", ok)
          map.putInt("status", status)
          map.putString("message", if (ok) "" else plain(readStart(ready, 2048)))
          map.putString("path", if (ok) ready.absolutePath else "")
          map.putString("preview", readStart(ready, 16))
          map.putString("snippet", snippet)
          map.putString("contentType", result.header("Content-Type") ?: "")
          map.putDouble("bytes", total.toDouble())
          map.putString("scheme", schemeNote(url, result.request.url.toString()))
          map.putMap("requestHeaders", headerMap(wire[0]))
          map.putMap("responseHeaders", headerMap(result.headers))
          promise.resolve(map)
        }
      } catch (error: Exception) {
        file?.delete()
        if (stop || callHolder[0]?.isCanceled() == true || error.message == "Cancelled") {
          promise.reject("iptv", "Cancelled")
        } else {
          promise.reject("iptv", safeError(error))
        }
      } finally {
        if (active === callHolder[0]) active = null
      }
    }
  }

  @ReactMethod
  fun readText(path: String, promise: Promise) {
    io.execute {
      try {
        val file = inflateIfGzip(ownedFile(path)).first
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
      var file: File? = null
      try {
        file = inflateIfGzip(ownedFile(path)).first
        val rows = Arguments.createArray()
        var pending: Extinf? = null
        var first = true
        var live = 0
        var movie = 0
        var series = 0
        var parsed = 0
        file?.bufferedReader()?.useLines { lines ->
          lines.forEach { raw ->
            if (stop) throw IOException("Cancelled")
            var line = raw.trim()
            if (first) {
              line = line.removePrefix("\uFEFF")
              first = false
            }
            if (line.isEmpty()) return@forEach
            if (line.startsWith("#EXTINF")) {
              pending = parseExtinf(line)
              return@forEach
            }
            if (line.startsWith("#")) return@forEach
            if (!line.startsWith("http://", true) && !line.startsWith("https://", true)) return@forEach
            val meta = pending ?: Extinf("Channel", "", "", "")
            pending = null
            val kind = kindFor(line, meta.group)
            when (kind) {
              "movie" -> movie += 1
              "series" -> series += 1
              else -> live += 1
            }
            rows.pushMap(entryMap(rows.size() + 1, meta, line, kind))
            parsed += 1
            if (parsed % 500 == 0) emitProgress(file?.length() ?: 0L, "parsing", parsed)
          }
        }
        val ready = file
        val empty = classifyEmpty(ready)
        if (parsed > 0) emitProgress(ready?.length() ?: 0L, "parsing", parsed)
        val map = Arguments.createMap()
        map.putArray("items", rows)
        map.putInt("live", live)
        map.putInt("movie", movie)
        map.putInt("series", series)
        map.putString("reason", if (parsed == 0) empty.first else "")
        map.putString("snippet", if (parsed == 0) empty.second else snippetOf(ready))
        map.putDouble("bytes", (ready?.length() ?: 0L).toDouble())
        ready?.delete()
        promise.resolve(map)
      } catch (error: Exception) {
        file?.delete()
        if (stop || error.message == "Cancelled") promise.reject("iptv", "Cancelled")
        else promise.reject("iptv", safeError(error))
      }
    }
  }

  private fun inflateIfGzip(file: File): Pair<File, String> {
    val magic = ByteArray(2)
    val count = file.inputStream().use { it.read(magic) }
    if (count < 2 || magic[0] != 0x1f.toByte() || magic[1] != 0x8b.toByte()) return file to ""
    val inflated = File(file.parentFile, "${file.name}.txt")
    try {
      GZIPInputStream(file.inputStream()).use { input ->
        inflated.outputStream().use { output -> input.copyTo(output) }
      }
      file.delete()
      return inflated to ""
    } catch (_: Exception) {
      inflated.delete()
      return file to "gzip binary"
    }
  }

  private fun emitProgress(bytes: Long, phase: String, count: Int) {
    val payload = Arguments.createMap()
    payload.putDouble("bytes", bytes.toDouble())
    payload.putString("phase", phase)
    payload.putInt("count", count)
    reactContext.runOnUiQueueThread {
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("iptvDownloadProgress", payload)
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

  private fun entryMap(id: Int, meta: Extinf, url: String, kind: String): WritableMap {
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
    val re = Regex("""([\w-]+)="([^"]*)"|([\w-]+)='([^']*)'""")
    for (match in re.findAll(line)) {
      if (match.groupValues[1].isNotEmpty()) attrs[match.groupValues[1]] = match.groupValues[2]
      else if (match.groupValues[3].isNotEmpty()) attrs[match.groupValues[3]] = match.groupValues[4]
    }
    val comma = line.lastIndexOf(',')
    val name = if (comma >= 0) line.substring(comma + 1).trim() else ""
    return Extinf(
      name.ifBlank { attrs["tvg-name"] ?: "Channel" },
      attrs["group-title"] ?: "",
      attrs["tvg-id"] ?: "",
      attrs["tvg-logo"] ?: "",
    )
  }

  private fun classifyEmpty(file: File?): Pair<String, String> {
    if (file == null || !file.exists() || file.length() == 0L) return "empty body" to ""
    val snippet = snippetOf(file)
    if (snippet == "gzip binary" || snippet == "binary") return snippet to snippet
    val head = readStart(file, 400).removePrefix("\uFEFF").trimStart()
    val reason = when {
      head.contains("<!doctype html", true) || head.contains("<html", true) -> "HTML login page"
      head.startsWith("#EXTM3U", true) -> "no channel lines"
      else -> "not #EXTM3U"
    }
    return reason to snippet
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

  private fun snippetOf(file: File?): String {
    if (file == null || !file.exists() || file.length() == 0L) return ""
    val raw = ByteArray(220)
    val count = file.inputStream().use { it.read(raw).coerceAtLeast(0) }
    if (count <= 0) return ""
    if (count >= 2 && raw[0] == 0x1f.toByte() && raw[1] == 0x8b.toByte()) return "gzip binary"
    val text = String(raw, 0, count, Charsets.UTF_8)
    if (text.any { it == '\uFFFD' || (it.code < 32 && it != '\n' && it != '\r' && it != '\t') }) return "binary"
    if (text.contains("<!doctype html", true) || text.contains("<html", true)) {
      val title = Regex("<title>([^<]{1,80})</title>", RegexOption.IGNORE_CASE).find(text)?.groupValues?.get(1)?.trim().orEmpty()
      if (title.isNotEmpty() && !title.contains("://") && !title.contains("password=", true)) {
        return "HTML login page: ${title.take(60)}"
      }
      return "HTML login page"
    }
    return text
      .replace(Regex("https?://\\S+"), "[url]")
      .replace(Regex("password=[^\\s&]*", RegexOption.IGNORE_CASE), "password=(hidden)")
      .replace(Regex("username=[^\\s&]*", RegexOption.IGNORE_CASE), "username=(hidden)")
      .replace(Regex("\\s+"), " ")
      .trim()
      .take(200)
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
