/**
 * Shared player for broadcaster HLS and a viewer's own playlist.
 * Android uses a texture view so the picture stays visible inside a scroll view.
 */

import React, { useState } from "react";
import { Platform, Text, View } from "react-native";
import { useVideoPlayer, VideoView } from "expo-video";

import { useT } from "@/i18n";
import { FONTS } from "@/constants/theme";

const USER_AGENT =
  "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export function BroadcastPlayer({
  url,
  headers,
}: {
  url: string;
  headers?: Record<string, string>;
}) {
  const t = useT();
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(
    {
      uri: url,
      contentType: url.includes(".m3u8") ? "hls" : "auto",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "*/*",
        ...headers,
      },
    },
    (instance) => {
      instance.loop = false;
      instance.play();
    },
  );

  React.useEffect(() => {
    const status = player.addListener("statusChange", ({ status }) => {
      if (status === "error") setFailed(true);
    });
    return () => status.remove();
  }, [player]);

  return (
    <View style={{ width: "100%", gap: 8 }}>
      <VideoView
        player={player}
        style={{ width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" }}
        nativeControls
        contentFit="contain"
        surfaceType={Platform.OS === "android" ? "textureView" : undefined}
      />
      {failed ? (
        <Text style={{ fontFamily: FONTS.medium, fontSize: 13, color: "#E23D3D" }}>
          {t("The stream did not start.")}
        </Text>
      ) : null}
    </View>
  );
}
