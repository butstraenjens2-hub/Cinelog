import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_GITHUB_URL,
  PRIVACY_ISSUES_URL,
  PRIVACY_POLICY,
} from "./privacy-policy.mjs";

const markdown = readFileSync(new URL("../../PRIVACY.md", import.meta.url), "utf8");
const html = readFileSync(new URL("../../docs/privacy.html", import.meta.url), "utf8");

test("the privacy policy states the facts checked against the app", () => {
  assert.equal(PRIVACY_EFFECTIVE_DATE, "2026-10-23");
  assert.equal(PRIVACY_POLICY.en.sections.length, PRIVACY_POLICY.nl.sections.length);
  const combined = `${markdown}\n${html}\n${JSON.stringify(PRIVACY_POLICY)}`;
  for (const phrase of [
    "2026-10-23",
    "Belgium",
    "België",
    "under 16",
    "jonger dan 16",
    "TMDB",
    "api.simkl.com",
    "api.trakt.tv",
    "Sonarr",
    "Radarr",
    "Jellyfin",
    "Overseerr",
    "Tautulli",
    "SIMKL",
    "Trakt",
    "https://nexora-api-8xxb.onrender.com",
    "https://u.expo.dev",
    "does not sell personal information",
    "verkoopt geen persoonsgegevens",
    "No analytics or crash-reporting SDK is started",
    "toont geen reclame",
    PRIVACY_ISSUES_URL,
    PRIVACY_GITHUB_URL,
  ]) {
    assert.equal(combined.includes(phrase), true, phrase);
  }
  assert.equal(html.includes("googletagmanager"), false);
  assert.equal(html.includes("cookie"), true);
});
