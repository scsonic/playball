export interface AssetManifest {
  brand: {
    logoPlaceholder: string;
    logoLicensed: string;
  };
  product: {
    bottlePlaceholder: string;
    bottleLicensed: string;
    titlePlaceholder: string;
  };
  athlete: {
    idlePlaceholder: string;
    pitchPlaceholder: string;
    celebratePlaceholder: string;
    idleLicensed: string;
    pitchLicensed: string;
    celebrateLicensed: string;
  };
  stadium: {
    background: string;
  };
  audio: {
    stadiumLoop: string;
    pitch: string;
    catchSound: string;
    miss: string;
    win: string;
    countdown: string;
  };
}

/**
 * Public assets live at the deployment root, while this edition is served from a
 * sub-folder (`/gemini/`). An absolute `/assets/...` path breaks on a GitHub Pages
 * project sub-path and inside the Android WebView, so paths are resolved against the
 * parent of the page's own directory.
 */
const asset = (path: string): string =>
  typeof document !== 'undefined'
    ? new URL(path.replace(/^\//, ''), new URL('../', document.baseURI)).href
    : path;

export const ASSET_MANIFEST: AssetManifest = {
  brand: {
    logoPlaceholder: asset('/assets/brand/ito-en-logo-placeholder.svg'),
    logoLicensed: asset('/assets/brand/ito-en-logo-official.svg')
  },
  product: {
    bottlePlaceholder: asset('/assets/product/tea-bottle-placeholder.webp'),
    bottleLicensed: asset('/assets/product/tea-bottle-licensed.webp'),
    titlePlaceholder: 'ITO EN Oi Ocha Concept Activation'
  },
  athlete: {
    idlePlaceholder: asset('/assets/athlete/pitcher-idle-placeholder.webm'),
    pitchPlaceholder: asset('/assets/athlete/pitcher-pitch-placeholder.webm'),
    celebratePlaceholder: asset('/assets/athlete/pitcher-celebrate-placeholder.webm'),
    idleLicensed: asset('/assets/athlete/pitcher-idle-licensed.webm'),
    pitchLicensed: asset('/assets/athlete/pitcher-pitch-licensed.webm'),
    celebrateLicensed: asset('/assets/athlete/pitcher-celebrate-licensed.webm')
  },
  stadium: {
    background: asset('/assets/stadium/stadium-background.webp')
  },
  audio: {
    stadiumLoop: asset('/assets/audio/stadium-loop.mp3'),
    pitch: asset('/assets/audio/pitch.mp3'),
    catchSound: asset('/assets/audio/catch.mp3'),
    miss: asset('/assets/audio/miss.mp3'),
    win: asset('/assets/audio/win.mp3'),
    countdown: asset('/assets/audio/countdown.mp3')
  }
};
