/**
 * Offline privacy policy. The text is bundled with the app.
 * The GitHub link opens the same document in the repository.
 */

import React, { useState } from "react";
import { Linking, Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { FONTS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import {
  PRIVACY_GITHUB_URL,
  PRIVACY_POLICY,
} from "@/content/privacy-policy.mjs";
import { useSettings } from "@/store/settings-store";

type PolicyLanguage = "en" | "nl";

export default function PrivacyScreen() {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const appLanguage = useSettings((state) => state.language);
  const [language, setLanguage] = useState<PolicyLanguage>(appLanguage === "nl" ? "nl" : "en");
  const policy = PRIVACY_POLICY[language];

  return (
    <>
      <SeoHead title={policy.title} description={policy.intro} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {policy.title}
          </Text>
          <View style={styles.row}>
            <Button
              label="English"
              size="sm"
              variant={language === "en" ? "primary" : "secondary"}
              onPress={() => setLanguage("en")}
            />
            <Button
              label="Nederlands"
              size="sm"
              variant={language === "nl" ? "primary" : "secondary"}
              onPress={() => setLanguage("nl")}
            />
          </View>
          <Text style={styles.paragraph}>{policy.intro}</Text>
          {policy.sections.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading} accessibilityRole="header">
                {section.heading}
              </Text>
              {section.paragraphs.map((paragraph) => (
                <Text key={paragraph.slice(0, 48)} style={styles.paragraph}>
                  {paragraph}
                </Text>
              ))}
            </View>
          ))}
          <Button
            label={t("Read this policy on GitHub")}
            icon="open-outline"
            variant="secondary"
            size="sm"
            onPress={() => void Linking.openURL(PRIVACY_GITHUB_URL)}
          />
        </View>
        <Footer />
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c) => ({
  body: {
    gap: SPACING.lg,
    paddingTop: SPACING.xxxl,
    maxWidth: 720,
  },
  title: {
    fontFamily: FONTS.extrabold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: c.textPrimary,
  },
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
  },
  section: {
    gap: SPACING.sm,
  },
  heading: {
    fontFamily: FONTS.bold,
    fontSize: 17,
    color: c.textPrimary,
  },
  paragraph: {
    fontFamily: FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: c.textSecondary,
  },
}));
