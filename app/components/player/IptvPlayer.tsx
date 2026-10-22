/**
 * Player for a playlist the viewer added.
 * Android uses Media3 directly so MPEG-TS, HLS, MP4 and MKV share the VLC headers.
 * The legal live player is left unchanged.
 */

import React, { useEffect } from "react";
import { DeviceEventEmitter, Platform, requireNativeComponent, UIManager, View } from "react-native";

import { BroadcastPlayer } from "@/components/player/BroadcastPlayer";
import { playbackPlan } from "@/lib/iptv/playback.mjs";
import { playlistHeaders } from "@/lib/iptv/http.mjs";

type NativePlayerProps = {
  url: string;
  userAgent: string;
  sourceKind: string;
  mimeType: string;
  startPosition?: number;
  style?: { width: string; aspectRatio: number };
};

const nativeAvailable = Platform.OS === "android" && Boolean(UIManager.getViewManagerConfig?.("IptvPlayerView"));

const NativeIptvPlayer = nativeAvailable
  ? requireNativeComponent<NativePlayerProps>("IptvPlayerView")
  : null;

export function IptvPlayer({
  url,
  userAgent,
  engine,
  startPositionMs = 0,
  onError,
  onProgress,
}: {
  url: string;
  userAgent: string;
  engine: string;
  startPositionMs?: number;
  onError?: (message: string) => void;
  onProgress?: (positionMs: number, durationMs: number) => void;
}) {
  const plan = playbackPlan(url);
  const useMedia3 = engine !== "expo" && NativeIptvPlayer != null;

  useEffect(() => {
    if (!useMedia3) return undefined;
    const subscription = DeviceEventEmitter.addListener(
      "iptvPlaybackError",
      (event: { status?: number; message?: string }) => {
        const status = Number(event?.status || 0);
        const text = status > 0 ? `Playback: HTTP ${status}` : `Playback: ${event?.message || "Playback failed"}`;
        onError?.(text);
      },
    );
    return () => subscription.remove();
  }, [onError, useMedia3]);

  useEffect(() => {
    if (!useMedia3 || !onProgress) return undefined;
    const subscription = DeviceEventEmitter.addListener(
      "iptvPlaybackProgress",
      (event: { positionMs?: number; durationMs?: number }) => {
        onProgress(Number(event?.positionMs || 0), Number(event?.durationMs || 0));
      },
    );
    return () => subscription.remove();
  }, [onProgress, useMedia3]);

  if (useMedia3 && NativeIptvPlayer) {
    return (
      <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}>
        <NativeIptvPlayer
          url={url}
          userAgent={userAgent}
          sourceKind={plan.source}
          mimeType={plan.mime}
          startPosition={startPositionMs}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
        />
      </View>
    );
  }

  const headers = playlistHeaders(userAgent);
  return <BroadcastPlayer url={url} headers={headers} />;
}
