import React from "react";
import { Text, View } from "react-native";

import { Pressable } from "@/components/ui/Pressable";
import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { openCompany } from "@/lib/cinelog/navigation";
import type { CompanyRef } from "@/lib/cinelog/types";
import type { FollowKind } from "@/store/follows-store";

export function CompanyLinks({
  title,
  companies,
  kind,
  gutter,
}: {
  title: string;
  companies: CompanyRef[];
  kind: FollowKind;
  gutter: number;
}) {
  const styles = useStyles();
  if (companies.length === 0) return null;
  return (
    <View style={[styles.block, { paddingHorizontal: gutter }]}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.row}>
        {companies.map((company) => (
          <Pressable
            key={`${kind}:${company.id}`}
            onPress={() => openCompany(company.id, kind, company.name)}
            accessibilityRole="button"
            accessibilityLabel={company.name}
            style={styles.pill}
          >
            <Text style={styles.pillText}>{company.name}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  block: { gap: SPACING.sm },
  title: { fontFamily: FONTS.bold, fontSize: 17, color: c.textPrimary },
  row: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  pill: {
    borderRadius: RADIUS.pill ?? 999,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surface,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
  },
  pillText: { fontFamily: FONTS.medium, fontSize: 13, color: c.textPrimary },
}));
