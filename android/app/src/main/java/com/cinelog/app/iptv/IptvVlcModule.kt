package com.cinelog.app.iptv

import android.net.Uri
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.interfaces.IMedia

/**
 * Reads a playlist with libVLC (LGPL-2.1, linked as the published AAR).
 * This class calls the library API only. It does not include VLC's app source.
 */
class IptvVlcModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val io = Executors.newSingleThreadExecutor()
  @Volatile private var parsing: Media? = null
  @Volatile private var stop = false

  override fun getName(): String = "IptvVlc"

  @ReactMethod
  fun cancel(promise: Promise) {
    stop = true
    reactContext.runOnUiQueueThread {
      parsing?.release()
      parsing = null
    }
    promise.resolve(true)
  }

  @ReactMethod
  fun parsePlaylist(url: String, userAgent: String, promise: Promise) {
    io.execute {
      val agent = userAgent.trim().ifEmpty { IptvHttp.DEFAULT_AGENT }
      var lib: LibVLC? = null
      var media: Media? = null
      try {
        stop = false
        val started = CountDownLatch(1)
        val parsed = CountDownLatch(1)
        val status = intArrayOf(-1)
        val failure = arrayOfNulls<String>(1)
        reactContext.runOnUiQueueThread {
          try {
            val library = LibVLC(reactContext, arrayListOf("--http-user-agent=$agent", "--no-video", "--no-audio"))
            lib = library
            val item = Media(library, Uri.parse(url))
            item.addOption(":http-user-agent=$agent")
            item.setEventListener { event ->
              if (event.type == IMedia.Event.ParsedChanged) {
                status[0] = event.parsedStatus
                parsed.countDown()
              }
            }
            media = item
            parsing = item
            if (!item.parseAsync(IMedia.Parse.ParseNetwork, 60_000)) {
              failure[0] = "libVLC could not open the playlist."
              parsed.countDown()
            }
          } catch (error: Exception) {
            failure[0] = safe(error)
            parsed.countDown()
          } finally {
            started.countDown()
          }
        }
        if (!started.await(8, TimeUnit.SECONDS) || !parsed.await(70, TimeUnit.SECONDS)) {
          promise.reject("iptv", "libVLC timed out")
          return@execute
        }
        if (stop) {
          promise.reject("iptv", "Cancelled")
          return@execute
        }
        if (!failure[0].isNullOrBlank()) {
          promise.reject("iptv", failure[0])
          return@execute
        }
        val rows = Arguments.createArray()
        val current = media
        if (current != null && status[0] == IMedia.ParsedStatus.Done) {
          val list = current.subItems()
          try {
            val total = list.count
            for (index in 0 until total) {
              if (stop) break
              val child = list.getMediaAt(index)
              try {
                val location = child.uri?.toString().orEmpty()
                if (!location.startsWith("http://") && !location.startsWith("https://")) continue
                val name = child.getMeta(IMedia.Meta.Title).orEmpty().ifBlank { "Channel" }
                val group = child.getMeta(IMedia.Meta.Genre).orEmpty()
                  .ifBlank { child.getMeta(IMedia.Meta.Album).orEmpty() }
                  .ifBlank { child.getMeta(IMedia.Meta.Publisher).orEmpty() }
                val logo = child.getMeta(IMedia.Meta.ArtworkURL).orEmpty()
                rows.pushMap(Arguments.createMap().apply {
                  putString("id", (rows.size() + 1).toString())
                  putString("name", name.take(180))
                  putString("group", group.take(120))
                  putString("logo", if (logo.startsWith("http://") || logo.startsWith("https://")) logo else "")
                  putString("url", location)
                })
              } finally {
                child.release()
              }
            }
          } finally {
            list.release()
          }
        }
        val map = Arguments.createMap()
        map.putArray("items", rows)
        map.putString(
          "reason",
          when {
            rows.size() > 0 -> ""
            status[0] == IMedia.ParsedStatus.Timeout -> "libVLC timed out"
            status[0] == IMedia.ParsedStatus.Failed -> "libVLC parse failed"
            else -> "libVLC parsed 0 items"
          },
        )
        promise.resolve(map)
      } catch (error: Exception) {
        if (stop) promise.reject("iptv", "Cancelled") else promise.reject("iptv", safe(error))
      } finally {
        val open = media
        val library = lib
        reactContext.runOnUiQueueThread {
          open?.release()
          library?.release()
          if (parsing === open) parsing = null
        }
      }
    }
  }

  private fun safe(error: Exception): String {
    val text = (error.message ?: "libVLC could not open the playlist.").replace(Regex("https?://\\S+"), "").trim()
    return text.ifBlank { "libVLC could not open the playlist." }.take(180)
  }
}
