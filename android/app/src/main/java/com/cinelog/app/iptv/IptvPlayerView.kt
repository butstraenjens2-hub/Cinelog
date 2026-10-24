package com.cinelog.app.iptv

import android.graphics.Color
import android.view.Gravity
import android.widget.FrameLayout
import android.widget.TextView
import androidx.annotation.OptIn
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.datasource.HttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.extractor.DefaultExtractorsFactory
import androidx.media3.datasource.okhttp.OkHttpDataSource
import androidx.media3.ui.PlayerView
import com.facebook.react.bridge.Arguments
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

@OptIn(UnstableApi::class)
class IptvPlayerView(private val reactContext: ThemedReactContext) : FrameLayout(reactContext) {
  private val playerView = PlayerView(reactContext)
  private val errorText = TextView(reactContext)
  private var player: ExoPlayer? = null
  private var url = ""
  private var userAgent = IptvHttp.DEFAULT_AGENT
  private var kind = "progressive"
  private var mime = ""
  private var signature = ""
  private var startMs = 0L
  private var appliedStart = false
  private val ticker: Runnable = Runnable {
    val exo = player ?: return@Runnable
    val payload = Arguments.createMap()
    payload.putDouble("positionMs", exo.currentPosition.toDouble())
    payload.putDouble("durationMs", exo.duration.coerceAtLeast(0).toDouble())
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit("iptvPlaybackProgress", payload)
    postDelayed(ticker, 1000)
  }

  init {
    setBackgroundColor(Color.BLACK)
    addView(playerView, LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
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

  fun setStreamKind(value: String) {
    if (value.isNotBlank()) kind = value
    open()
  }

  fun setStreamMime(value: String) {
    mime = value
    open()
  }

  fun setStartPosition(value: Double) {
    if (appliedStart) return
    startMs = value.toLong().coerceAtLeast(0)
    val exo = player
    if (exo != null && startMs > 0 && exo.playbackState == Player.STATE_READY) {
      appliedStart = true
      exo.seekTo(startMs)
    }
  }

  private fun open() {
    if (url.isBlank()) return
    val next = "$url|$userAgent|$kind|$mime"
    if (next == signature && player != null) return
    signature = next
    post { start(url, userAgent, kind, mime) }
  }

  private fun start(streamUrl: String, agent: String, sourceKind: String, mimeType: String) {
    errorText.visibility = GONE
    removeCallbacks(ticker)
    player?.release()
    val resumeAt = startMs
    appliedStart = false
    val exo = ExoPlayer.Builder(reactContext).build()
    val dataSource = OkHttpDataSource.Factory(IptvHttp.client(agent)).setUserAgent(agent)
    val item = MediaItem.Builder().setUri(streamUrl).apply {
      if (mimeType.isNotBlank()) setMimeType(mimeType)
    }.build()
    val source = if (sourceKind == "hls") {
      HlsMediaSource.Factory(dataSource).createMediaSource(item)
    } else {
      ProgressiveMediaSource.Factory(dataSource, DefaultExtractorsFactory()).createMediaSource(item)
    }
    exo.setMediaSource(source)
    exo.addListener(object : Player.Listener {
      override fun onPlaybackStateChanged(state: Int) {
        if (state == Player.STATE_READY && resumeAt > 0 && !appliedStart) {
          appliedStart = true
          exo.seekTo(resumeAt)
        }
      }

      override fun onPlayerError(error: PlaybackException) {
        val status = httpStatus(error)
        val message = if (status > 0) "HTTP $status" else "Playback failed"
        errorText.text = message
        errorText.visibility = VISIBLE
        val payload = Arguments.createMap()
        payload.putInt("status", status)
        payload.putString("message", message)
        reactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("iptvPlaybackError", payload)
      }
    })
    exo.prepare()
    exo.playWhenReady = true
    playerView.player = exo
    player = exo
    postDelayed(ticker, 1000)
  }

  private fun httpStatus(error: Throwable): Int {
    var current: Throwable? = error
    while (current != null) {
      if (current is HttpDataSource.InvalidResponseCodeException) return current.responseCode
      current = current.cause
    }
    return 0
  }

  override fun onDetachedFromWindow() {
    removeCallbacks(ticker)
    player?.release()
    player = null
    signature = ""
    super.onDetachedFromWindow()
  }
}

@OptIn(UnstableApi::class)
class IptvPlayerManager : SimpleViewManager<IptvPlayerView>() {
  override fun getName(): String = "IptvPlayerView"

  override fun createViewInstance(reactContext: ThemedReactContext): IptvPlayerView {
    return IptvPlayerView(reactContext)
  }

  @ReactProp(name = "url")
  fun setUrl(view: IptvPlayerView, url: String?) {
    view.setStreamUrl(url ?: "")
  }

  @ReactProp(name = "userAgent")
  fun setUserAgent(view: IptvPlayerView, userAgent: String?) {
    view.setStreamAgent(userAgent ?: "")
  }

  @ReactProp(name = "sourceKind")
  fun setSourceKind(view: IptvPlayerView, sourceKind: String?) {
    view.setStreamKind(sourceKind ?: "")
  }

  @ReactProp(name = "mimeType")
  fun setMimeType(view: IptvPlayerView, mimeType: String?) {
    view.setStreamMime(mimeType ?: "")
  }

  @ReactProp(name = "startPosition")
  fun setStartPosition(view: IptvPlayerView, startPosition: Double) {
    view.setStartPosition(startPosition)
  }

  override fun onDropViewInstance(view: IptvPlayerView) {
    view.setStreamUrl("")
    super.onDropViewInstance(view)
  }
}
