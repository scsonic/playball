import { Locale } from '../types/game';

export interface LocaleContent {
  campaignConcept: string;
  conceptDemoBadge: string;
  cameraLocalPrivacy: string;
  cameraNoUpload: string;
  enableCameraBtn: string;
  demoWithoutCameraBtn: string;
  retryCameraBtn: string;
  fullscreenBtn: string;
  exitFullscreenBtn: string;
  audioOn: string;
  audioOff: string;
  calibrationTitle: string;
  stepBackInstruction: string;
  raiseLeftHandInstruction: string;
  openPalmInstruction: string;
  holdStillInstruction: string;
  personDetected: string;
  handDetected: string;
  palmOpen: string;
  lightingQuality: string;
  calibrationReady: string;
  switchHandPrompt: string;
  attractHeadline: string;
  attractSubheadline: string;
  ruleCatches: string;
  ruleReward: string;
  raiseHandToStart: string;
  startButton: string;
  countdownGetReady: string;
  pitchCountLabel: string;
  catchCountLabel: string;
  targetCatchesLabel: string;
  catchSuccessText: string;
  missText: string;
  winHeadline: string;
  winSubheadline: string;
  winReward: string;
  scanQrPrompt: string;
  couponExpirationNotice: string;
  demoCouponNotice: string;
  loseHeadline: string;
  loseSubheadline: string;
  loseEncourage: string;
  playAgainBtn: string;
  claimCouponBtn: string;
  visitWebsiteBtn: string;
  resetBtn: string;
  inactivityWarning: string;
  confidenceMeter: string;
}

export const LOCALES: Record<Locale, LocaleContent> = {
  ja: {
    campaignConcept: 'ITO EN × WBC 体感キャッチチャレンジ',
    conceptDemoBadge: 'コンセプトデモ (Concept Demo)',
    cameraLocalPrivacy: 'カメラ映像はブラウザ内でのみローカル処理されます',
    cameraNoUpload: '映像や個人データが外部に送信・保存されることはありません',
    enableCameraBtn: 'カメラを開始する',
    demoWithoutCameraBtn: 'マウス操作で体験（カメラなし）',
    retryCameraBtn: 'カメラを再試行',
    fullscreenBtn: '全画面表示',
    exitFullscreenBtn: '全画面解除',
    audioOn: '音声 ON',
    audioOff: '音声 OFF',
    calibrationTitle: 'カメラ調整 & 位置合わせ',
    stepBackInstruction: '上半身が画面内に収まるよう一歩下がってください',
    raiseLeftHandInstruction: '左手を胸の高さまで上げてください',
    openPalmInstruction: '手のひらをカメラに向けて開いてください',
    holdStillInstruction: 'そのまま1秒間キープして調整完了',
    personDetected: '人物検出',
    handDetected: '左手検出',
    palmOpen: '手のひらオープン',
    lightingQuality: '照明環境',
    calibrationReady: '準備完了！まもなく始まります',
    switchHandPrompt: '利き手切替 (左手 / 右手)',
    attractHeadline: '大谷級の一球をキャッチできるか？',
    attractSubheadline: '左手を動かして、向かってくるボールをキャッチ！',
    ruleCatches: '5球中3球キャッチでチャレンジ成功！',
    ruleReward: '成功者には「お〜いお茶」クーポンをプレゼント',
    raiseHandToStart: '左手をかざしてスタート',
    startButton: 'チャレンジ開始',
    countdownGetReady: '位置について... キャッチ準備！',
    pitchCountLabel: '投球数',
    catchCountLabel: 'キャッチ数',
    targetCatchesLabel: '目標: 3球',
    catchSuccessText: 'NICE CATCH!!',
    missText: 'MISS!',
    winHeadline: 'チャレンジ大成功！！',
    winSubheadline: '見事なグラブさばき！ナイスキャッチ！',
    winReward: '「お〜いお茶」1本プレゼントクーポン獲得！',
    scanQrPrompt: 'スマートフォンでQRコードを読み取って受け取ろう',
    couponExpirationNotice: '※有効期限：15分以内にお引き換えください',
    demoCouponNotice: 'DEMO — NOT REDEEMABLE (試作デモ用コード)',
    loseHeadline: 'おしい！あと少し！',
    loseSubheadline: '3球キャッチでクーポン獲得！',
    loseEncourage: 'もう一度チャレンジして、お〜いお茶をゲットしよう！',
    playAgainBtn: 'もう一度プレイ',
    claimCouponBtn: 'クーポン詳細',
    visitWebsiteBtn: 'キャンペーン特設サイト',
    resetBtn: 'リセット',
    inactivityWarning: '操作がないため、まもなく初期画面に戻ります',
    confidenceMeter: '追跡精度'
  },
  en: {
    campaignConcept: 'ITO EN × WBC Baseball Catching Challenge',
    conceptDemoBadge: 'Concept Demo',
    cameraLocalPrivacy: 'Camera is processed 100% locally in your browser',
    cameraNoUpload: 'No video or personal biometric data is stored or uploaded',
    enableCameraBtn: 'Enable Camera',
    demoWithoutCameraBtn: 'Play with Mouse (No Camera)',
    retryCameraBtn: 'Retry Camera',
    fullscreenBtn: 'Full Screen',
    exitFullscreenBtn: 'Exit Full Screen',
    audioOn: 'Audio ON',
    audioOff: 'Audio OFF',
    calibrationTitle: 'Camera Calibration & Positioning',
    stepBackInstruction: 'Step back until your upper body is clearly visible',
    raiseLeftHandInstruction: 'Raise your left hand towards the camera',
    openPalmInstruction: 'Open your palm facing forward',
    holdStillInstruction: 'Hold still for 1 second to calibrate',
    personDetected: 'Person Detected',
    handDetected: 'Left Hand Detected',
    palmOpen: 'Palm Open',
    lightingQuality: 'Lighting Quality',
    calibrationReady: 'Ready! Starting challenge...',
    switchHandPrompt: 'Switch Dominant Hand (Left / Right)',
    attractHeadline: 'Can You Catch the Superstar Pitch?',
    attractSubheadline: 'Move your hand to catch the incoming baseballs!',
    ruleCatches: 'Catch at least 3 out of 5 pitches to win',
    ruleReward: 'Winners receive an ITO EN Oi Ocha Green Tea reward coupon',
    raiseHandToStart: 'Hold your palm over Start or raise hand',
    startButton: 'START CHALLENGE',
    countdownGetReady: 'Get Ready to Catch!',
    pitchCountLabel: 'PITCH',
    catchCountLabel: 'CATCHES',
    targetCatchesLabel: 'GOAL: 3',
    catchSuccessText: 'NICE CATCH!!',
    missText: 'MISS!',
    winHeadline: 'CHALLENGE COMPLETED!!',
    winSubheadline: 'Incredible catching reflexes! Well done!',
    winReward: 'You won a free ITO EN Green Tea Coupon!',
    scanQrPrompt: 'Scan the QR code with your smartphone to claim',
    couponExpirationNotice: '*Valid for 15 minutes. Redeem at counter.',
    demoCouponNotice: 'DEMO — NOT REDEEMABLE (Prototype Code)',
    loseHeadline: 'ALMOST THERE!',
    loseSubheadline: 'Catch 3 pitches to unlock your reward',
    loseEncourage: 'Try again and claim your complimentary green tea!',
    playAgainBtn: 'PLAY AGAIN',
    claimCouponBtn: 'Claim Coupon',
    visitWebsiteBtn: 'Official Campaign Site',
    resetBtn: 'Reset',
    inactivityWarning: 'Returning to attract mode due to inactivity',
    confidenceMeter: 'Tracking'
  },
  'zh-TW': {
    campaignConcept: '伊藤園 ITO EN × WBC 接球體感挑戰賽',
    conceptDemoBadge: '概念展示原型 (Concept Demo)',
    cameraLocalPrivacy: '攝影機影像僅在瀏覽器本地運算處理',
    cameraNoUpload: '絕不儲存或上傳任何影像及個人生物識別數據',
    enableCameraBtn: '啟動攝影機',
    demoWithoutCameraBtn: '使用滑鼠操作體驗（免攝影機）',
    retryCameraBtn: '重新連接攝影機',
    fullscreenBtn: '全螢幕顯示',
    exitFullscreenBtn: '離開全螢幕',
    audioOn: '音效 開啟',
    audioOff: '音效 靜音',
    calibrationTitle: '鏡頭校準與位置確認',
    stepBackInstruction: '請後退一步，讓上半身完整出現在畫面上',
    raiseLeftHandInstruction: '請舉起左手至胸前位置',
    openPalmInstruction: '將手掌朝向鏡頭張開',
    holdStillInstruction: '靜止 1 秒即可完成校準',
    personDetected: '人物辨識',
    handDetected: '左手偵測',
    palmOpen: '手掌展開',
    lightingQuality: '環境光線',
    calibrationReady: '校準完成！即將開始',
    switchHandPrompt: '切換慣用手 (左手 / 右手)',
    attractHeadline: '你能接下巨星級的王牌速球嗎？',
    attractSubheadline: '移動左手，接住迎面飛來的高速棒球！',
    ruleCatches: '5 球中成功接住 3 球即可過關！',
    ruleReward: '挑戰成功即可獲得「伊藤園 お〜いお茶」綠茶兌換券',
    raiseHandToStart: '舉起左手展開手掌即可開始',
    startButton: '立即開始挑戰',
    countdownGetReady: '就定位... 準備接球！',
    pitchCountLabel: '投球數',
    catchCountLabel: '接殺數',
    targetCatchesLabel: '目標: 3 球',
    catchSuccessText: 'NICE CATCH!!',
    missText: 'MISS!',
    winHeadline: '恭喜挑戰成功！！',
    winSubheadline: '完美的守備與敏捷反應！',
    winReward: '獲得「伊藤園 綠茶 530ml」免費兌換券！',
    scanQrPrompt: '請使用智慧型手機掃描 QR Code 領取獎勵',
    couponExpirationNotice: '※兌換券有效期限：15 分鐘內有效',
    demoCouponNotice: 'DEMO — NOT REDEEMABLE (概念測試券)',
    loseHeadline: '差一點就成功了！',
    loseSubheadline: '只要接住 3 球就能獲得綠茶兌換券',
    loseEncourage: '再來一局，把清爽的伊藤園綠茶帶回家！',
    playAgainBtn: '再玩一次',
    claimCouponBtn: '領取獎品',
    visitWebsiteBtn: '活動官方網站',
    resetBtn: '重設遊戲',
    inactivityWarning: '無人操作中，即將返回待機畫面',
    confidenceMeter: '追蹤精度'
  }
};
