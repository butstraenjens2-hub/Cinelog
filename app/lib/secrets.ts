/**
 * Device-keystore storage for integration secrets.
 * On Android and iOS the value lives in the platform keystore. The web build
 * keeps it in memory for the session only — it is never written to localStorage.
 */

import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const memory = new Map<string, string>();

export const SECRET = {
  radarrApiKey: "cinelog.radarr.apiKey",
  jellyfinToken: "cinelog.jellyfin.token",
} as const;

export async function readSecret(key: string): Promise<string> {
  if (Platform.OS === "web") return memory.get(key) ?? "";
  try {
    return (await SecureStore.getItemAsync(key)) ?? "";
  } catch {
    return memory.get(key) ?? "";
  }
}

export async function writeSecret(key: string, value: string): Promise<void> {
  const next = value.trim();
  if (Platform.OS === "web") {
    if (next) memory.set(key, next);
    else memory.delete(key);
    return;
  }
  try {
    if (!next) {
      await SecureStore.deleteItemAsync(key);
      memory.delete(key);
      return;
    }
    await SecureStore.setItemAsync(
      key,
      next,
      Platform.OS === "ios"
        ? { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
        : undefined,
    );
    memory.delete(key);
  } catch {
    if (next) memory.set(key, next);
    else memory.delete(key);
  }
}
