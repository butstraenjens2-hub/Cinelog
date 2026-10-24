import React from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { useT } from "@/i18n";
import { FollowCompanyButton } from "@/components/actions/FollowButton";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { PosterGrid } from "@/components/media/PosterGrid";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Screen } from "@/components/ui/Screen";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { FONTS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { fetchNetworkTitles, fetchStudioTitles } from "@/lib/cinelog/api";
import { newestAndUpcoming } from "@/lib/follows/titles.mjs";
import { openTitle, parseIdParam } from "@/lib/cinelog/navigation";
import type { FollowKind } from "@/store/follows-store";

export default function CompanyScreen() {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const params = useLocalSearchParams<{ id?: string; kind?: string; name?: string }>();
  const companyId = parseIdParam(params.id);
  const kind: FollowKind = params.kind === "network" ? "network" : "studio";
  const companyName =
    (Array.isArray(params.name) ? params.name[0] : params.name)?.trim() ||
    (kind === "network" ? t("Network") : t("Studio"));
  const query = useQuery({
    queryKey: ["company-titles", kind, companyId],
    enabled: Boolean(companyId),
    queryFn: () =>
      kind === "network" ? fetchNetworkTitles(companyId!) : fetchStudioTitles(companyId!),
  });
  const grouped = newestAndUpcoming(query.data ?? []);

  if (!companyId || query.isError) {
    return (
      <Screen scroll={false}>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <ErrorState onRetry={companyId ? () => void query.refetch() : undefined} />
      </Screen>
    );
  }

  return (
    <>
      <SeoHead title={companyName} description={t("Newest and upcoming titles")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Text style={styles.kicker}>
            {kind === "network" ? t("Network") : t("Studio")}
          </Text>
          <Text style={styles.title} accessibilityRole="header">
            {companyName}
          </Text>
          <FollowCompanyButton
            company={{ id: companyId, name: companyName, kind, logo: null }}
          />
          <Text style={styles.copy}>
            {t("Newest and upcoming titles from the catalogue.")}
          </Text>
        </View>
        {query.isLoading ? null : grouped.upcoming.length === 0 && grouped.newest.length === 0 ? (
          <EmptyState
            icon="film-outline"
            title={t("No titles announced")}
            message={t("The catalogue has no dated titles for this page yet.")}
          />
        ) : (
          <>
            <TitleRail title={t("Upcoming")} items={grouped.upcoming} />
            <TitleRail title={t("Newest")} items={grouped.newest} />
          </>
        )}
        <Footer />
      </Screen>
    </>
  );
}

function TitleRail({
  title,
  items,
}: {
  title: string;
  items: ReturnType<typeof newestAndUpcoming>["newest"];
}) {
  const styles = useStyles();
  const { gutter } = useResponsive();
  if (items.length === 0) return null;
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { paddingHorizontal: gutter }]}>{title}</Text>
      <PosterGrid items={items} onSelect={openTitle} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  head: { gap: SPACING.sm, paddingTop: 96, paddingBottom: SPACING.md },
  kicker: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textMuted },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  section: { gap: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.bold, fontSize: 17, color: c.textPrimary },
}));
