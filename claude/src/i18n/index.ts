import type { Locale } from '../types';

/**
 * Copy deck.
 *
 * All wording is configurable and none of it claims official endorsement. The
 * Japanese strings are the sponsor-facing draft; the English and Traditional
 * Chinese decks mirror them for review and for international showings.
 */
export interface Dictionary {
  langLabel: string;

  bootTitle: string;
  bootSubtitle: string;
  bootLoading: string;
  preparingCamera: string;
  privacyTitle: string;
  privacyLocal: string;
  privacyNoUpload: string;
  privacyNoFaces: string;
  enableCamera: string;
  demoWithoutCamera: string;
  fullscreen: string;
  audioOn: string;
  audioOff: string;

  permissionDeniedTitle: string;
  permissionDeniedBody: string;
  retryCamera: string;

  calibrationTitle: string;
  calibrationStepBack: string;
  calibrationRaiseHand: string;
  calibrationOpenPalm: string;
  calibrationHoldStill: string;
  statusPerson: string;
  statusHand: string;
  statusPalm: string;
  statusLighting: string;
  statusDistance: string;
  calibrationProgress: string;
  flipCamera: string;
  handModeLeft: string;
  handModeRight: string;
  skipCalibration: string;

  attractHeadline: string;
  attractSub: string;
  attractRule: string;
  attractReward: string;
  step1: string;
  step2: string;
  step3: string;
  start: string;
  raisePalm: string;
  difficulty: string;
  difficultyEasy: string;
  difficultyNormal: string;
  difficultyChallenge: string;

  readyTitle: string;
  readyBody: string;
  countdownGo: string;

  hudPitch: string;
  hudCatches: string;
  hudTarget: string;
  hudTracking: string;
  hudCameraLocal: string;
  reset: string;

  catchLabel: string;
  missLabel: string;

  winTitle: string;
  winSubtitle: string;
  winReward: string;
  loseTitle: string;
  loseSubtitle: string;
  scoreLabel: string;
  claimCoupon: string;
  playAgain: string;
  visitCampaign: string;

  couponTitle: string;
  couponScan: string;
  couponCode: string;
  couponExpires: string;
  couponDemoWarning: string;
  couponMinutes: string;
  backToStart: string;

  cameraErrorTitle: string;
  cameraErrorBody: string;

  conceptDemo: string;
  sponsorPlaceholder: string;
  autoResetNotice: string;
}

const ja: Dictionary = {
  langLabel: '日本語',

  bootTitle: 'キャッチ・チャレンジ',
  bootSubtitle: 'コンセプト体験デモ / スポンサー提案用プロトタイプ',
  bootLoading: '準備中…',
  preparingCamera: 'カメラとトラッキングを準備しています…',
  privacyTitle: 'カメラの利用について',
  privacyLocal: 'カメラ映像はこの端末のブラウザ内だけで処理されます',
  privacyNoUpload: '映像は保存も送信もされません',
  privacyNoFaces: '顔認識・個人識別は行いません',
  enableCamera: 'カメラを有効にする',
  demoWithoutCamera: 'カメラなしでデモ（マウス操作）',
  fullscreen: '全画面表示',
  audioOn: '音声オン',
  audioOff: '音声オフ',

  permissionDeniedTitle: 'カメラを利用できませんでした',
  permissionDeniedBody: 'ブラウザの設定でカメラを許可するか、マウス操作のデモをお試しください。',
  retryCamera: 'もう一度試す',

  calibrationTitle: 'かんたんセットアップ',
  calibrationStepBack: '上半身が映る位置まで下がってください',
  calibrationRaiseHand: '左手を上げてください',
  calibrationOpenPalm: '手のひらをカメラに向けて開いてください',
  calibrationHoldStill: 'そのまま静止してください',
  statusPerson: '人物を検出',
  statusHand: '左手を検出',
  statusPalm: '手のひらが開いています',
  statusLighting: '明るさ',
  statusDistance: 'カメラとの距離',
  calibrationProgress: 'キャリブレーション',
  flipCamera: 'カメラ上下反転',
  handModeLeft: '左手モード',
  handModeRight: '右手モード',
  skipCalibration: 'スキップ',

  attractHeadline: '大谷級の一球をキャッチできるか？',
  attractSub: '左手を動かして、ボールをキャッチ！',
  attractRule: '5球中3球キャッチでチャレンジ成功',
  attractReward: '成功すると、お茶クーポンをプレゼント',
  step1: '左の手のひらをカメラに向ける',
  step2: 'カーソルをボタンに2秒重ねて決定',
  step3: '飛んでくるボールに手のひらを重ねる',
  start: 'スタート',
  raisePalm: '左手のひらを上げてプレイ',
  difficulty: '難易度',
  difficultyEasy: 'やさしい',
  difficultyNormal: 'ふつう',
  difficultyChallenge: 'チャレンジ',

  readyTitle: '準備はいいですか？',
  readyBody: '手のひらを画面の中央あたりに構えてください',
  countdownGo: 'GO!',

  hudPitch: '投球',
  hudCatches: 'キャッチ',
  hudTarget: '目標 3球',
  hudTracking: 'トラッキング',
  hudCameraLocal: '端末内処理',
  reset: 'リセット',

  catchLabel: 'ナイスキャッチ！',
  missLabel: 'おしい！',

  winTitle: 'チャレンジ成功！',
  winSubtitle: 'ナイスキャッチ！',
  winReward: 'お茶を1本プレゼント',
  loseTitle: 'あと少し！もう一度チャレンジしよう',
  loseSubtitle: '3球キャッチでクーポンをゲット！',
  scoreLabel: 'キャッチ数',
  claimCoupon: 'クーポンを受け取る',
  playAgain: 'もう一度プレイ',
  visitCampaign: 'キャンペーンサイト',

  couponTitle: 'クーポン',
  couponScan: 'QRコードをスマートフォンで読み取ってください',
  couponCode: 'クーポンコード',
  couponExpires: '有効期限',
  couponDemoWarning: 'デモ用コード — 実際にはご利用いただけません',
  couponMinutes: '分',
  backToStart: 'スタート画面へ',

  cameraErrorTitle: 'カメラの接続が切れました',
  cameraErrorBody: 'カメラを再接続するか、マウス操作のデモに切り替えてください。',

  conceptDemo: 'コンセプトデモ',
  sponsorPlaceholder: 'スポンサー素材（差し替え用プレースホルダー）',
  autoResetNotice: 'まもなく最初の画面に戻ります',
};

const en: Dictionary = {
  langLabel: 'English',

  bootTitle: 'Catch Challenge',
  bootSubtitle: 'Concept experience demo · sponsor proposal prototype',
  bootLoading: 'Preparing…',
  preparingCamera: 'Preparing camera and tracking…',
  privacyTitle: 'About the camera',
  privacyLocal: 'Camera processing happens locally in your browser',
  privacyNoUpload: 'No camera video is stored or uploaded',
  privacyNoFaces: 'No facial or identity recognition is used',
  enableCamera: 'Enable camera',
  demoWithoutCamera: 'Demo without camera (mouse)',
  fullscreen: 'Full screen',
  audioOn: 'Sound on',
  audioOff: 'Sound off',

  permissionDeniedTitle: 'Camera unavailable',
  permissionDeniedBody: 'Allow camera access in your browser settings, or try the mouse demo instead.',
  retryCamera: 'Retry camera',

  calibrationTitle: 'Quick setup',
  calibrationStepBack: 'Step back until your upper body is visible',
  calibrationRaiseHand: 'Raise your left hand',
  calibrationOpenPalm: 'Open your palm toward the camera',
  calibrationHoldStill: 'Hold still to begin',
  statusPerson: 'Person detected',
  statusHand: 'Left hand detected',
  statusPalm: 'Palm open',
  statusLighting: 'Lighting',
  statusDistance: 'Camera distance',
  calibrationProgress: 'Calibration',
  flipCamera: 'Flip camera',
  handModeLeft: 'Left-hand mode',
  handModeRight: 'Right-hand mode',
  skipCalibration: 'Skip',

  attractHeadline: 'Can you catch a pro-level pitch?',
  attractSub: 'Move your left palm to catch the ball!',
  attractRule: 'Catch 3 of 5 pitches to win',
  attractReward: 'Win to receive a green tea coupon',
  step1: 'Show your left palm to the camera',
  step2: 'Hold the cursor on a button for 2 seconds',
  step3: 'Put your palm where the ball arrives',
  start: 'Start',
  raisePalm: 'Raise your left palm to play',
  difficulty: 'Difficulty',
  difficultyEasy: 'Easy',
  difficultyNormal: 'Normal',
  difficultyChallenge: 'Challenge',

  readyTitle: 'Ready?',
  readyBody: 'Hold your palm near the centre of the screen',
  countdownGo: 'GO!',

  hudPitch: 'Pitch',
  hudCatches: 'Catches',
  hudTarget: 'Target 3',
  hudTracking: 'Tracking',
  hudCameraLocal: 'On-device',
  reset: 'Reset',

  catchLabel: 'Nice catch!',
  missLabel: 'So close!',

  winTitle: 'Challenge complete!',
  winSubtitle: 'Nice catch!',
  winReward: 'One green tea on us',
  loseTitle: 'Almost there — try once more!',
  loseSubtitle: 'Catch 3 pitches to win a coupon',
  scoreLabel: 'Catches',
  claimCoupon: 'Claim coupon',
  playAgain: 'Play again',
  visitCampaign: 'Campaign site',

  couponTitle: 'Your coupon',
  couponScan: 'Scan the QR code with your smartphone',
  couponCode: 'Coupon code',
  couponExpires: 'Expires in',
  couponDemoWarning: 'DEMO — NOT REDEEMABLE',
  couponMinutes: 'min',
  backToStart: 'Back to start',

  cameraErrorTitle: 'Camera disconnected',
  cameraErrorBody: 'Reconnect the camera or switch to the mouse demo.',

  conceptDemo: 'Concept Demo',
  sponsorPlaceholder: 'Sponsor asset placeholder',
  autoResetNotice: 'Returning to the start screen shortly',
};

const zhTW: Dictionary = {
  langLabel: '繁體中文',

  bootTitle: '接球挑戰',
  bootSubtitle: '概念體驗展示 · 贊助提案原型',
  bootLoading: '準備中…',
  preparingCamera: 'カメラとトラッキングを準備しています…',
  privacyTitle: '關於攝影機',
  privacyLocal: '影像僅在本機瀏覽器內處理',
  privacyNoUpload: '不會儲存或上傳任何影像',
  privacyNoFaces: '不使用人臉或身分辨識',
  enableCamera: '開啟攝影機',
  demoWithoutCamera: '不使用攝影機（滑鼠操作）',
  fullscreen: '全螢幕',
  audioOn: '開啟音效',
  audioOff: '關閉音效',

  permissionDeniedTitle: '無法使用攝影機',
  permissionDeniedBody: '請在瀏覽器設定中允許攝影機，或改用滑鼠體驗。',
  retryCamera: '重新嘗試',

  calibrationTitle: '快速設定',
  calibrationStepBack: '請後退到可看見上半身的位置',
  calibrationRaiseHand: '請舉起左手',
  calibrationOpenPalm: '手掌張開面向攝影機',
  calibrationHoldStill: '請保持不動',
  statusPerson: '偵測到人物',
  statusHand: '偵測到左手',
  statusPalm: '手掌已張開',
  statusLighting: '光線',
  statusDistance: '與攝影機距離',
  calibrationProgress: '校正進度',
  flipCamera: '上下翻轉畫面',
  handModeLeft: '左手模式',
  handModeRight: '右手模式',
  skipCalibration: '略過',

  attractHeadline: '你能接住職業級的一球嗎？',
  attractSub: '移動左手掌，接住飛來的球！',
  attractRule: '五球中接到三球即挑戰成功',
  attractReward: '成功即可獲得綠茶折價券',
  step1: '將左手掌面向攝影機',
  step2: '游標停在按鈕上兩秒即可選擇',
  step3: '用手掌對準球飛來的位置',
  start: '開始',
  raisePalm: '舉起左手掌開始遊戲',
  difficulty: '難度',
  difficultyEasy: '輕鬆',
  difficultyNormal: '標準',
  difficultyChallenge: '挑戰',

  readyTitle: '準備好了嗎？',
  readyBody: '請把手掌放在畫面中央附近',
  countdownGo: 'GO!',

  hudPitch: '投球',
  hudCatches: '接到',
  hudTarget: '目標 3 球',
  hudTracking: '追蹤',
  hudCameraLocal: '本機處理',
  reset: '重設',

  catchLabel: '漂亮！',
  missLabel: '差一點！',

  winTitle: '挑戰成功！',
  winSubtitle: '接得漂亮！',
  winReward: '招待你一瓶綠茶',
  loseTitle: '差一點！再挑戰一次吧',
  loseSubtitle: '接到三球即可獲得折價券',
  scoreLabel: '接球數',
  claimCoupon: '領取折價券',
  playAgain: '再玩一次',
  visitCampaign: '活動網站',

  couponTitle: '你的折價券',
  couponScan: '請用手機掃描 QR Code',
  couponCode: '折價券代碼',
  couponExpires: '有效期限',
  couponDemoWarning: '示範用代碼 — 無法實際兌換',
  couponMinutes: '分鐘',
  backToStart: '回到開始畫面',

  cameraErrorTitle: '攝影機已中斷',
  cameraErrorBody: '請重新連接攝影機，或切換為滑鼠體驗。',

  conceptDemo: '概念展示',
  sponsorPlaceholder: '贊助素材佔位圖',
  autoResetNotice: '即將返回開始畫面',
};

export const DICTIONARIES: Record<Locale, Dictionary> = { ja, en, 'zh-TW': zhTW };

export function t(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES.ja;
}

export const LOCALE_ORDER: Locale[] = ['ja', 'en', 'zh-TW'];

export function nextLocale(locale: Locale): Locale {
  const i = LOCALE_ORDER.indexOf(locale);
  return LOCALE_ORDER[(i + 1) % LOCALE_ORDER.length];
}
