/**
 * CineLog — responsive poster grid.
 *
 * Column count comes from `useResponsive` (2 on phones, 4 on tablets, 6–8 on
 * desktop) and the poster width is derived so the row always fills the gutter.
 */

import React, { useCallback } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PosterCard } from "@/components/media/PosterCard";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { LAYOUT, SPACING } from "@/constants/theme";
import { useTheme } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import type { MediaSummary } from "@/lib/cinelog/types";

export interface PosterGridProps {
  items: MediaSummary[];
  onSelect: (item: MediaSummary) => void;
  /** Show a trailing row of skeletons while the next page loads. */
  isLoadingMore?: boolean;
  isLoading?: boolean;
}

/** Derive the poster width so `columns` cards plus gaps fill the content width. */
export function usePosterMetrics() {
  const { width, gridColumns, gutter } = useResponsive();
  const available =
    Math.min(width, 1600) - gutter * 2 - SPACING.md * (gridColumns - 1);
  return {
    columns: gridColumns,
    gutter,
    posterWidth: Math.floor(available / gridColumns),
  };
}

export function PosterGrid({
  items,
  onSelect,
  isLoadingMore = false,
  isLoading = false,
}: PosterGridProps) {
  const { columns, gutter, posterWidth } = usePosterMetrics();

  const renderSkeletons = useCallback(
    (count: number) =>
      Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} width={posterWidth} />
      )),
    [posterWidth],
  );

  return (
    <View style={[styles.grid, { paddingHorizontal: gutter }]}>
      {isLoading && items.length === 0
        ? renderSkeletons(columns * 3)
        : items.map((item) => (
            <PosterCard
              key={item.id}
              item={item}
              width={posterWidth}
              onPress={() => onSelect(item)}
            />
          ))}
      {isLoadingMore ? renderSkeletons(columns) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.md,
  },
  row: {
    gap: SPACING.md,
  },
});

// ── Virtualized page grid ────────────────────────────────────────────────────

export interface PosterGridScreenProps<T extends { id: string }> {
  items: T[];
  /** Renders one cell; defaults to a PosterCard. */
  renderItem?: (item: T, posterWidth: number) => React.ReactElement;
  onSelect?: (item: T) => void;
  /** Page chrome above the grid (titles, filters, empty states). */
  listHeader?: React.ReactElement | null;
  /** Page chrome below the grid (footer). */
  listFooter?: React.ReactElement | null;
  /** Fixed header outside the scrolling list (mobile header). */
  header?: React.ReactNode;
  reserveBottomNav?: boolean;
  onEndReached?: () => void;
  isLoading?: boolean;
  isLoadingMore?: boolean;
}

/**
 * Full-page virtualized poster grid. Long browse pages and big watchlists only
 * mount the rows near the viewport instead of every card at once, which keeps
 * scrolling smooth and memory flat on large libraries.
 */
export function PosterGridScreen<T extends { id: string }>({
  items,
  renderItem,
  onSelect,
  listHeader,
  listFooter,
  header,
  reserveBottomNav = false,
  onEndReached,
  isLoading = false,
  isLoadingMore = false,
}: PosterGridScreenProps<T>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { isMobile } = useResponsive();
  const { columns, gutter, posterWidth } = usePosterMetrics();
  const safeColumns = Math.max(2, columns);

  const bottomPadding =
    (reserveBottomNav && isMobile
      ? LAYOUT.bottomNavHeight + insets.bottom
      : 0) + SPACING.xxxl;

  const renderCell = useCallback(
    ({ item }: { item: T }) =>
      renderItem ? (
        renderItem(item, posterWidth)
      ) : (
        <PosterCard
          item={item as unknown as MediaSummary}
          width={posterWidth}
          onPress={() => onSelect?.(item)}
        />
      ),
    [renderItem, posterWidth, onSelect],
  );

  const skeletons = (count: number) => (
    <View style={[styles.grid, gridFrame, { paddingHorizontal: gutter }]}>
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={`skeleton-${index}`} width={posterWidth} />
      ))}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      <FlatList
        key={`grid-${safeColumns}`}
        data={items}
        numColumns={safeColumns}
        keyExtractor={(item) => item.id}
        renderItem={renderCell}
        columnWrapperStyle={[styles.row, gridFrame, { paddingHorizontal: gutter }]}
        ItemSeparatorComponent={RowGap}
        ListHeaderComponent={
          listHeader ? <View style={gridFrame}>{listHeader}</View> : null
        }
        ListFooterComponent={
          <>
            {isLoading && items.length === 0 ? skeletons(safeColumns * 3) : null}
            {isLoadingMore ? (
              <View style={{ marginTop: SPACING.md }}>{skeletons(safeColumns)}</View>
            ) : null}
            {listFooter ? <View style={gridFrame}>{listFooter}</View> : null}
          </>
        }
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        onEndReached={onEndReached}
        onEndReachedThreshold={1.5}
        initialNumToRender={safeColumns * 4}
        maxToRenderPerBatch={safeColumns * 4}
        windowSize={7}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

function RowGap() {
  return <View style={{ height: SPACING.md }} />;
}

const gridFrame = {
  width: "100%" as const,
  maxWidth: LAYOUT.maxContentWidth,
  alignSelf: "center" as const,
};
