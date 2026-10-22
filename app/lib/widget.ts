/**
 * Publishes a small "up next" snapshot to the Android home-screen widget.
 * No-op on iOS, web, and builds that do not include the native module.
 */

import { NativeModules, Platform } from "react-native";

export interface WidgetSnapshotItem {
  title: string;
  subtitle: string;
  path: string;
  poster?: string | null;
}

export interface WidgetSnapshot {
  title: string;
  subtitle: string;
  path: string;
  poster?: string | null;
  items?: WidgetSnapshotItem[];
}

export function publishWidgetSnapshot(snapshot: WidgetSnapshot): void {
  if (Platform.OS !== "android") return;
  const bridge = NativeModules.CineLogWidget as
    | { setSnapshot?: (json: string) => void }
    | undefined;
  bridge?.setSnapshot?.(JSON.stringify(snapshot));
}
