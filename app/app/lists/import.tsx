import React, { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles, useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { decodeListShare } from "@/lib/lists/share.mjs";
import { useLists } from "@/store/lists-store";

export default function ImportListScreen() {
  const t = useT();
  const styles = useStyles();
  const { colors } = useTheme();
  const { gutter } = useResponsive();
  const params = useLocalSearchParams<{ payload?: string }>();
  const initial = Array.isArray(params.payload) ? params.payload[0] : params.payload;
  const [text, setText] = useState(initial ? `cinelog://list/${initial}` : "");
  const [message, setMessage] = useState<string | null>(null);
  const createList = useLists((state) => state.createList);

  const importText = () => {
    const decoded = decodeListShare(text);
    if (!decoded) {
      setMessage(t("That share could not be read."));
      return;
    }
    const id = createList(decoded.name, decoded.items);
    router.replace({ pathname: "/lists/[id]", params: { id } } as never);
  };

  return (
    <>
      <SeoHead title={t("Import a list")} description={t("Paste a CineLog share or TMDB links.")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Import a list")}
          </Text>
          <Text style={styles.copy}>
            {t("Paste the shared text. A CineLog link keeps the titles. TMDB movie and series links work too.")}
          </Text>
          <TextInput
            value={text}
            onChangeText={setText}
            multiline
            placeholder={t("Paste a shared list")}
            placeholderTextColor={colors.textMuted}
            style={styles.input}
          />
          <Button label={t("Import")} disabled={!text.trim()} onPress={importText} />
          {message ? <Text style={styles.message}>{message}</Text> : null}
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
    minHeight: 140,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    color: c.textPrimary,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontFamily: FONTS.regular,
    fontSize: 15,
    textAlignVertical: "top",
  },
  message: { fontFamily: FONTS.medium, fontSize: 13, color: c.textPrimary },
}));
