import assert from "node:assert/strict";
import test from "node:test";

import { buildIcs } from "@/lib/calendar/ics.mjs";
import { jellyfinReportProgress, jellyfinResume, jellyfinStreamUrl } from "@/lib/jellyfin/api";
import { kodiMovies, kodiPlay, testKodi } from "@/lib/kodi/api";
import { addMovieToRadarr } from "@/lib/radarr/api";
import { requestOnSeerr, seerrSeasons, seerrServers } from "@/lib/seerr/api";
import { SECRET, writeSecret } from "@/lib/secrets";
import { fetchSimklLibrary, pushSimklRatings, startSimklDevice } from "@/lib/simkl/api";
import { pullSimklLibrary, pushSimklRatingsFromDevice } from "@/lib/simkl/sync";
import { addSeriesToSonarr, testSonarr } from "@/lib/sonarr/api";
import { tautulliActivity, tautulliStop } from "@/lib/tautulli/api";
import { fetchTraktWatchlist, startTraktDevice } from "@/lib/trakt/api";
import { pullTraktWatchlist } from "@/lib/trakt/sync";
import { useIntegrations } from "@/store/integrations-store";
import { useLibrary } from "@/store/library-store";

const originalFetch = globalThis.fetch;

function header(init: RequestInit, name: string): string {
  const headers = init.headers;
  if (!headers || headers instanceof Headers || Array.isArray(headers)) return "";
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return String(value);
  }
  return "";
}

function installFetch(
  handler: (url: string, init: RequestInit) => { status?: number; body?: unknown },
) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const request = init ?? {};
    calls.push({ url, init: request });
    const result = handler(url, request);
    const status = result.status ?? 200;
    const text = JSON.stringify(result.body ?? {});
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => result.body ?? {},
      text: async () => (status === 204 ? "" : text),
    } as Response;
  }) as typeof fetch;
  return calls;
}

test.afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("Sonarr status and add use the API key header and leave search off", async () => {
  const calls = installFetch((url) => {
    if (url.includes("/system/status")) {
      return { body: { appName: "Sonarr", version: "4.0.0", instanceName: "Home" } };
    }
    if (url.includes("/series/lookup")) {
      return { body: [{ title: "Example", tvdbId: 42, id: 0 }] };
    }
    return { body: { id: 7 } };
  });

  const status = await testSonarr("http://sonarr.local:8989", "sonarr-key");
  assert.equal(status.instanceName, "Home");
  await addSeriesToSonarr("http://sonarr.local:8989", "sonarr-key", 1396, {
    qualityProfileId: 4,
    rootFolderPath: "/tv",
    searchForMissingEpisodes: false,
  });

  assert.equal(calls.length, 3);
  for (const call of calls) {
    assert.equal(call.url.includes("sonarr-key"), false);
    assert.equal(header(call.init, "X-Api-Key"), "sonarr-key");
  }
  const post = calls[2];
  assert.equal(post.init.method, "POST");
  const body = JSON.parse(String(post.init.body));
  assert.equal(body.qualityProfileId, 4);
  assert.equal(body.rootFolderPath, "/tv");
  assert.equal(body.addOptions.searchForMissingEpisodes, false);
  assert.equal(body.id, undefined);
});

test("Radarr add uses the API key header and leaves movie search off", async () => {
  const calls = installFetch((url) => {
    if (url.includes("/movie/lookup")) return { body: [{ title: "Film", tmdbId: 550, id: 0 }] };
    return { body: { id: 3 } };
  });
  await addMovieToRadarr("http://radarr.local:7878", "radarr-key", 550, {
    qualityProfileId: 6,
    rootFolderPath: "/movies",
    searchForMovie: false,
  });
  const post = calls.find((call) => call.init.method === "POST");
  assert.ok(post);
  assert.equal(post.url.includes("radarr-key"), false);
  assert.equal(header(post.init, "X-Api-Key"), "radarr-key");
  const body = JSON.parse(String(post.init.body));
  assert.equal(body.addOptions.searchForMovie, false);
  assert.equal(body.rootFolderPath, "/movies");
});

test("Trakt device code and watchlist pull use the v2 headers", async () => {
  await useIntegrations.persist.rehydrate();
  useIntegrations.setState({
    traktClientId: "trakt-client",
    traktExpiresAt: Date.now() + 86_400_000,
  });
  await writeSecret(SECRET.traktClientSecret, "trakt-secret");
  await writeSecret(SECRET.traktAccessToken, "trakt-token");
  useLibrary.setState({ watchlist: [] });

  const calls = installFetch((url) => {
    if (url.endsWith("/oauth/device/code")) {
      return {
        body: {
          device_code: "device",
          user_code: "CODE",
          verification_url: "https://trakt.tv/activate",
          expires_in: 600,
          interval: 5,
        },
      };
    }
    if (url.endsWith("/sync/watchlist/movies")) {
      return { body: [{ movie: { title: "Fight Club", year: 1999, ids: { tmdb: 550 } } }] };
    }
    return { body: [] };
  });

  const device = await startTraktDevice("trakt-client");
  assert.equal(device.userCode, "CODE");
  const added = await pullTraktWatchlist();
  assert.equal(added, 1);
  assert.equal(useLibrary.getState().isInWatchlist("movie:550"), true);
  const authorized = calls.filter((call) => call.url.includes("/sync/watchlist"));
  assert.equal(header(authorized[0].init, "trakt-api-key"), "trakt-client");
  assert.equal(header(authorized[0].init, "Authorization"), "Bearer trakt-token");
  assert.equal(header(authorized[0].init, "trakt-api-version"), "2");
});

test("SIMKL reads ratings, maps show-level watching, and pushes scores", async () => {
  await useIntegrations.persist.rehydrate();
  useIntegrations.setState({
    simklClientId: "simkl-client",
    simklExpiresAt: Date.now() + 86_400_000,
  });
  await writeSecret(SECRET.simklAccessToken, "simkl-token");
  useLibrary.setState({ watchlist: [], ratings: {}, history: [], episodes: {} });

  installFetch((url, init) => {
    if (url.includes("/oauth2/device")) {
      return {
        body: {
          device_code: "device",
          user_code: "PIN",
          verification_uri: "https://simkl.com/pin",
          expires_in: 900,
          interval: 5,
        },
      };
    }
    if (url.includes("/sync/all-items/movies")) {
      return { body: { movies: [] } };
    }
    if (url.includes("/sync/all-items/shows")) {
      return {
        body: {
          shows: [
            {
              status: "watching",
              user_rating: 8,
              show: { title: "Example", year: 2016, ids: { tmdb: 1396 } },
            },
          ],
        },
      };
    }
    return { body: { added: { movies: 1 } } };
  });

  const device = await startSimklDevice("simkl-client");
  assert.equal(device.userCode, "PIN");
  const remote = await fetchSimklLibrary("simkl-client", "simkl-token");
  assert.equal(remote[0]?.rating, 8);
  assert.equal(remote[0]?.status, "watching");
  const pulled = await pullSimklLibrary();
  assert.equal(pulled.progress >= 1, true);
  assert.equal(useLibrary.getState().getWatchState("series:1396"), "watching");
  assert.equal(useLibrary.getState().getRating("series:1396"), 8);
  assert.equal(useLibrary.getState().isInWatchlist("series:1396"), true);

  const pushes = installFetch(() => ({ body: {} }));
  await pushSimklRatings("simkl-client", "simkl-token", [{ tmdbId: 550, rating: 9 }], []);
  await pushSimklRatingsFromDevice();
  const ratingCalls = pushes.filter((call) => call.url.includes("/sync/ratings"));
  assert.equal(ratingCalls.length, 2);
  assert.equal(header(ratingCalls[0].init, "Authorization"), "Bearer simkl-token");
  assert.equal(ratingCalls[0].url.includes("simkl-token"), false);
  const manual = JSON.parse(String(ratingCalls[0].init.body));
  const fromDevice = JSON.parse(String(ratingCalls[1].init.body));
  assert.equal(manual.movies[0].rating, 9);
  assert.equal(fromDevice.shows[0].ids.tmdb, 1396);
  assert.equal(fromDevice.shows[0].rating, 8);
});

test("Jellyfin resume positions and progress stay on the server", async () => {
  const calls = installFetch((url) => {
    if (url.includes("/Items/Resume")) {
      return {
        body: {
          Items: [
            {
              Id: "item-1",
              Name: "Film",
              Type: "Movie",
              ProductionYear: 1999,
              MediaSources: [{ Id: "src 2" }],
              UserData: { PlaybackPositionTicks: 150_000_000 },
            },
          ],
        },
      };
    }
    return { body: {} };
  });

  const rows = await jellyfinResume("http://jellyfin.local:8096", "jelly-token", "user-1");
  assert.equal(rows[0]?.positionSeconds, 15);
  assert.equal(rows[0]?.mediaSourceId, "src 2");
  await jellyfinReportProgress("http://jellyfin.local:8096", "jelly-token", "item-1", 20, false);
  const stream = jellyfinStreamUrl("http://jellyfin.local:8096", rows[0]);
  assert.equal(stream.includes("jelly-token"), false);
  assert.match(stream, /MediaSourceId=src%202/);
  for (const call of calls) {
    assert.equal(call.url.includes("jelly-token"), false);
    assert.match(header(call.init, "X-Emby-Authorization"), /Version="1\.0\.39"/);
    assert.equal(header(call.init, "X-Emby-Token"), "jelly-token");
  }
  const progress = calls.find((call) => call.url.includes("/Sessions/Playing/Progress"));
  assert.ok(progress);
  const body = JSON.parse(String(progress.init.body));
  assert.equal(body.PositionTicks, 200_000_000);
  assert.equal(body.ItemId, "item-1");
  assert.equal(body.EventName, "TimeUpdate");
});

test("Seerr lists servers, seasons, and sends the chosen request", async () => {
  const calls = installFetch((url) => {
    if (url.includes("/service/sonarr")) {
      return {
        body: [
          {
            id: 2,
            name: "Home",
            profiles: [{ id: 4, name: "HD" }],
            rootFolders: [{ id: 1, path: "/tv" }],
          },
        ],
      };
    }
    if (url.includes("/api/v1/tv/1396")) {
      return { body: { seasons: [{ seasonNumber: 0, name: "Specials" }, { seasonNumber: 1, name: "Season 1" }] } };
    }
    return { body: { id: 9 } };
  });

  const servers = await seerrServers("http://seerr.local:5055", "seerr-key", "tv");
  assert.equal(servers[0]?.profiles[0]?.name, "HD");
  assert.equal(servers[0]?.folders[0]?.name, "/tv");
  const seasons = await seerrSeasons("http://seerr.local:5055", "seerr-key", 1396);
  assert.deepEqual(seasons.map((season) => season.seasonNumber), [1]);
  await requestOnSeerr("http://seerr.local:5055", "seerr-key", {
    mediaType: "tv",
    tmdbId: 1396,
    serverId: 2,
    profileId: 4,
    rootFolder: "/tv",
    seasons: [1],
  });
  const post = calls.find((call) => call.init.method === "POST");
  assert.ok(post);
  assert.equal(post.url.includes("seerr-key"), false);
  assert.equal(header(post.init, "X-Api-Key"), "seerr-key");
  assert.deepEqual(JSON.parse(String(post.init.body)), {
    mediaType: "tv",
    mediaId: 1396,
    serverId: 2,
    profileId: 4,
    rootFolder: "/tv",
    seasons: [1],
  });
});

test("Tautulli lists sessions and stops one by session key", async () => {
  const calls = installFetch((url) => {
    if (url.includes("cmd=get_activity")) {
      return {
        body: {
          response: {
            result: "success",
            data: { sessions: [{ session_key: "99", full_title: "Film", friendly_name: "Ada", state: "playing" }] },
          },
        },
      };
    }
    return { body: { response: { result: "success", data: {} } } };
  });
  const rows = await tautulliActivity("http://tautulli.local:8181", "tautulli-key");
  assert.equal(rows[0]?.id, "99");
  assert.match(rows[0]?.meta ?? "", /Ada/);
  await tautulliStop("http://tautulli.local:8181", "tautulli-key", "99");
  const stop = calls.find((call) => call.url.includes("cmd=terminate_session"));
  assert.ok(stop);
  assert.match(stop.url, /apikey=tautulli-key/);
  assert.match(stop.url, /session_key=99/);
});

test("Kodi lists movies and plays one without putting the password in the URL", async () => {
  const calls = installFetch((url, init) => {
    const body = JSON.parse(String(init.body));
    if (body.method === "JSONRPC.Ping") return { body: { result: "pong" } };
    if (body.method === "VideoLibrary.GetMovies") {
      return { body: { result: { movies: [{ movieid: 4, title: "Film", year: 1999 }] } } };
    }
    return { body: { result: "OK" } };
  });
  assert.equal(await testKodi("http://kodi.local:8080", "kodi", "secret"), "pong");
  const movies = await kodiMovies("http://kodi.local:8080", "kodi", "secret");
  assert.equal(movies[0]?.title, "Film");
  await kodiPlay("http://kodi.local:8080", "kodi", "secret", { movieid: 4 });
  const open = calls.find((call) => String(call.init.body).includes("Player.Open"));
  assert.ok(open);
  assert.equal(open.url.includes("secret"), false);
  assert.equal(header(open.init, "Authorization"), `Basic ${btoa("kodi:secret")}`);
  assert.deepEqual(JSON.parse(String(open.init.body)).params.item, { movieid: 4 });
});

test("calendar export still escapes commas", () => {
  const ics = buildIcs([{ uid: "a", title: "Show, pilot", start: "2026-11-02" }], new Date("2026-10-22T00:00:00Z"));
  assert.match(ics, /SUMMARY:Show\\, pilot/);
});
