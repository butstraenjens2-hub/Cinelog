import React from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useQueries } from "@tanstack/react-query";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { PosterGrid } from "@/components/media/PosterGrid";
import { FloatingBackButton } from "@/components/navigation/MobileHeader";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Screen";
import { EmptyState } from "@/components/ui/States";
import { FONTS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { fetchNetworkTitles, fetchPerson, fetchStudioTitles } from "@/lib/cinelog/api";
import { newestAndUpcoming } from "@/lib/follows/titles.mjs";
import { openCompany, openPerson, openTitle } from "@/lib/cinelog/navigation";
import type { MediaSummary } from "@/lib/cinelog/types";
import { useFollows, type FollowedCompany, type FollowedPerson } from "@/store/follows-store";

export default function FollowedScreen() {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const people = useFollows((state) => state.people);
  const companies = useFollows((state) => state.companies);
  const personQueries = useQueries({
    queries: people.map((person) => ({
      queryKey: ["followed-person", person.id],
      queryFn: () => fetchPerson(person.id),
    })),
  });
  const companyQueries = useQueries({
    queries: companies.map((company) => ({
      queryKey: ["followed-company", company.kind, company.id],
      queryFn: () =>
        company.kind === "network"
          ? fetchNetworkTitles(company.id)
          : fetchStudioTitles(company.id),
    })),
  });

  return (
    <>
      <SeoHead title={t("Followed")} description={t("Actors, studios and networks you follow.")} />
      <Screen reserveBottomNav>
        <FloatingBackButton onPress={() => router.back()} gutter={gutter} />
        <View style={[styles.head, { paddingHorizontal: gutter }]}>
          <Text style={styles.title} accessibilityRole="header">
            {t("Followed")}
          </Text>
          <Text style={styles.copy}>
            {t("Actors, studios and networks you follow, with their newest titles.")}
          </Text>
        </View>
        {people.length === 0 && companies.length === 0 ? (
          <EmptyState
            icon="star-outline"
            title={t("Nothing followed yet")}
            message={t("Open a person or a studio on a title and tap Follow.")}
          />
        ) : null}
        {people.map((person, index) => (
          <FollowedPersonBlock
            key={person.id}
            person={person}
            titles={personQueries[index]?.data?.filmography ?? personQueries[index]?.data?.knownFor ?? []}
          />
        ))}
        {companies.map((company, index) => (
          <FollowedCompanyBlock
            key={`${company.kind}:${company.id}`}
            company={company}
            titles={companyQueries[index]?.data ?? []}
          />
        ))}
        <Footer />
      </Screen>
    </>
  );
}

function FollowedPersonBlock({
  person,
  titles,
}: {
  person: FollowedPerson;
  titles: MediaSummary[];
}) {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const grouped = newestAndUpcoming(titles);
  return (
    <View style={styles.block}>
      <View style={[styles.row, { paddingHorizontal: gutter }]}>
        <Text style={styles.name}>{person.name}</Text>
        <Button label={t("Open")} size="sm" variant="secondary" onPress={() => openPerson(person.id)} />
      </View>
      <TitleGroup title={t("Upcoming")} items={grouped.upcoming} />
      <TitleGroup title={t("Newest")} items={grouped.newest} />
    </View>
  );
}

function FollowedCompanyBlock({
  company,
  titles,
}: {
  company: FollowedCompany;
  titles: MediaSummary[];
}) {
  const t = useT();
  const styles = useStyles();
  const { gutter } = useResponsive();
  const grouped = newestAndUpcoming(titles);
  return (
    <View style={styles.block}>
      <View style={[styles.row, { paddingHorizontal: gutter }]}>
        <Text style={styles.name}>{company.name}</Text>
        <Button
          label={t("Open")}
          size="sm"
          variant="secondary"
          onPress={() => openCompany(company.id, company.kind, company.name)}
        />
      </View>
      <TitleGroup title={t("Upcoming")} items={grouped.upcoming} />
      <TitleGroup title={t("Newest")} items={grouped.newest} />
    </View>
  );
}

function TitleGroup({ title, items }: { title: string; items: MediaSummary[] }) {
  const styles = useStyles();
  const { gutter } = useResponsive();
  if (items.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { paddingHorizontal: gutter }]}>{title}</Text>
      <PosterGrid items={items.slice(0, 12)} onSelect={openTitle} />
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  head: { gap: SPACING.sm, paddingTop: 96 },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  block: { gap: SPACING.sm, marginTop: SPACING.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  name: { flex: 1, fontFamily: FONTS.bold, fontSize: 18, color: c.textPrimary },
  group: { gap: SPACING.xs },
  groupTitle: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textMuted },
}));
