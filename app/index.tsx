import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { SplashScreen } from '../src/components/SplashScreen';
import { BottomNavBar, TabKey } from '../src/components/BottomNavBar';
import { MovieFinderScreen } from '../src/components/MovieFinderScreen';
import { MyListScreen } from '../src/components/MyListScreen';
import { BrowserScreen } from '../src/components/BrowserScreen';
import { DownloadsScreen } from '../src/components/DownloadsScreen';
import { SettingsScreen } from '../src/components/SettingsScreen';
import { DownloadProvider, useDownloads } from '../src/context/DownloadContext';
import { TorrentEngineBridge } from '../src/components/torrent/TorrentEngineBridge';
import { Colors } from '../src/constants/theme';

function AppContent() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('home');
  const [pendingBrowserUrl, setPendingBrowserUrl] = useState<string | null>(null);
  const { activeDownloadsCount } = useDownloads();

  const handleOpenInBrowserTab = (url: string) => {
    setPendingBrowserUrl(url);
    setActiveTab('browser');
  };

  return (
    <View style={styles.rootContainer}>
      {/* Animated Splash Screen */}
      {showSplash && (
        <SplashScreen onFinish={() => setShowSplash(false)} />
      )}

      {/* Screen area — fills all space above the nav bar */}
      <View style={styles.screenArea}>
        {/* All screens stay mounted; only the active one is shown via display flex/none
            to preserve WebView state (browser keeps its current page) */}
        <View style={[styles.screen, activeTab === 'home' ? styles.screenVisible : styles.screenHidden]}>
          <MovieFinderScreen 
            onNavigateToTab={setActiveTab}
            onOpenInBrowserTab={handleOpenInBrowserTab}
          />
        </View>

        <View style={[styles.screen, activeTab === 'mylist' ? styles.screenVisible : styles.screenHidden]}>
          <MyListScreen onNavigateToTab={setActiveTab} />
        </View>

        <View style={[styles.screen, activeTab === 'browser' ? styles.screenVisible : styles.screenHidden]}>
          <BrowserScreen 
            onNavigateToDownloads={() => setActiveTab('downloads')}
            pendingUrlToOpen={pendingBrowserUrl}
            onClearPendingUrl={() => setPendingBrowserUrl(null)}
          />
        </View>

        <View style={[styles.screen, activeTab === 'downloads' ? styles.screenVisible : styles.screenHidden]}>
          <DownloadsScreen />
        </View>

        <View style={[styles.screen, activeTab === 'settings' ? styles.screenVisible : styles.screenHidden]}>
          <SettingsScreen />
        </View>

        {/* Headless WebTorrent P2P Engine Bridge */}
        <TorrentEngineBridge />
      </View>

      {/* Bottom Navigation — always visible at the bottom */}
      <BottomNavBar
        activeTab={activeTab}
        onTabSelect={(tab) => setActiveTab(tab)}
        downloadBadgeCount={activeDownloadsCount}
      />
    </View>
  );
}

export default function MainScreen() {
  return (
    <DownloadProvider>
      <AppContent />
    </DownloadProvider>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    flexDirection: 'column',
  },
  screenArea: {
    flex: 1,
    position: 'relative',
    backgroundColor: Colors.background,
  },
  screen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  screenVisible: {
    display: 'flex',
    zIndex: 1,
  },
  screenHidden: {
    display: 'none',
    zIndex: 0,
  },
});
