/**
 * CineLog — per-route document metadata (native no-op).
 *
 * Document head tags only exist on web; see `SeoHead.web.tsx`. Native builds
 * resolve this file instead, keeping expo-router/head out of the app bundle.
 */

export interface SeoHeadProps {
  title?: string;
  description?: string;
  image?: string | null;
}

export function SeoHead(_props: SeoHeadProps): null {
  return null;
}
