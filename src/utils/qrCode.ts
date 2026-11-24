import QRCode from 'qrcode';

export async function generateQrDataUrl(content: string): Promise<string> {
  return QRCode.toDataURL(content, {
    width: 640,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
}

export function triggerDataUrlDownload(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
