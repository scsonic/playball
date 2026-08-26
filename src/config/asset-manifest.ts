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

export const ASSET_MANIFEST: AssetManifest = {
  brand: {
    logoPlaceholder: '/assets/brand/ito-en-logo-placeholder.svg',
    logoLicensed: '/assets/brand/ito-en-logo-official.svg'
  },
  product: {
    bottlePlaceholder: '/assets/product/tea-bottle-placeholder.webp',
    bottleLicensed: '/assets/product/tea-bottle-licensed.webp',
    titlePlaceholder: 'ITO EN Oi Ocha Concept Activation'
  },
  athlete: {
    idlePlaceholder: '/assets/athlete/pitcher-idle-placeholder.webm',
    pitchPlaceholder: '/assets/athlete/pitcher-pitch-placeholder.webm',
    celebratePlaceholder: '/assets/athlete/pitcher-celebrate-placeholder.webm',
    idleLicensed: '/assets/athlete/pitcher-idle-licensed.webm',
    pitchLicensed: '/assets/athlete/pitcher-pitch-licensed.webm',
    celebrateLicensed: '/assets/athlete/pitcher-celebrate-licensed.webm'
  },
  stadium: {
    background: '/assets/stadium/stadium-background.webp'
  },
  audio: {
    stadiumLoop: '/assets/audio/stadium-loop.mp3',
    pitch: '/assets/audio/pitch.mp3',
    catchSound: '/assets/audio/catch.mp3',
    miss: '/assets/audio/miss.mp3',
    win: '/assets/audio/win.mp3',
    countdown: '/assets/audio/countdown.mp3'
  }
};
