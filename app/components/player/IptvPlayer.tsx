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
  onError,
}: {
  url: string;
  userAgent: string;
  engine: string;
  onError?: (message: string) => void;
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

  if (useMedia3 && NativeIptvPlayer) {
    return (
      <View style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}>
        <NativeIptvPlayer
          url={url}
          userAgent={userAgent}
          sourceKind={plan.source}
          mimeType={plan.mime}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
        />
      </View>
    );
  }

  const headers = playlistHeaders(userAgent);
  return <BroadcastPlayer url={url} headers={headers} />;
}
