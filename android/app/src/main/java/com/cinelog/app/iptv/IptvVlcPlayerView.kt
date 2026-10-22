package com.cinelog.app.iptv

import android.graphics.Color
import android.net.Uri
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import org.videolan.libvlc.LibVLC
import org.videolan.libvlc.Media
import org.videolan.libvlc.MediaPlayer
import org.videolan.libvlc.util.VLCVideoLayout

/**
 * IPTV playback through libVLC. The legal live player is a different view.
 * The library is LGPL-2.1 and is linked from the published AAR.
 */
class IptvVlcPlayerView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
  private val video = VLCVideoLayout(reactContext)
  private val errorText = TextView(reactContext)
  private var lib: LibVLC? = null
  private var player: MediaPlayer? = null
  private var url = ""
  private var userAgent = IptvHttp.DEFAULT_AGENT
  private var startMs = 0L
  private var appliedStart = false
  private var signature = ""
  private var lastProgress = 0L

  init {
    setBackgroundColor(Color.BLACK)
    addView(video, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
    errorText.setTextColor(Color.WHITE)
    errorText.setBackgroundColor(0xCC000000.toInt())
    errorText.setPadding(24, 16, 24, 16)
    errorText.visibility = GONE
    addView(errorText, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.WRAP_CONTENT, Gravity.BOTTOM))
  }

  fun setStreamUrl(value: String) {
    url = value
    open()
  }

  fun setStreamAgent(value: String) {
    if (value.isNotBlank()) userAgent = value
    open()
  }

  fun setStartPosition(value: Double) {
    if (appliedStart) return
    startMs = value.toLong().coerceAtLeast(0)
  }

  private fun open() {
    if (url.isBlank()) {
      releasePlayer()
      return
    }
    val next = "$url|$userAgent"
    if (next == signature && player != null) return
    signature = next
    post { start(url, userAgent) }
  }

  private fun start(streamUrl: String, agent: String) {
    errorText.visibility = GONE
    releasePlayer()
    appliedStart = false
    val resumeAt = startMs
    val library = LibVLC(reactContext, arrayListOf("--http-user-agent=$agent", "--network-caching=1500"))
    val mp = MediaPlayer(library)
    mp.attachViews(video, null, false, false)
    mp.setEventListener { event ->
      if (event.type == MediaPlayer.Event.Playing && resumeAt > 0 && !appliedStart) {
        appliedStart = true
        mp.setTime(resumeAt)
      }
      if (event.type == MediaPlayer.Event.TimeChanged) {
        val now = android.os.SystemClock.uptimeMillis()
        if (now - lastProgress > 1000) {
          lastProgress = now
          emitProgress(mp.time, mp.length)
        }
      }
      if (event.type == MediaPlayer.Event.EncounteredError) {
        errorText.text = "Playback failed"
        errorText.visibility = VISIBLE
        val payload = Arguments.createMap()
        payload.putInt("status", 0)
        payload.putString("message", "Playback failed")
        payload.putString("engine", "vlc")
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("iptvPlaybackError", payload)
      }
    }
    val media = Media(library, Uri.parse(streamUrl))
    media.addOption(":http-user-agent=$agent")
    media.addOption(":network-caching=1500")
    mp.media = media
    media.release()
    mp.play()
    lib = library
    player = mp
  }

  private fun emitProgress(positionMs: Long, durationMs: Long) {
    val payload = Arguments.createMap()
    payload.putDouble("positionMs", positionMs.toDouble())
    payload.putDouble("durationMs", durationMs.coerceAtLeast(0).toDouble())
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("iptvPlaybackProgress", payload)
  }

  fun releasePlayer() {
    player?.stop()
    player?.detachViews()
    player?.release()
    player = null
    lib?.release()
    lib = null
    signature = ""
  }

  override fun onDetachedFromWindow() {
    releasePlayer()
    super.onDetachedFromWindow()
  }
}

class IptvVlcPlayerManager : SimpleViewManager<IptvVlcPlayerView>() {
  override fun getName(): String = "IptvVlcView"

  override fun createViewInstance(reactContext: ThemedReactContext): IptvVlcPlayerView {
    return IptvVlcPlayerView(reactContext)
  }

  @ReactProp(name = "url")
  fun setUrl(view: IptvVlcPlayerView, url: String?) {
    view.setStreamUrl(url ?: "")
  }

  @ReactProp(name = "userAgent")
  fun setUserAgent(view: IptvVlcPlayerView, userAgent: String?) {
    view.setStreamAgent(userAgent ?: "")
  }

  @ReactProp(name = "startPosition")
  fun setStartPosition(view: IptvVlcPlayerView, startPosition: Double) {
    view.setStartPosition(startPosition)
  }

  override fun onDropViewInstance(view: IptvVlcPlayerView) {
    view.setStreamUrl("")
    super.onDropViewInstance(view)
  }
}
