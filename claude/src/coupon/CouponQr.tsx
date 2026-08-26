import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

/**
 * QR code rendered locally from the claim URL.
 * High error correction and a wide quiet zone so it still scans from a metre
 * away on a bright signage panel.
 */
export function CouponQr({ url, size = 320 }: { url: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: size * 2,
      color: { dark: '#061428', light: '#ffffff' },
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => !cancelled && setError(true));
    return () => {
      cancelled = true;
    };
  }, [url, size]);

  if (error) {
    return (
      <div
        className="flex items-center justify-center rounded-[1.2vmin] bg-white p-[2vmin] text-center text-[0.8rem] text-black"
        style={{ width: size, height: size }}
      >
        {url}
      </div>
    );
  }

  return (
    <div className="rounded-[1.4vmin] bg-white p-[1.4vmin] shadow-[0_2vmin_5vmin_rgba(0,0,0,0.45)]">
      {dataUrl ? (
        <img src={dataUrl} alt="Coupon QR code" width={size} height={size} className="block" />
      ) : (
        <div style={{ width: size, height: size }} className="animate-pulse rounded bg-slate-200" />
      )}
    </div>
  );
}
