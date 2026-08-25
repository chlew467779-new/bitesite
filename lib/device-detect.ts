export function detectDevice(ua: string) {
  const isMobile = /Mobile|Android|iPhone|iPod/i.test(ua) && !/iPad|Tablet/i.test(ua);
  const isTablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);
  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  const os = /iPhone|iPad|iPod/i.test(ua) ? 'iOS' 
    : /Android/i.test(ua) ? 'Android'
    : /Windows/i.test(ua) ? 'Windows'
    : /Mac/i.test(ua) ? 'macOS'
    : /Linux/i.test(ua) ? 'Linux' : 'Other';

  const browser = /Chrome/i.test(ua) && !/Edg/i.test(ua) ? 'Chrome'
    : /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'Safari'
    : /SamsungBrowser/i.test(ua) ? 'Samsung Internet'
    : /Firefox/i.test(ua) ? 'Firefox'
    : /Edg/i.test(ua) ? 'Edge' : 'Other';

  return { device, os, browser };
}
