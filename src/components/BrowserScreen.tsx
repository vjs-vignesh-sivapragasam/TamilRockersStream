import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Share,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { Download, ArrowRight, X, Clock } from 'lucide-react-native';
import { Colors } from '../constants/theme';
import { BrowserTab, HistoryItem } from '../types/browser';
import { INJECTED_AD_SHIELD_SCRIPT, isAdOrVulnerableUrl } from '../utils/adBlocker';
import { isTorrentUrl, extractTorrentFileName } from '../utils/bencode';
import { useDownloads } from '../context/DownloadContext';
import { browserHistoryService } from '../services/browserHistoryService';
import { BrowserOmnibar } from './browser/BrowserOmnibar';
import { BrowserToolbar } from './browser/BrowserToolbar';
import { BrowserTabSwitcher } from './browser/BrowserTabSwitcher';
import { BrowserShieldModal } from './browser/BrowserShieldModal';

const DEFAULT_HOMEPAGE = 'https://www.google.co.in';

const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const INJECTED_TORRENT_INTERCEPTOR = `
  (function() {
    document.addEventListener('click', function(e) {
      var el = e.target;
      while (el && el.tagName !== 'A') {
        el = el.parentElement;
      }
      if (el && el.href) {
        var href = el.href;
        var lower = href.toLowerCase();
        if (lower.indexOf('.torrent') !== -1 || lower.indexOf('magnet:') === 0) {
          e.preventDefault();
          e.stopPropagation();
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'TORRENT_DOWNLOAD',
              url: href,
              title: el.getAttribute('download') || el.innerText || el.title || ''
            }));
          }
          return false;
        }
      }
    }, true);
  })();
`;

interface BrowserScreenProps {
  onNavigateToDownloads?: () => void;
}

export const BrowserScreen: React.FC<BrowserScreenProps> = ({ onNavigateToDownloads }) => {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const { startDownload } = useDownloads();

  // Tabs Management State
  const [tabs, setTabs] = useState<BrowserTab[]>([
    {
      id: 'tab-1',
      url: DEFAULT_HOMEPAGE,
      title: 'Google',
      canGoBack: false,
      canGoForward: false,
      loading: true,
      progress: 0,
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');

  // Input & Navigation State
  const [urlInput, setUrlInput] = useState(DEFAULT_HOMEPAGE);

  // Previous History State
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyOverlayVisible, setHistoryOverlayVisible] = useState(false);

  // Modals
  const [tabSwitcherVisible, setTabSwitcherVisible] = useState(false);
  const [shieldModalVisible, setShieldModalVisible] = useState(false);

  // Load history on mount
  React.useEffect(() => {
    browserHistoryService.getHistory().then(setHistory);
  }, []);

  const handleDeleteHistoryItem = (id: string) => {
    browserHistoryService.removeEntry(id).then(setHistory);
  };

  const handleClearHistory = () => {
    browserHistoryService.clearHistory().then(setHistory);
  };

  // Ad Shield & Privacy Settings
  const [adBlockEnabled, setAdBlockEnabled] = useState(true);
  const [strictMode, setStrictMode] = useState(true);
  const [blockedCount, setBlockedCount] = useState(0);
  const [isDesktopMode, setIsDesktopMode] = useState(false);

  // Torrent Download Notification Toast
  const [toastInfo, setToastInfo] = useState<{
    title: string;
  } | null>(null);

  // Active Tab Finder
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

  const updateActiveTab = (updates: Partial<BrowserTab>) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, ...updates } : t))
    );
  };

  const handleDownloadTorrent = (url: string, suggestedTitle?: string) => {
    startDownload(url, suggestedTitle);
    const fileName = extractTorrentFileName(url, suggestedTitle);
    setToastInfo({
      title: suggestedTitle || fileName,
    });
    setTimeout(() => {
      setToastInfo(null);
    }, 5000);
  };

  const handleNavigate = (input: string) => {
    let target = input.trim();
    if (!target) return;

    setHistoryOverlayVisible(false);

    // Check if input is a direct torrent or magnet link
    if (isTorrentUrl(target)) {
      handleDownloadTorrent(target);
      setUrlInput('');
      return;
    }

    if (!target.startsWith('http://') && !target.startsWith('https://')) {
      if (target.includes('.') && !target.includes(' ')) {
        target = `https://${target}`;
      } else {
        target = `https://www.google.co.in/search?q=${encodeURIComponent(target)}`;
      }
    }

    setUrlInput(target);
    updateActiveTab({ url: target, title: target, loading: true });
    browserHistoryService.addEntry(target).then(setHistory);
  };

  const handleNewTab = (initialUrl = DEFAULT_HOMEPAGE) => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newTabId,
      url: initialUrl,
      title: 'Google',
      canGoBack: false,
      canGoForward: false,
      loading: true,
      progress: 0,
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTabId);
    setUrlInput(initialUrl);
    setTabSwitcherVisible(false);
  };

  const handleCloseTab = (idToClose: string) => {
    if (tabs.length <= 1) {
      updateActiveTab({
        url: DEFAULT_HOMEPAGE,
        title: 'Google',
        canGoBack: false,
        canGoForward: false,
        loading: true,
      });
      setUrlInput(DEFAULT_HOMEPAGE);
      return;
    }

    const filtered = tabs.filter((t) => t.id !== idToClose);
    setTabs(filtered);

    if (activeTabId === idToClose) {
      const nextActive = filtered[filtered.length - 1];
      setActiveTabId(nextActive.id);
      setUrlInput(nextActive.url);
    }
  };

  const handleShare = async () => {
    if (activeTab.url) {
      try {
        await Share.share({ url: activeTab.url, message: activeTab.url });
      } catch (err) {
        console.log('Share error:', err);
      }
    }
  };

  const shouldStartLoadWithRequest = (request: any): boolean => {
    const reqUrl = (request.url || '').toLowerCase();

    // 1. Intercept .torrent and magnet: downloads
    if (isTorrentUrl(reqUrl)) {
      handleDownloadTorrent(request.url, request.title);
      return false;
    }

    if (!adBlockEnabled) return true;

    // 2. Block ad networks, pop-unders, dangerous schemes, and vulnerable downloads
    const vulnerabilityCheck = isAdOrVulnerableUrl(reqUrl);
    if (vulnerabilityCheck.isBlocked) {
      setBlockedCount((prev) => prev + 1);
      return false;
    }

    // 3. In strict mode, prevent unwanted automated redirects (navigationType === 'other') to foreign 3rd-party domains
    if (strictMode && request.navigationType === 'other' && activeTab.url) {
      try {
        const currentHost = new URL(activeTab.url).hostname.replace(/^www\./, '');
        const targetHost = new URL(request.url).hostname.replace(/^www\./, '');
        if (
          targetHost &&
          currentHost &&
          !targetHost.endsWith(currentHost) &&
          !currentHost.endsWith(targetHost)
        ) {
          const isCommonSafeDomain =
            targetHost.includes('google.') ||
            targetHost.includes('bing.') ||
            targetHost.includes('duckduckgo.');
          if (!isCommonSafeDomain) {
            setBlockedCount((prev) => prev + 1);
            return false;
          }
        }
      } catch {
        // Ignore URL parsing errors
      }
    }

    return true;
  };

  const combinedScript = `${INJECTED_TORRENT_INTERCEPTOR}\n${
    adBlockEnabled ? INJECTED_AD_SHIELD_SCRIPT : ''
  }`;

  const filteredHistory = history.filter((h) => {
    if (!urlInput || urlInput === DEFAULT_HOMEPAGE) return true;
    const q = urlInput.toLowerCase().trim();
    return h.title.toLowerCase().includes(q) || h.url.toLowerCase().includes(q);
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + 6 }]}>
      {/* 1. Modern Omnibar Header */}
      <BrowserOmnibar
        urlInput={urlInput}
        currentUrl={activeTab.url}
        onChangeUrl={setUrlInput}
        onSubmitUrl={() => handleNavigate(urlInput)}
        onClear={() => setUrlInput('')}
        onFocus={() => setHistoryOverlayVisible(true)}
        onOpenShield={() => setShieldModalVisible(true)}
        onOpenTabs={() => setTabSwitcherVisible(true)}
        tabCount={tabs.length}
        adBlockActive={adBlockEnabled}
        blockedCount={blockedCount}
      />

      {/* 2. Page Loading Progress Indicator */}
      {activeTab.loading && (
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.max(activeTab.progress * 100, 15)}%` },
            ]}
          />
        </View>
      )}

      {/* Previous History Dropdown Overlay */}
      {historyOverlayVisible && (
        <View style={styles.historyOverlay}>
          <TouchableOpacity
            style={styles.historyBackdrop}
            activeOpacity={1}
            onPress={() => setHistoryOverlayVisible(false)}
          />
          <View style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={styles.historyHeaderLeft}>
                <Clock color={Colors.netflixRed} size={16} />
                <Text style={styles.historyHeaderTitle}>Previous History</Text>
              </View>
              {history.length > 0 && (
                <TouchableOpacity onPress={handleClearHistory} activeOpacity={0.7}>
                  <Text style={styles.clearAllText}>Clear All</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView
              style={styles.historyList}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.historyRow}
                    onPress={() => {
                      setUrlInput(item.url);
                      handleNavigate(item.url);
                    }}
                    activeOpacity={0.7}
                  >
                    <Clock color="#777777" size={15} />
                    <View style={styles.historyTextContainer}>
                      <Text style={styles.historyTitle} numberOfLines={1}>
                        {item.title}
                      </Text>
                      <Text style={styles.historyUrl} numberOfLines={1}>
                        {item.url}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        handleDeleteHistoryItem(item.id);
                      }}
                      style={styles.deleteHistoryItemBtn}
                      activeOpacity={0.7}
                    >
                      <X color="#666666" size={14} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.emptyHistory}>
                  <Text style={styles.emptyHistoryText}>No matching history</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}

      {/* 3. Main Body View: Direct Full-Screen WebView with Ad Shield */}
      <View style={styles.webContainer}>
        <WebView
          ref={webViewRef}
          key={`${activeTab.id}-${isDesktopMode ? 'desktop' : 'mobile'}`}
          source={{ uri: activeTab.url || DEFAULT_HOMEPAGE }}
          userAgent={isDesktopMode ? DESKTOP_USER_AGENT : undefined}
          style={styles.webView}
          onNavigationStateChange={(navState) => {
            updateActiveTab({
              canGoBack: navState.canGoBack,
              canGoForward: navState.canGoForward,
              title: navState.title || navState.url,
            });
            setUrlInput(navState.url);
            if (navState.url && navState.url !== 'about:blank' && !navState.loading) {
              browserHistoryService.addEntry(navState.url, navState.title).then(setHistory);
            }
          }}
          onShouldStartLoadWithRequest={shouldStartLoadWithRequest}
          injectedJavaScriptBeforeContentLoaded={combinedScript}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'TORRENT_DOWNLOAD' && data.url) {
                handleDownloadTorrent(data.url, data.title);
              } else if (data.type === 'AD_BLOCKED') {
                setBlockedCount((prev) => prev + 1);
              }
            } catch {}
          }}
          onLoadStart={() => updateActiveTab({ loading: true })}
          onLoadProgress={({ nativeEvent }) =>
            updateActiveTab({ progress: nativeEvent.progress })
          }
          onLoadEnd={() => updateActiveTab({ loading: false, progress: 0 })}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          javaScriptCanOpenWindowsAutomatically={false}
          setSupportMultipleWindows={false}
          allowsBackForwardNavigationGestures
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={Colors.netflixRed} />
              <Text style={styles.loadingText}>Loading webpage with Ad Shield...</Text>
            </View>
          )}
        />
      </View>

      {/* Torrent Download Toast Banner */}
      {toastInfo && (
        <View style={styles.toastContainer}>
          <View style={styles.toastCard}>
            <View style={styles.toastIconBox}>
              <Download color="#FFFFFF" size={18} />
            </View>
            <View style={styles.toastTextGroup}>
              <Text style={styles.toastTitle}>Torrent Download Started</Text>
              <Text style={styles.toastSubtitle} numberOfLines={1}>
                {toastInfo.title}
              </Text>
            </View>
            {onNavigateToDownloads && (
              <TouchableOpacity
                style={styles.toastActionBtn}
                onPress={() => {
                  setToastInfo(null);
                  onNavigateToDownloads();
                }}
              >
                <Text style={styles.toastActionText}>View</Text>
                <ArrowRight color="#FFFFFF" size={14} />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => setToastInfo(null)}
              style={styles.toastCloseBtn}
            >
              <X color="#888888" size={16} />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 4. Bottom Browser Toolbar */}
      <BrowserToolbar
        canGoBack={activeTab.canGoBack}
        canGoForward={activeTab.canGoForward}
        onGoBack={() => {
          if (activeTab.canGoBack) webViewRef.current?.goBack();
          else {
            updateActiveTab({ url: DEFAULT_HOMEPAGE, title: 'Google', loading: true });
            setUrlInput(DEFAULT_HOMEPAGE);
          }
        }}
        onGoForward={() => {
          if (activeTab.canGoForward) webViewRef.current?.goForward();
        }}
      />

      {/* 5. Modals */}
      <BrowserTabSwitcher
        visible={tabSwitcherVisible}
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={(id) => {
          setActiveTabId(id);
          const t = tabs.find((x) => x.id === id);
          setUrlInput(t?.url || DEFAULT_HOMEPAGE);
          setTabSwitcherVisible(false);
        }}
        onCloseTab={handleCloseTab}
        onNewTab={() => handleNewTab(DEFAULT_HOMEPAGE)}
        onCloseModal={() => setTabSwitcherVisible(false)}
      />

      <BrowserShieldModal
        visible={shieldModalVisible}
        onClose={() => setShieldModalVisible(false)}
        adBlockEnabled={adBlockEnabled}
        onToggleAdBlock={setAdBlockEnabled}
        blockedCount={blockedCount}
        strictMode={strictMode}
        onToggleStrictMode={setStrictMode}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  progressTrack: {
    height: 2.5,
    backgroundColor: 'transparent',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.netflixRed,
  },
  webContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#888888',
    fontSize: 12,
  },
  toastContainer: {
    position: 'absolute',
    bottom: 60,
    left: 14,
    right: 14,
    zIndex: 999,
  },
  toastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#202020',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#383838',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    gap: 10,
  },
  toastIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.netflixRed,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toastTextGroup: {
    flex: 1,
    gap: 2,
  },
  toastTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  toastSubtitle: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  toastActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  toastActionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  toastCloseBtn: {
    padding: 4,
  },
  historyOverlay: {
    position: 'absolute',
    top: 56,
    left: 10,
    right: 10,
    bottom: 40,
    zIndex: 900,
  },
  historyBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  historyCard: {
    backgroundColor: '#1E1E1E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#303030',
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    overflow: 'hidden',
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#2C2C2C',
    backgroundColor: '#1A1A1A',
  },
  historyHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  historyHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  clearAllText: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
  },
  historyList: {
    maxHeight: 340,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 0.5,
    borderBottomColor: '#262626',
    gap: 12,
  },
  historyTextContainer: {
    flex: 1,
    gap: 2,
  },
  historyTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  historyUrl: {
    color: '#777777',
    fontSize: 11,
  },
  deleteHistoryItemBtn: {
    padding: 6,
  },
  emptyHistory: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryText: {
    color: '#666666',
    fontSize: 12,
  },
});
