import React, { useEffect, useMemo, useRef, useCallback, useState } from 'react';
import {
  Modal,
  Platform,
  StatusBar,
  StyleSheet,
  View,
  Alert,
  BackHandler,
  Linking,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as FileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { DownloadItem } from '../types/downloads';
import { continueWatchingService } from '../services/continueWatchingService';
import { Subtitle } from '@/components/coreplayer/models';
import OpenSubtitlesClient, { SubtitleResult } from '@/clients/opensubtitles';
import { storageService, StorageKeys } from '@/utils/StorageService';
import { isKSPlayerSupported } from '@/utils/MediaPlayer';

interface OfflinePlayerModalProps {
  visible: boolean;
  item: DownloadItem | null;
  initialPositionSec?: number;
  posterUrl?: string | null;
  onClose: () => void;
}

interface PlaybackPositionEvent {
  positionSeconds: number;
  durationSeconds: number;
}

interface BackEvent {
  message: string;
  code?: string;
  positionSeconds: number;
  durationSeconds: number;
  player: 'native' | 'ksplayer';
}

interface PlaybackErrorEvent {
  error: string;
}

export const OfflinePlayerModal: React.FC<OfflinePlayerModalProps> = ({
  visible,
  item,
  initialPositionSec = 0,
  posterUrl = null,
  onClose,
}) => {
  const lastKnownTimeRef = useRef<number>(initialPositionSec || 0);
  const durationRef = useRef<number>(0);
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  const [openSubtitlesClient, setOpenSubtitlesClient] = useState<OpenSubtitlesClient | null>(null);

  // Orientation & Status Bar setup
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    const setupPlayerScreen = async () => {
      if (Platform.OS !== 'web') {
        try {
          await ScreenOrientation.unlockAsync();
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
          StatusBar.setHidden(true, 'slide');
        } catch (e) {
          console.warn('[OfflinePlayerModal] Orientation lock failed:', e);
        }
      }
    };

    setupPlayerScreen();

    const onBackPress = () => {
      handleClosePlayer();
      return true;
    };
    const backSubscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);

    return () => {
      backSubscription.remove();
      if (Platform.OS !== 'web') {
        (async () => {
          try {
            await ScreenOrientation.unlockAsync();
            await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
            StatusBar.setHidden(false, 'slide');
          } catch {}
        })();
      }
    };
  }, [visible]);

  // Initialize OpenSubtitles client
  useEffect(() => {
    try {
      const customApiKey = storageService.getItem(StorageKeys.OPENSUBTITLES_API_KEY);
      const client = new OpenSubtitlesClient(customApiKey);
      setOpenSubtitlesClient(client);
    } catch {
      setOpenSubtitlesClient(null);
    }
  }, []);

  // Check for local same-folder subtitle file (.srt / .vtt)
  useEffect(() => {
    if (!item || !visible) return;

    let isMounted = true;
    const targetUri = item.fileUri || item.movieFileUri;

    const checkLocalSubs = async () => {
      if (!targetUri || !targetUri.startsWith('file://')) return;

      const candidates = [
        targetUri.replace(/\.[a-z0-9]+$/i, '.srt'),
        targetUri.replace(/\.[a-z0-9]+$/i, '.vtt'),
      ];

      for (const uri of candidates) {
        try {
          const info = await FileSystem.getInfoAsync(uri);
          if (info.exists && isMounted) {
            const ext = uri.endsWith('.srt') ? 'SRT' : 'VTT';
            setSubtitles([
              {
                fileId: 'local_sub',
                language: 'en',
                url: uri,
                label: `Local Subtitle (${ext})`,
              },
            ]);
            return;
          }
        } catch {}
      }
    };

    checkLocalSubs();

    return () => {
      isMounted = false;
    };
  }, [item, visible]);

  // Resolve direct video source URL
  const effectiveVideoSrc = useMemo(() => {
    if (!item) return '';
    let raw = item.fileUri || item.movieFileUri || item.url || '';
    if (!raw) return '';

    let clean = raw.trim();
    if (
      !clean.startsWith('file://') &&
      !clean.startsWith('content://') &&
      !clean.startsWith('http://') &&
      !clean.startsWith('https://')
    ) {
      clean = 'file://' + clean;
    }
    return clean;
  }, [item]);

  const movieTitle = useMemo(() => {
    return item?.title || item?.movieFileName || item?.fileName || 'Offline Movie';
  }, [item]);

  const saveProgress = useCallback(
    (curTime: number, dur: number) => {
      if (!item || dur <= 0) return;
      const id = item.url || item.fileUri || item.id || movieTitle;
      continueWatchingService.saveProgress({
        id,
        movieTitle,
        currentTime: curTime,
        duration: dur,
        posterUrl: posterUrl || item.poster || null,
        fileUri: item.fileUri || item.movieFileUri,
        streamUrl: item.url,
      });
    },
    [item, movieTitle, posterUrl]
  );

  const handleClosePlayer = useCallback(async () => {
    if (lastKnownTimeRef.current > 5 && durationRef.current > 0) {
      saveProgress(lastKnownTimeRef.current, durationRef.current);
    }
    if (Platform.OS !== 'web') {
      try {
        await ScreenOrientation.unlockAsync();
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        StatusBar.setHidden(false, 'slide');
      } catch {}
    }
    onClose();
  }, [saveProgress, onClose]);

  const handleBack = useCallback(
    (event: BackEvent) => {
      if (event.positionSeconds > 0 && event.durationSeconds > 0) {
        lastKnownTimeRef.current = event.positionSeconds;
        durationRef.current = event.durationSeconds;
        saveProgress(event.positionSeconds, event.durationSeconds);
      }
      handleClosePlayer();
    },
    [handleClosePlayer, saveProgress]
  );

  const handleUpdateProgress = useCallback(
    (event: PlaybackPositionEvent) => {
      lastKnownTimeRef.current = event.positionSeconds;
      durationRef.current = event.durationSeconds;
      saveProgress(event.positionSeconds, event.durationSeconds);
    },
    [saveProgress]
  );

  const handlePlaybackError = useCallback(
    (event: PlaybackErrorEvent) => {
      console.warn('[OfflinePlayerModal] Playback error:', event.error);
      const isFormatError =
        event.error?.includes('HTML5 player could not decode') ||
        event.error?.includes('unsupported format') ||
        event.error?.includes('embedded player');

      const message = isFormatError
        ? 'This stream format (e.g. MKV container, HEVC video, or Dolby AC3 audio) cannot be decoded inside Expo Go.\n\nYou can open it in VLC, copy the stream link for Infuse/Outplayer, or use an iOS Development Build with KSPlayer.'
        : (event.error || 'Unable to play this video format. Make sure the file exists and is not corrupted.');

      Alert.alert(
        'Playback Notice',
        message,
        [
          {
            text: 'Open in VLC',
            onPress: () => {
              if (effectiveVideoSrc) {
                Linking.openURL(`vlc://${effectiveVideoSrc}`).catch(() => {
                  Linking.openURL(effectiveVideoSrc).catch(() => {});
                });
              }
              handleClosePlayer();
            },
          },
          {
            text: 'Copy Stream Link',
            onPress: async () => {
              if (effectiveVideoSrc) {
                try {
                  await Clipboard.setStringAsync(effectiveVideoSrc);
                  Alert.alert('Copied', 'Stream URL copied to clipboard. You can paste it into VLC, Infuse, or Outplayer.');
                } catch {}
              }
            },
          },
          { text: 'Close', onPress: handleClosePlayer, style: 'cancel' }
        ]
      );
    },
    [handleClosePlayer, effectiveVideoSrc]
  );

  // Player Selection:
  // On iOS with KSPlayer native module available: KSPlayer (FFmpegKit + Metal - handles MKV, AC3, EAC3, DTS, ASS)
  // Otherwise (Android, web, or iOS without KSPlayer view config): NativePlayer (react-native-video ExoPlayer / AVPlayer or HTML5 WebView)
  const Player = useMemo(() => {
    if (isKSPlayerSupported()) {
      try {
        const ks = require('../../components/ksplayer');
        if (ks && ks.MediaPlayer) return ks.MediaPlayer;
      } catch (e) {
        console.warn('[OfflinePlayerModal] Failed to load KSPlayer, falling back to NativePlayer:', e);
      }
    }
    return require('../../components/nativeplayer').MediaPlayer;
  }, []);

  if (!visible || !item || !effectiveVideoSrc) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      supportedOrientations={['portrait', 'portrait-upside-down', 'landscape', 'landscape-left', 'landscape-right']}
      onRequestClose={handleClosePlayer}
      statusBarTranslucent
    >
      <GestureHandlerRootView style={styles.container}>
        <Player
          videoUrl={effectiveVideoSrc}
          title={movieTitle}
          artwork={posterUrl || item.poster || ''}
          resumePositionSeconds={initialPositionSec}
          back={handleBack}
          updateProgress={handleUpdateProgress}
          onPlaybackError={handlePlaybackError}
          subtitles={subtitles}
          openSubtitlesClient={openSubtitlesClient}
          pictureInPictureEnabled={true}
        />
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
});

export default OfflinePlayerModal;
