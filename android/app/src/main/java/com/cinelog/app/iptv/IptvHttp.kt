package com.cinelog.app.iptv

import java.util.concurrent.TimeUnit
import okhttp3.CookieJar
import okhttp3.OkHttpClient
import okhttp3.Request

/**
 * Playlist and playback HTTP. OkHttp's bridge adds Accept-Encoding gzip unless
 * the request already has Range or Accept-Encoding. This client removes gzip,
 * sets VLC's headers, and adds Range only when the player did not set one.
 */
object IptvHttp {
  const val DEFAULT_AGENT = "VLC/3.0.21 LibVLC/3.0.21"

  fun client(userAgent: String, onWire: ((Request) -> Unit)? = null): OkHttpClient {
    val agent = userAgent.trim().ifEmpty { DEFAULT_AGENT }
    val builder = OkHttpClient.Builder()
      .cookieJar(CookieJar.NO_COOKIES)
      .followRedirects(true)
      .followSslRedirects(true)
      .connectTimeout(20, TimeUnit.SECONDS)
      .readTimeout(45, TimeUnit.SECONDS)
      .addInterceptor { chain ->
        val incoming = chain.request()
        val next = incoming.newBuilder()
          .header("User-Agent", agent)
          .header("Accept", "*/*")
          .header("Icy-MetaData", "1")
          .removeHeader("Accept-Encoding")
          .removeHeader("Accept-Language")
          .removeHeader("Cookie")
          .removeHeader("Referer")
          .removeHeader("Origin")
        if (incoming.header("Range") == null) next.header("Range", "bytes=0-")
        chain.proceed(next.build())
      }
    if (onWire != null) {
      builder.addNetworkInterceptor { chain ->
        val response = chain.proceed(chain.request())
        onWire(chain.request())
        response
      }
    }
    return builder.build()
  }
}
