/**
 * Player for a playlist the viewer added.
 * Android tries Media3 first. If that player reports an error, playback
 * continues in libVLC. Choosing the Expo player stays on that player.
 * The legal live player is left unchanged.
 */

import React, { useEffect, useState } from "react";
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

type VlcPlayerProps = {
  url: string;
  userAgent: string;
  startPosition?: number;
  style?: { width: string; aspectRatio: number };
};

const nativeAvailable = Platform.OS === "android" && Boolean(UIManager.getViewManagerConfig?.("IptvPlayerView"));
const vlcAvailable = Platform.OS === "android" && Boolean(UIManager.getViewManagerConfig?.("IptvVlcView"));

const NativeIptvPlayer = nativeAvailable
  ? requireNativeComponent<NativePlayerProps>("IptvPlayerView")
  : null;

const NativeVlcPlayer = vlcAvailable ? requireNativeComponent<VlcPlayerProps>("IptvVlcView") : null;

const frame = { width: "100%" as const, aspectRatio: 16 / 9, backgroundColor: "#000" };

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
  const [forced, setForced] = useState("");

  useEffect(() => {
    setForced("");
  }, [engine, url]);

  const useVlc = (engine === "vlc" || forced === "vlc") && NativeVlcPlayer != null;
  const useMedia3 = !useVlc && engine !== "expo" && engine !== "vlc" && NativeIptvPlayer != null;

  useEffect(() => {
    if (!useMedia3 && !useVlc) return undefined;
    const subscription = DeviceEventEmitter.addListener(
      "iptvPlaybackError",
      (event: { status?: number; message?: string; engine?: string }) => {
        const fromVlc = event?.engine === "vlc";
        if (!fromVlc && useMedia3 && NativeVlcPlayer) {
          setForced("vlc");
          onError?.("Playback failed. Trying libVLC.");
          return;
        }
        if (fromVlc && !useVlc) return;
        const status = Number(event?.status || 0);
        const text = status > 0 ? `Playback: HTTP ${status}` : `Playback: ${event?.message || "Playback failed"}`;
        onError?.(text);
      },
    );
    return () => subscription.remove();
  }, [onError, useMedia3, useVlc]);

  useEffect(() => {
    if ((!useMedia3 && !useVlc) || !onProgress) return undefined;
    const subscription = DeviceEventEmitter.addListener(
      "iptvPlaybackProgress",
      (event: { positionMs?: number; durationMs?: number }) => {
        onProgress(Number(event?.positionMs || 0), Number(event?.durationMs || 0));
      },
    );
    return () => subscription.remove();
  }, [onProgress, useMedia3, useVlc]);

  if (useVlc && NativeVlcPlayer) {
    return (
      <View style={frame}>
        <NativeVlcPlayer
          url={url}
          userAgent={userAgent}
          startPosition={startPositionMs}
          style={{ width: "100%", aspectRatio: 16 / 9 }}
        />
      </View>
    );
  }

  if (useMedia3 && NativeIptvPlayer) {
    return (
      <View style={frame}>
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
