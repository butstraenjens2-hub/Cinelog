import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/States";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { useLists } from "@/store/lists-store";

export default function ListsScreen() {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const lists = useLists((state) => state.lists);
  const createList = useLists((state) => state.createList);
  const [name, setName] = useState("");

  return (
    <>
      <SeoHead title={t("Lists")} description={t("Named lists of movies and series, separate from the watchlist.")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Lists")}
          </Text>
          <Text style={styles.copy}>
            {t("Named lists stay on this device. Share one as text with TMDB links, or import a list someone sent you.")}
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t("List name")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button
            label={t("Create list")}
            disabled={!name.trim()}
            onPress={() => {
              const id = createList(name);
              setName("");
              router.push({ pathname: "/lists/[id]", params: { id } } as never);
            }}
          />
          <Button
            label={t("Import a list")}
            variant="secondary"
            onPress={() => router.push("/lists/import")}
          />
          {lists.length === 0 ? (
            <EmptyState
              icon="albums-outline"
              title={t("No lists yet")}
              message={t("Create one here, or add a title from its page.")}
            />
          ) : (
            lists.map((list) => (
              <Button
                key={list.id}
                label={t("{{name}} · {{count}}", { name: list.name, count: list.items.length })}
                icon="chevron-forward"
                variant="secondary"
                onPress={() => router.push({ pathname: "/lists/[id]", params: { id: list.id } } as never)}
              />
            ))
          )}
        </View>
        <Footer />
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  body: { gap: SPACING.md, paddingTop: 96, alignItems: "flex-start" },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  input: {
    alignSelf: "stretch",
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
  },
}));
