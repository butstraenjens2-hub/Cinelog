import React, { useCallback, useEffect, useMemo, useState } from "react";
import { InteractionManager, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";

import { useT } from "@/i18n";
import { SeoHead } from "@/components/SeoHead";
import { Footer } from "@/components/layout/Footer";
import { Carousel } from "@/components/media/Carousel";
import { ContinueWatchingCard } from "@/components/media/ContinueWatchingCard";
import { HeroBanner } from "@/components/media/HeroBanner";
import { PosterCard } from "@/components/media/PosterCard";
import { UpNextCard } from "@/components/media/UpNextCard";
import { MobileHeader } from "@/components/navigation/MobileHeader";
import { GenrePill } from "@/components/ui/GenrePill";
import { Screen } from "@/components/ui/Screen";
import { ErrorState } from "@/components/ui/States";
import { FONTS, SPACING } from "@/constants/theme";
import { makeStyles } from "@/theme";
import { useResponsive } from "@/hooks/useResponsive";
import { useTrailerPlayer } from "@/hooks/useTrailerPlayer";
import { useTrackedSeries } from "@/hooks/useTrackedSeries";
import { useBecauseYouLiked } from "@/hooks/useBecauseYouLiked";
import type { UpNextEntry } from "@/lib/cinelog/upNext";
import { GENRES } from "@/lib/cinelog/genres";
import { openTitle } from "@/lib/cinelog/navigation";
import {
  useInterleaved,
  useMovieRail,
  useSeriesRail,
  useTrending,
} from "@/lib/cinelog/queries";
import {
  becauseYouWatched,
  buildTasteProfile,
  recommendForYou,
} from "@/lib/cinelog/recommendations";
import type { MediaSummary } from "@/lib/cinelog/types";
import { useAuth } from "@/store/auth-store";
import {
  useContinueWatching,
  useLibrary,
  useTasteSignals,
} from "@/store/library-store";

function hasValidPoster(item: { poster: string | null }): boolean {
  if (!item.poster) return false;
  const lowered = String(item.poster).toLowerCase();
  return !lowered.includes("null") && !lowered.includes("undefined");
}

const upNextKey = (entry: UpNextEntry) =>
  `${entry.series.id}:${entry.seasonNumber}:${entry.episodeNumber}`;
const mediaKey = (item: { id: string }) => item.id;

export default function HomeScreen() {
  const t = useT();
  const styles = useStyles();
  const { isMobile, gutter, railPosterWidth, width } = useResponsive();
  const user = useAuth((state) => state.user);
  const trailer = useTrailerPlayer();
  const openTrailer = trailer.open;

  const trending = useTrending();
  const popularMovies = useMovieRail("popular");
  const popularSeries = useSeriesRail("popular");
  const [secondaryRailsEnabled, setSecondaryRailsEnabled] = useState(false);
  const primaryContentReady = trending.items.length > 0 || trending.isError;

  useEffect(() => {
    if (secondaryRailsEnabled) return;
    const timer = setTimeout(() => {
      setSecondaryRailsEnabled(true);
    }, 8000);
    return () => clearTimeout(timer);
  }, [secondaryRailsEnabled]);

  useEffect(() => {
    if (secondaryRailsEnabled) return;
    // Keep startup focused on hero + top rails, but don't block forever when
    // the trending request fails; secondary rails should still load.
    if (!primaryContentReady) return;

    const task = InteractionManager.runAfterInteractions(() => {
      setSecondaryRailsEnabled(true);
    });

    return () => task.cancel();
  }, [secondaryRailsEnabled, primaryContentReady]);

  const newReleases = useMovieRail("now_playing", {
    enabled: secondaryRailsEnabled,
  });
  const topRatedMovies = useMovieRail("top_rated", {
    enabled: secondaryRailsEnabled,
  });
  const topRatedSeries = useSeriesRail("top_rated", {
    enabled: secondaryRailsEnabled,
  });

  const continueWatching = useContinueWatching();
  const clearProgress = useLibrary((state) => state.clearProgress);
  const toggleWatchlist = useLibrary((state) => state.toggleWatchlist);
  const tasteSignals = useTasteSignals();

  const heroFromTrending =
    trending.items.find((item) => item.backdrop || item.poster) ??
    trending.items[0] ??
    null;
  const heroFallbackPool = [
    ...popularMovies.items,
    ...popularSeries.items,
    ...newReleases.items,
    ...topRatedMovies.items,
    ...topRatedSeries.items,
  ];
  const heroFromFallback =
    heroFallbackPool.find((item) => item.backdrop || item.poster) ?? null;
  const hero = heroFromTrending ?? heroFromFallback;
  const heroLoading =
    !hero && (trending.isLoading || popularMovies.isLoading || popularSeries.isLoading);
  const heroInWatchlist = useLibrary((state) =>
    hero ? state.isInWatchlist(hero.id) : false,
  );

  /** Everything currently loaded, used as the recommendation candidate pool. */
  const candidates = useMemo<MediaSummary[]>(() => {
    const pools = [
      trending.items,
      popularMovies.items,
      popularSeries.items,
      newReleases.items,
      topRatedMovies.items,
      topRatedSeries.items,
    ];
    const seen = new Set<string>();
    const merged: MediaSummary[] = [];
    for (const pool of pools) {
      for (const item of pool) {
        if (seen.has(item.id)) continue;
        seen.add(item.id);
        if (!hasValidPoster(item)) continue;
        merged.push(item);
      }
    }
    return merged;
  }, [
    trending.items,
    popularMovies.items,
    popularSeries.items,
    newReleases.items,
    topRatedMovies.items,
    topRatedSeries.items,
  ]);

  const profile = useMemo(
    () => buildTasteProfile(tasteSignals),
    [tasteSignals],
  );

  const recommended = useMemo(
    () => recommendForYou({ candidates, profile }),
    [candidates, profile],
  );

  const becauseRail = useMemo(
    () => becauseYouWatched(candidates, profile),
    [candidates, profile],
  );

  const topRated = useInterleaved(topRatedMovies.items, topRatedSeries.items);

  const trendingItems = useMemo(
    () => trending.items.filter(hasValidPoster),
    [trending.items],
  );
  const popularMovieItems = useMemo(
    () => popularMovies.items.filter(hasValidPoster),
    [popularMovies.items],
  );
  const popularSeriesItems = useMemo(
    () => popularSeries.items.filter(hasValidPoster),
    [popularSeries.items],
  );
  const newReleaseItems = useMemo(
    () => newReleases.items.filter(hasValidPoster),
    [newReleases.items],
  );
  const topRatedItems = useMemo(
    () => topRated.filter(hasValidPoster),
    [topRated],
  );
  const recommendedItems = useMemo(
    () => recommended.map((entry) => entry.item).filter(hasValidPoster),
    [recommended],
  );

  const renderPoster = useCallback(
    (item: MediaSummary) => (
      <PosterCard
        item={item}
        width={railPosterWidth}
        onPress={() => openTitle(item)}
        onPlayTrailer={() =>
          openTrailer({
            type: item.type,
            tmdbId: item.tmdbId,
            title: item.title,
          })
        }
      />
    ),
    [railPosterWidth, openTrailer],
  );

  const tracked = useTrackedSeries(secondaryRailsEnabled);
  const liked = useBecauseYouLiked(secondaryRailsEnabled);
  const toggleEpisodeWatched = useLibrary((state) => state.toggleEpisodeWatched);
  const openUpNext = useCallback((entry: UpNextEntry) => {
    router.push({
      pathname: "/series/[id]",
      params: {
        id: String(entry.series.tmdbId),
        season: String(entry.seasonNumber),
        episode: String(entry.episodeNumber),
      },
    } as never);
  }, []);
  const markUpNextWatched = useCallback(
    (entry: UpNextEntry) => {
      toggleEpisodeWatched(entry.series, entry.seasonNumber, entry.episodeNumber);
    },
    [toggleEpisodeWatched],
  );
  const renderUpNext = useCallback(
    (entry: UpNextEntry) => (
      <UpNextCard
        entry={entry}
        width={railPosterWidth}
        onOpen={openUpNext}
        onMarkWatched={markUpNextWatched}
      />
    ),
    [railPosterWidth, openUpNext, markUpNextWatched],
  );

  const continueCardWidth = isMobile ? Math.min(width - gutter * 2, 300) : 320;

  const heroUnavailable = !hero && !heroLoading;

  return (
    <>
      <SeoHead description="Discover what to watch next: trending films and shows, new releases, top rated picks and recommendations tuned to your taste." />
      <Screen
        reserveBottomNav
        header={
          isMobile ? (
            <MobileHeader
              onOpenProfile={() => router.push("/profile")}
              gutter={gutter}
              displayName={user?.displayName ?? t("Guest")}
              avatarUrl={user?.avatarUrl ?? null}
            />
          ) : null
        }
      >
        {heroUnavailable ? (
          <ErrorState onRetry={trending.refetch} />
        ) : (
          <HeroBanner
            item={hero}
            isLoading={heroLoading}
            onOpen={() => hero && openTitle(hero)}
            onWatchTrailer={() =>
              hero &&
              trailer.open({
                type: hero.type,
                tmdbId: hero.tmdbId,
                title: hero.title,
              })
            }
            onToggleWatchlist={() => hero && toggleWatchlist(hero)}
            inWatchlist={heroInWatchlist}
          />
        )}

        <View style={styles.rails}>
          {continueWatching.length > 0 ? (
            <Carousel
              title={t("Continue Watching")}
              subtitle={t("Pick up where you left off")}
              items={continueWatching}
              isLoading={false}
              itemWidth={continueCardWidth}
              keyExtractor={(item) => item.id}
              renderItem={(item) => (
                <ContinueWatchingCard
                  progress={item}
                  width={continueCardWidth}
                  onPress={() => {
                    if (item.type === "movie") {
                      router.push({
                        pathname: "/movie/[id]",
                        params: {
                          id: String(item.tmdbId),
                          autoplay: "1",
                          resumeSeconds: String(item.positionSeconds || 0),
                        },
                      } as never);
                      return;
                    }

                    router.push({
                      pathname: "/series/[id]",
                      params: {
                        id: String(item.tmdbId),
                        autoplay: "1",
                        season: String(item.seasonNumber || 1),
                        episode: String(item.episodeNumber || 1),
                        resumeSeconds: String(item.positionSeconds || 0),
                      },
                    } as never);
                  }}
                  onRemove={() => clearProgress(item.id)}
                />
              )}
            />
          ) : null}

          {tracked.upNext.length > 0 ? (
            <Carousel
              title={t("Up Next")}
              subtitle={t("The next episode of the shows you follow")}
              items={tracked.upNext}
              isLoading={false}
              itemWidth={railPosterWidth}
              keyExtractor={upNextKey}
              renderItem={renderUpNext}
            />
          ) : null}

          {liked.seed && (liked.items.length > 0 || liked.isLoading) ? (
            <Carousel
              title={t("Because you liked {{title}}", { title: liked.seed.title })}
              subtitle={t("You rated it {{score}}/10", { score: liked.seed.score })}
              items={liked.items}
              isLoading={liked.isLoading}
              itemWidth={railPosterWidth}
              keyExtractor={mediaKey}
              renderItem={renderPoster}
            />
          ) : null}

          {becauseRail ? (
            <Carousel
              title={t("Because You Watched {{title}}", {
                title: becauseRail.seed.title,
              })}
              items={becauseRail.items}
              isLoading={false}
              itemWidth={railPosterWidth}
              keyExtractor={mediaKey}
              renderItem={renderPoster}
            />
          ) : null}

          <Carousel
            title={t("Trending Now")}
            items={trendingItems}
            isLoading={trending.isLoading}
            itemWidth={railPosterWidth}
            keyExtractor={mediaKey}
            renderItem={renderPoster}
          />

          <Carousel
            title={t("Popular Movies")}
            items={popularMovieItems}
            isLoading={popularMovies.isLoading}
            itemWidth={railPosterWidth}
            keyExtractor={mediaKey}
            renderItem={renderPoster}
            onSeeAll={() => router.navigate("/(tabs)/movies")}
          />

          <Carousel
            title={t("Popular Series")}
            items={popularSeriesItems}
            isLoading={popularSeries.isLoading}
            itemWidth={railPosterWidth}
            keyExtractor={mediaKey}
            renderItem={renderPoster}
            onSeeAll={() => router.navigate("/(tabs)/series")}
          />

          <Carousel
            title={t("New Releases")}
            subtitle={t("In cinemas now")}
            items={newReleaseItems}
            isLoading={secondaryRailsEnabled && newReleases.isLoading}
            itemWidth={railPosterWidth}
            keyExtractor={mediaKey}
            renderItem={renderPoster}
          />

          <Carousel
            title={t("Top Rated")}
            items={topRatedItems}
            isLoading={
              secondaryRailsEnabled &&
              (topRatedMovies.isLoading || topRatedSeries.isLoading)
            }
            itemWidth={railPosterWidth}
            keyExtractor={mediaKey}
            renderItem={renderPoster}
          />

          <Carousel
            title={t("Recommended For You")}
            subtitle={
              profile.hasSignal
                ? t("Based on what you watch, rate and save")
                : t("Rate a few titles and this gets personal")
            }
            items={recommendedItems}
            isLoading={candidates.length === 0}
            itemWidth={railPosterWidth}
            keyExtractor={mediaKey}
            renderItem={renderPoster}
          />

          <View style={styles.genreBlock}>
            <Text style={[styles.genreHeading, { paddingHorizontal: gutter }]}>
              {t("Browse by Genre")}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[
                styles.genreRow,
                { paddingHorizontal: gutter },
              ]}
            >
              {GENRES.map((genre) => (
                <GenrePill
                  key={genre.slug}
                  label={genre.label}
                  onPress={() =>
                    router.navigate({
                      pathname: "/(tabs)/movies",
                      params: { genre: genre.slug },
                    } as never)
                  }
                />
              ))}
            </ScrollView>
          </View>
        </View>

        <Footer />
      </Screen>
      {trailer.element}
    </>
  );
}

const useStyles = makeStyles((c, t) => ({
  rails: {
    gap: SPACING.xxl,
    paddingTop: SPACING.xxl,
  },
  genreBlock: {
    gap: SPACING.md,
  },
  genreHeading: {
    fontFamily: FONTS.bold,
    fontSize: 19,
    color: c.textPrimary,
  },
  genreRow: {
    gap: SPACING.sm,
  },
}));
