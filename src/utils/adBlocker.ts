/**
 * Comprehensive Ad, Popup, Clickjack, and Tracker Blocker
 * Specially tuned for Movie, Torrent, and Streaming websites.
 */

export const AD_PATTERNS = [
  // Major Ad Networks & Pop-Under Networks
  'doubleclick.net',
  'googleads',
  'googlesyndication.com',
  'adservice.google.',
  'popads.net',
  'popcash.net',
  'propellerads.com',
  'propellerclick.com',
  'adsterra.com',
  'exoclick.com',
  'syndication.exoclick.com',
  'juicyads.com',
  'clickadu.com',
  'hilltopads.net',
  'adbuffs.com',
  'revenuehits.com',
  'bidvertiser.com',
  'infolinks.com',
  'monetag.com',
  'galaksion.com',
  'trafficstars.com',
  'trafficjunky.com',
  'trafficnomads.com',
  'admaven.com',
  'adroll.com',
  'taboola.com',
  'outbrain.com',
  'zergnet.com',
  'mgid.com',
  'revcontent.com',
  'onclickperf.com',
  'onclickmega.com',
  'deloton.com',
  'adkeeper.com',
  'popmyads.com',
  'yllix.com',
  'clksite.com',
  'bidgear.com',
  'ero-advertising.com',
  'realsrv.com',
  'exdynsrv.com',
  'adexc.net',
  'adblade.com',
  'smartadserver.com',
  'rubiconproject.com',
  'pubmatic.com',
  'openx.net',
  'appnexus.com',
  'casalemedia.com',
  'adnxs.com',
  'criteo.com',
  'criteo.net',
  'sovrn.com',
  'yieldmo.com',
  'undertone.com',
  'inmobi.com',
  'moatads.com',
  'doubleverify.com',

  // Push Notifications & Scam Redirectors
  'richpush.com',
  'evadav.com',
  'pushpro.com',
  'truepush.com',
  'daopush.com',
  'coinhive.com',
  'jscache.com',
  'histats.com',
  'zedo.com',
  'clicksor.com',

  // Betting, Gambling & Casino Popups
  '1xbet',
  'bet365',
  'melbet',
  'parimatch',
  'mostbet',
  'betway',
  'stake.com',
  'dafabet',
  '1win',
  'vulkan',
  'pin-up',
  'linebet',
  'fairplay',
  'betwinner',
  '22bet',
  'megapari',
  'spin-win',
  'lucky-wheel',
  'roulette',
  'jackpot-city',

  // Malicious Redirects, Fake Cleaners & Scams
  'update-chrome',
  'update-browser',
  'phone-cleaner',
  'virus-alert',
  'infected-phone',
  'security-warning',
  'clean-my-phone',
  'fast-download.php',
  'direct-download.php',
  'onclick',
  'popunder',
  'banner-ad',
  'ad-delivery',
  'delivery-tracker',
  'clickserve',
  'go2cloud',
  'trackvoluum',
  'affiliate',
  'prelanding',
  'leadgid',
  'adtrack',
  'rtb-demand',
  'creativecdn',
];

export const VULNERABLE_SCHEMES = [
  'intent:',
  'market:',
  'itms-appss:',
  'tg:',
  'whatsapp:',
  'tel:',
  'sms:',
  'viber:',
  'fb-messenger:',
  'line:',
  'skype:',
];

export const VULNERABLE_EXTENSIONS = [
  '.apk',
  '.exe',
  '.scr',
  '.bat',
  '.msi',
  '.vbs',
  '.dmg',
  '.crx',
];

export function isAdOrVulnerableUrl(url: string): { isBlocked: boolean; reason?: string } {
  if (!url) return { isBlocked: false };
  const lower = url.trim().toLowerCase();

  // 1. External protocol hijacks
  for (const scheme of VULNERABLE_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { isBlocked: true, reason: `Protocol hijack blocked (${scheme})` };
    }
  }

  // 2. Dangerous file extensions (e.g. rogue APK or EXE auto-downloads)
  const cleanPath = lower.split('?')[0].split('#')[0];
  for (const ext of VULNERABLE_EXTENSIONS) {
    if (cleanPath.endsWith(ext)) {
      return { isBlocked: true, reason: `Dangerous download blocked (${ext})` };
    }
  }

  // 3. Known ad & popunder networks
  for (const pattern of AD_PATTERNS) {
    if (lower.includes(pattern)) {
      return { isBlocked: true, reason: `Ad network blocked (${pattern})` };
    }
  }

  return { isBlocked: false };
}

export const INJECTED_AD_SHIELD_SCRIPT = `
(function() {
  if (window.__adShieldInstalled) return;
  window.__adShieldInstalled = true;

  function notifyNativeBlocked(reason, url) {
    try {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'AD_BLOCKED',
          reason: reason,
          url: url || ''
        }));
      }
    } catch(e) {}
  }

  // 1. HARD-FREEZE window.open to permanently prevent popups and new tabs
  var dummyWindowProxy = {
    closed: true,
    focus: function() {},
    blur: function() {},
    close: function() {},
    postMessage: function() {},
    location: { href: '' }
  };

  try {
    Object.defineProperty(window, 'open', {
      configurable: false,
      writable: false,
      value: function(url, target, features) {
        console.log('[AdShield] Blocked popup window.open:', url);
        notifyNativeBlocked('Popup window.open prevented', url);
        return dummyWindowProxy;
      }
    });
  } catch(e) {
    window.open = function(url) {
      console.log('[AdShield] Blocked window.open:', url);
      notifyNativeBlocked('Popup window.open prevented', url);
      return dummyWindowProxy;
    };
  }

  // 2. Prevent window.open leaks inside newly created iframes
  try {
    var origAppend = Element.prototype.appendChild;
    Element.prototype.appendChild = function(child) {
      if (child && child.tagName === 'IFRAME') {
        try {
          if (child.contentWindow) {
            child.contentWindow.open = window.open;
          }
        } catch(e) {}
      }
      return origAppend.apply(this, arguments);
    };
  } catch(e) {}

  // 3. Neutralize scareware alerts ("Phone infected", "Battery virus", fake winner)
  var SCAM_KEYWORDS = [
    'virus', 'infected', 'update chrome', 'cleaner', 'battery', 'damaged',
    'winner', 'prize', 'congratulations', 'phishing', 'hacked', 'security check',
    'trojan', 'critical error'
  ];

  function containsScamWord(msg) {
    if (!msg) return false;
    var str = (msg + '').toLowerCase();
    for (var i = 0; i < SCAM_KEYWORDS.length; i++) {
      if (str.indexOf(SCAM_KEYWORDS[i]) !== -1) return true;
    }
    return false;
  }

  var rawAlert = window.alert;
  window.alert = function(msg) {
    if (containsScamWord(msg)) {
      console.log('[AdShield] Suppressed scareware alert:', msg);
      notifyNativeBlocked('Scam alert dialog suppressed', msg);
      return;
    }
    return rawAlert ? rawAlert(msg) : undefined;
  };

  window.confirm = function(msg) {
    if (containsScamWord(msg)) {
      notifyNativeBlocked('Scam confirm dialog suppressed', msg);
      return false;
    }
    return true;
  };

  window.prompt = function(msg) {
    return null;
  };

  // 4. Intercept Clickjacking & Force '_self' instead of '_blank'
  document.addEventListener('click', function(e) {
    var el = e.target;
    var depth = 0;
    while (el && depth < 8) {
      if (el.tagName === 'A') {
        // Prevent opening unwanted new tabs on ads
        if (el.target === '_blank') {
          el.target = '_self';
        }

        var href = (el.getAttribute('href') || '').toLowerCase();
        var onclick = (el.getAttribute('onclick') || '').toLowerCase();

        // Block javascript:window.open hijack links
        if (href.indexOf('javascript:window.open') !== -1 || href.indexOf('void(window.open') !== -1 || onclick.indexOf('window.open') !== -1) {
          e.preventDefault();
          e.stopPropagation();
          notifyNativeBlocked('Clickjack window.open prevented', href);
          return false;
        }

        // Block suspicious betting / scam domains directly on click
        var badAdKeys = ['1xbet', 'bet365', 'popads', 'propeller', 'adsterra', 'clickadu', 'monetag', 'exoclick', 'deloton', 'onclick'];
        for (var b = 0; b < badAdKeys.length; b++) {
          if (href.indexOf(badAdKeys[b]) !== -1) {
            e.preventDefault();
            e.stopPropagation();
            notifyNativeBlocked('Ad navigation prevented on click', href);
            return false;
          }
        }
      }
      el = el.parentElement;
      depth++;
    }
  }, true);

  // 5. Remove transparent clickjack overlay layers on touchstart & pointerdown
  function isClickjackOverlay(node) {
    if (!node || node === document.body || node === document.documentElement) return false;
    try {
      var s = window.getComputedStyle(node);
      var z = parseInt(s.zIndex, 10);
      var isFixed = s.position === 'fixed' || s.position === 'absolute';
      var isFull = node.offsetWidth > (window.innerWidth * 0.5) && node.offsetHeight > (window.innerHeight * 0.5);
      var isTransparent = parseFloat(s.opacity) < 0.1 || s.backgroundColor === 'transparent' || s.backgroundColor === 'rgba(0, 0, 0, 0)';

      if (isFixed && isFull && (z > 50 || isTransparent)) {
        if (!node.querySelector('video, img, input, form, button')) {
          return true;
        }
      }
    } catch(e) {}
    return false;
  }

  function handleTouchCapture(e) {
    if (isClickjackOverlay(e.target)) {
      e.preventDefault();
      e.stopPropagation();
      try { e.target.remove(); } catch(err) {}
      console.log('[AdShield] Removed transparent clickjack overlay on touch');
      notifyNativeBlocked('Clickjack overlay destroyed', '');
      return false;
    }
  }

  document.addEventListener('pointerdown', handleTouchCapture, true);
  document.addEventListener('touchstart', handleTouchCapture, true);

  // 6. Passive Clickjack Overlay Sweeper
  function cleanClickjackOverlays() {
    try {
      var nodes = document.querySelectorAll('div, a, section, span');
      for (var i = 0; i < nodes.length; i++) {
        var node = nodes[i];
        if (isClickjackOverlay(node)) {
          node.remove();
          notifyNativeBlocked('Clickjack overlay wiped', '');
        }
      }
    } catch(e) {}
  }

  // 7. Cosmetic Ad Hiding Styles
  function applyCosmeticFilter() {
    var style = document.getElementById('ad-shield-style-v3');
    if (!style) {
      style = document.createElement('style');
      style.id = 'ad-shield-style-v3';
      style.innerHTML = \`
        iframe[src*="ad"], iframe[id*="google_ads"], iframe[id*="ad_"],
        [class*="ad-banner"], [class*="advertisement"], [id*="banner-ad"],
        [class*="popup-ad"], [class*="overlay-ad"], [id*="ad_container"],
        [class*="popunder"], [id*="popunder"], [class*="modal-ad"],
        .ad, .ads, .adsbox, .ad-placement, div[data-ad-unit],
        .floating-banner, .sticky-ad, [data-adzone],
        div[id^="ad-"], div[class^="ad-"], [class*="sponsored"] {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          max-height: 0 !important;
          opacity: 0 !important;
          pointer-events: none !important;
        }
      \`;
      try {
        (document.head || document.documentElement).appendChild(style);
      } catch(e) {}
    }
  }

  applyCosmeticFilter();
  cleanClickjackOverlays();

  document.addEventListener('DOMContentLoaded', function() {
    applyCosmeticFilter();
    cleanClickjackOverlays();
  });

  setInterval(function() {
    applyCosmeticFilter();
    cleanClickjackOverlays();
  }, 1000);
})();
true;
`;
