import React from "react";
import { Share, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { PosterCard } from "@/components/media/PosterCard";
import { usePosterMetrics } from "@/components/media/PosterGrid";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/States";
import { FONTS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { openTitle } from "@/lib/cinelog/navigation";
import { encodeListShare } from "@/lib/lists/share.mjs";
import { useLists } from "@/store/lists-store";

export default function ListDetailScreen() {
  const t = useT();
  const styles = useStyles();
  const { posterWidth, gutter } = usePosterMetrics();
  const params = useLocalSearchParams<{ id?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const list = useLists((state) => state.lists.find((entry) => entry.id === id));
  const deleteList = useLists((state) => state.deleteList);
  const toggleItem = useLists((state) => state.toggleItem);

  if (!list) {
    return (
      <Screen>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <EmptyState
          icon="albums-outline"
          title={t("That list is gone")}
          message={t("It may have been deleted on this device.")}
        />
      </Screen>
    );
  }

  return (
    <>
      <SeoHead title={list.name} description={t("A list saved on this device.")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {list.name}
          </Text>
          <Button
            label={t("Share list")}
            icon="share-outline"
            onPress={() => {
              const shared = encodeListShare(list);
              void Share.share({ title: list.name, message: shared.message });
            }}
          />
          <Button
            label={t("Delete list")}
            icon="trash-outline"
            variant="danger"
            size="sm"
            onPress={() => {
              deleteList(list.id);
              router.back();
            }}
          />
        </View>
        {list.items.length === 0 ? (
          <EmptyState
            icon="film-outline"
            title={t("This list is empty")}
            message={t("Add a movie or series from its page.")}
          />
        ) : (
          <View style={[styles.grid, { paddingHorizontal: gutter }]}>
            {list.items.map((item) => (
              <View key={item.id} style={{ width: posterWidth }}>
                <PosterCard item={item} width={posterWidth} onPress={() => openTitle(item)} />
                <Button
                  label={t("Remove")}
                  size="sm"
                  variant="secondary"
                  onPress={() => toggleItem(list.id, item)}
                />
              </View>
            ))}
          </View>
        )}
        <Footer />
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  head: { gap: SPACING.sm, paddingTop: 96, alignItems: "flex-start" },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.md, marginTop: SPACING.lg },
}));
