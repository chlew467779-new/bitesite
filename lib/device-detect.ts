export function detectDevice(ua: string) {
  const uaLower = ua.toLowerCase();
  
  // Mobile detection — 更全的匹配
  const isMobile = /mobile|android(?!.*tablet)|iphone|ipod|blackberry|iemobile|webos|palm|kindle(?!.*fire)|opera mini/i.test(uaLower);
  
  // Tablet detection — 包含 iPad Pro（Safari 报 Macintosh + touch）
  const isTablet = /ipad|android(?!.*mobile)|tablet|kindle fire|silk|playbook|surface/i.test(uaLower) || 
    (ua.includes('Macintosh') && /touch/i.test(ua));

  const device = isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop';

  // OS detection — 更 robust
  let os = 'Other';
  if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/macintosh|mac os/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/windows phone/i.test(ua)) os = 'Windows Phone';
  else if (/windows/i.test(ua)) os = 'Windows';
  else if (/linux/i.test(ua)) os = 'Linux';
  else if (/chrome os|cros/i.test(ua)) os = 'Chrome OS';

  // Browser detection — 顺序很重要，先排 Edge/Opera 再排 Chrome/Safari
  let browser = 'Other';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/opr|opera|opt/i.test(ua)) browser = 'Opera';
  else if (/samsungbrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/firefox/i.test(ua)) browser = 'Firefox';
  else if (/chrome/i.test(ua) && !/edg|opr|opera/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome|edg|opr|opera/i.test(ua)) browser = 'Safari';
  else if (/brave/i.test(ua)) browser = 'Brave';
  else if (/vivaldi/i.test(ua)) browser = 'Vivaldi';
  else if (/ucbrowser|uc browser/i.test(ua)) browser = 'UC Browser';
  else if (/qqbrowser/i.test(ua)) browser = 'QQ Browser';
  else if (/wechat|micromessenger/i.test(ua)) browser = 'WeChat';

  return { device, os, browser };
}
