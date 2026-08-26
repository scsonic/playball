import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface CouponQrProps {
  url: string;
  size?: number;
  className?: string;
}

export const CouponQr: React.FC<CouponQrProps> = ({ url, size = 200, className = '' }) => {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    if (!url) return;

    QRCode.toDataURL(url, {
      width: size * 2,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      },
      errorCorrectionLevel: 'H'
    })
      .then((res) => setDataUrl(res))
      .catch((err) => console.error('[CouponQr] Failed to generate QR:', err));
  }, [url, size]);

  if (!dataUrl) {
    return (
      <div
        className={`flex items-center justify-center bg-white rounded-2xl animate-pulse ${className}`}
        style={{ width: size, height: size }}
      >
        <span className="text-slate-400 text-xs font-bold">QR Loading...</span>
      </div>
    );
  }

  return (
    <div className={`p-3 bg-white rounded-2xl shadow-xl flex flex-col items-center justify-center ${className}`}>
      <img
        src={dataUrl}
        alt="Scan to claim ITO EN Green Tea Coupon"
        style={{ width: size, height: size }}
        className="rounded-lg"
      />
    </div>
  );
};
