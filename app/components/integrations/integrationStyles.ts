import { FONTS, RADIUS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";

export const useIntegrationStyles = makeStyles((c) => ({
  body: {
    gap: SPACING.md,
    paddingTop: 96,
    paddingBottom: SPACING.xxl,
    alignItems: "flex-start" as const,
  },
  title: { fontFamily: FONTS.extrabold, fontSize: 30, color: c.textPrimary },
  copy: { fontFamily: FONTS.regular, fontSize: 14, lineHeight: 20, color: c.textSecondary },
  label: { fontFamily: FONTS.semibold, fontSize: 13, color: c.textPrimary },
  input: {
    alignSelf: "stretch" as const,
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
  hint: { fontFamily: FONTS.regular, fontSize: 12, lineHeight: 17, color: c.textMuted },
  message: { fontFamily: FONTS.medium, fontSize: 13, color: c.textPrimary },
  row: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: SPACING.sm },
  card: {
    alignSelf: "stretch" as const,
    gap: 4,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardTitle: { fontFamily: FONTS.semibold, fontSize: 14, color: c.textPrimary },
  cardMeta: { fontFamily: FONTS.regular, fontSize: 12, color: c.textMuted },
}));
