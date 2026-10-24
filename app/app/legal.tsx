import React from "react";
import { Text, View } from "react-native";
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

const SECTIONS: { heading: string; body: string }[] = [
  {
    heading: "About CineLog",
    body: "CineLog is a discovery and tracking app for movies and series. It helps you find titles, build a watchlist, rate what you've seen and keep track of where you are in a show. CineLog does not host, stream or distribute video files itself and does not claim ownership of third-party media.",
  },
  {
    heading: "How playback works",
    body: "When you press play, CineLog may open embedded third-party playback providers. Availability, stream quality, subtitle tracks and playback controls can vary by provider, region and device. If a provider is unavailable, CineLog can try fallback providers.",
  },
  {
    heading: "Third-party services",
    body: "CineLog uses TMDB for titles and artwork, YouTube for trailers, and the servers and accounts you choose to connect. The privacy policy lists each service and what stays on the device.",
  },
  {
    heading: "Content and attribution",
    body: "Titles, artwork, cast information, ratings and trailers come from The Movie Database (TMDB). CineLog uses the TMDB API but is not endorsed or certified by TMDB. All artwork and metadata remain the property of their respective rights holders.",
  },
  {
    heading: "Your media servers",
    body: "A Jellyfin or Emby connection is optional and talks only to the server you configure. The access token is stored in the device keystore. Playback is a direct stream of a file already on that server. CineLog does not ship indexers, download clients, or add-on installers.",
  },
  {
    heading: "Trailers",
    body: "Trailers are played through YouTube's official embedded player. Playback is subject to YouTube's terms of service and privacy policy.",
  },
  {
    heading: "Your data",
    body: "Your watchlist, favourites, ratings, viewing history and episode progress are stored on your device. When you sign in, they may also be synced to your account so they can follow you between devices. You can clear history and delete profile-level data from Settings.",
  },
  {
    heading: "Data categories we process",
    body: "The app stores your library, settings, and the keys you save on this device. It does not run an advertising or analytics SDK. The privacy policy is the full notice.",
  },
  {
    heading: "Why we process data",
    body: "Data is processed to provide core app features, restore your library and progress, secure accounts, troubleshoot reliability issues, reduce abuse and improve product quality. Processing is limited to what is needed for these purposes.",
  },
  {
    heading: "Retention and deletion",
    body: "Library and progress records are retained while your account remains active or until you delete them. Operational logs are retained for a limited period for security and reliability. You can request account deletion where supported by your platform account and applicable law.",
  },
  {
    heading: "Your choices and controls",
    body: "You can edit watch status, ratings and saved lists at any time. You can remove entries from Continue Watching, clear history and manage notification preferences in Settings. On compatible devices, playback target options like AirPlay or Cast depend on browser, OS and provider support.",
  },
  {
    heading: "Regional and legal compliance",
    body: "Depending on your location, you may have rights to access, correct, export or delete personal data. CineLog aims to support applicable privacy requirements including transparency, minimization and user control principles.",
  },
  {
    heading: "Acceptable use",
    body: "You agree not to misuse CineLog, interfere with service integrity, attempt unauthorized access, bypass security controls or violate rights of content owners and service providers. Features may be restricted or suspended in case of abuse.",
  },
  {
    heading: "No warranty of availability",
    body: "CineLog is provided as-is. Third-party APIs, metadata and playback providers may change, degrade or become unavailable without notice. We cannot guarantee uninterrupted playback, permanent provider availability or universal device compatibility.",
  },
  {
    heading: "Policy updates",
    body: "This notice can be updated when features, providers or legal requirements change. Material updates may be reflected in app release notes or legal screen revisions.",
  },
  {
    heading: "Contact",
    body: "Questions about your data or this notice can be raised through the support channel listed in the app store entry for CineLog.",
  },
];

export default function LegalScreen() {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();

  return (
    <>
      <SeoHead
        title={t("Legal & Privacy")}
        description="How CineLog handles your data, and the sources behind its movie and series information."
      />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />

        <View style={[styles.body, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Legal & Privacy")}
          </Text>
          <Button
            label={t("Privacy policy")}
            icon="chevron-forward"
            variant="secondary"
            size="sm"
            onPress={() => router.push("/privacy")}
          />
          {SECTIONS.map((section) => (
            <View key={section.heading} style={styles.section}>
              <Text style={styles.heading} accessibilityRole="header">
                {section.heading}
              </Text>
              <Text style={styles.paragraph}>{t(section.body)}</Text>
            </View>
          ))}
        </View>

        <Footer />
      </Screen>
    </>
  );
}

const useStyles = makeStyles((c, t) => ({
  body: {
    gap: SPACING.xl,
    paddingTop: SPACING.xxxl,
    maxWidth: 720,
  },
  title: {
    fontFamily: FONTS.extrabold,
    fontSize: 30,
    letterSpacing: -0.8,
    color: c.textPrimary,
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
