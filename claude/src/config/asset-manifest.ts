/**
 * Asset replacement architecture.
 *
 * Every visual/audio asset the experience can use is declared here with a
 * placeholder slot and an optional licensed slot. Gameplay code never hard-codes
 * a path: it asks the manifest, which decides between placeholder and licensed
 * files based on the campaign config flags. Sponsor-provided licensed files can
 * therefore be dropped into `/public/assets/**` and enabled with a single flag,
 * without touching game code.
 *
 * If a file is missing the renderers fall back to fully procedural artwork, so
 * the prototype always runs with an empty asset folder.
 */
import type { CampaignConfig } from './campaign.config';

export type AssetKind = 'image' | 'video' | 'audio' | 'svg';
export type AssetCategory = 'brand' | 'product' | 'athlete' | 'stadium' | 'audio';

export interface AssetSlot {
  id: string;
  kind: AssetKind;
  category: AssetCategory;
  /** Legally safe placeholder shipped with the prototype (may be absent). */
  placeholder: string;
  /** Sponsor-supplied licensed file, used only when the matching flag is on. */
  licensed?: string;
  /** True when the slot needs a signed licence before it may be shown. */
  requiresLicense: boolean;
  description: string;
}

/**
 * Public assets live at the deployment root (`/assets/**`), while this edition is
 * served from a sub-folder (`/claude/`). Resolving against the page would look for
 * `/claude/assets/...` and 404 — which is exactly what happened inside the Android
 * WebView, where the site sits at `/assets/web/claude/`. So paths are resolved
 * against the parent of the page's own directory, which works for the dev server,
 * a GitHub Pages project sub-path and the APK's asset origin alike.
 */
const DEPLOY_ROOT =
  typeof document !== 'undefined'
    ? new URL('../', new URL(import.meta.env.BASE_URL ?? './', document.baseURI)).href
    : '/';

const p = (path: string) => `${DEPLOY_ROOT.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

export const ASSET_SLOTS: Record<string, AssetSlot> = {
  brandLogo: {
    id: 'brandLogo',
    kind: 'svg',
    category: 'brand',
    placeholder: p('assets/brand/ito-en-logo-placeholder.svg'),
    licensed: p('assets/brand/ito-en-logo-licensed.svg'),
    requiresLicense: true,
    description: 'Sponsor logo lockup shown in the corner badge and on the coupon card.',
  },
  productBottle: {
    id: 'productBottle',
    kind: 'image',
    category: 'product',
    placeholder: p('assets/product/tea-bottle-placeholder.webp'),
    licensed: p('assets/product/tea-bottle-licensed.webp'),
    requiresLicense: true,
    description: 'Hero tea bottle. Falls back to a procedurally drawn concept bottle.',
  },
  pitcherIdle: {
    id: 'pitcherIdle',
    kind: 'video',
    category: 'athlete',
    placeholder: p('assets/athlete/pitcher-idle-placeholder.webm'),
    licensed: p('assets/athlete/pitcher-idle-licensed.webm'),
    requiresLicense: true,
    description: 'Idle / set-position loop. Alpha WebM preferred, chroma-key accepted.',
  },
  pitcherPitch: {
    id: 'pitcherPitch',
    kind: 'video',
    category: 'athlete',
    placeholder: p('assets/athlete/pitcher-pitch-placeholder.webm'),
    licensed: p('assets/athlete/pitcher-pitch-licensed.webm'),
    requiresLicense: true,
    description: 'Windup → release → follow-through. Release frame is configured in PitcherRig.',
  },
  pitcherCelebrate: {
    id: 'pitcherCelebrate',
    kind: 'video',
    category: 'athlete',
    placeholder: p('assets/athlete/pitcher-celebrate-placeholder.webm'),
    licensed: p('assets/athlete/pitcher-celebrate-licensed.webm'),
    requiresLicense: true,
    description: 'Positive reaction / celebration used on the result screen.',
  },
  stadiumBackground: {
    id: 'stadiumBackground',
    kind: 'image',
    category: 'stadium',
    placeholder: p('assets/stadium/stadium-background.webp'),
    requiresLicense: false,
    description: 'Optional stadium plate. Without it the stadium is drawn procedurally.',
  },
  audioStadiumLoop: {
    id: 'audioStadiumLoop',
    kind: 'audio',
    category: 'audio',
    placeholder: p('assets/audio/stadium-loop.mp3'),
    requiresLicense: false,
    description: 'Ambient crowd bed.',
  },
  audioPitch: {
    id: 'audioPitch',
    kind: 'audio',
    category: 'audio',
    placeholder: p('assets/audio/pitch.mp3'),
    requiresLicense: false,
    description: 'Ball release whoosh.',
  },
  audioCatch: {
    id: 'audioCatch',
    kind: 'audio',
    category: 'audio',
    placeholder: p('assets/audio/catch.mp3'),
    requiresLicense: false,
    description: 'Leather glove pop.',
  },
  audioMiss: {
    id: 'audioMiss',
    kind: 'audio',
    category: 'audio',
    placeholder: p('assets/audio/miss.mp3'),
    requiresLicense: false,
    description: 'Soft pass-by swoosh — never a harsh error buzzer.',
  },
  audioWin: {
    id: 'audioWin',
    kind: 'audio',
    category: 'audio',
    placeholder: p('assets/audio/win.mp3'),
    requiresLicense: false,
    description: 'Celebration sting.',
  },
};

/** Resolves the URL that should currently be used for a slot. */
export function resolveAsset(id: keyof typeof ASSET_SLOTS | string, config: CampaignConfig): string | null {
  const slot = ASSET_SLOTS[id];
  if (!slot) return null;
  const licensedAllowed =
    slot.category === 'athlete'
      ? config.useLicensedAthleteAssets
      : slot.category === 'brand' || slot.category === 'product'
        ? config.useLicensedBrandAssets
        : true;
  if (licensedAllowed && slot.licensed) return slot.licensed;
  return slot.placeholder;
}

/** True when the slot is currently rendering unlicensed placeholder art. */
export function isPlaceholder(id: string, config: CampaignConfig): boolean {
  const slot = ASSET_SLOTS[id];
  if (!slot) return true;
  return resolveAsset(id, config) === slot.placeholder;
}

/** Probes every slot so the admin panel can show which files actually exist. */
export async function probeAssets(config: CampaignConfig): Promise<Record<string, boolean>> {
  const entries = await Promise.all(
    Object.keys(ASSET_SLOTS).map(async (id) => {
      const url = resolveAsset(id, config);
      if (!url) return [id, false] as const;
      try {
        const res = await fetch(url, { method: 'HEAD' });
        return [id, res.ok] as const;
      } catch {
        return [id, false] as const;
      }
    }),
  );
  return Object.fromEntries(entries);
}
