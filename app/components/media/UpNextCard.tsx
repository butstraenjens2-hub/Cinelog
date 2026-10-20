/**
 * CineLog — "Up next" card: the next episode to watch for a followed series,
 * with a one-tap "mark watched" action.
 */

import React from "react";
import { View } from "react-native";

import { useT } from "@/i18n";
import { PosterCard } from "@/components/media/PosterCard";
import { IconButton } from "@/components/ui/Button";
import { SPACING } from "@/constants/theme";
import { episodeCode, type UpNextEntry } from "@/lib/cinelog/upNext";

export interface UpNextCardProps {
  entry: UpNextEntry;
  width: number;
  onOpen: (entry: UpNextEntry) => void;
  onMarkWatched: (entry: UpNextEntry) => void;
}

function UpNextCardComponent({ entry, width, onOpen, onMarkWatched }: UpNextCardProps) {
  const t = useT();
  const code = episodeCode(entry.seasonNumber, entry.episodeNumber);
  return (
    <View style={{ width }}>
      <PosterCard
        item={entry.series}
        width={width}
        subtitle={code}
        onPress={() => onOpen(entry)}
      />
      <View style={{ position: "absolute", top: SPACING.sm, right: SPACING.sm }}>
        <IconButton
          icon="checkmark"
          label={t("Mark {{code}} of {{title}} as watched", {
            code,
            title: entry.series.title,
          })}
          onPress={() => onMarkWatched(entry)}
          variant="primary"
          size={32}
          onArtwork
        />
      </View>
    </View>
  );
}

export const UpNextCard = React.memo(UpNextCardComponent);
