import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
  Share,
  useWindowDimensions,
  PanResponder,
  GestureResponderEvent,
  Alert,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as DocumentPicker from 'expo-document-picker';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  ExternalLink,
  Volume2,
  Volume1,
  VolumeX,
  Sun,
  Maximize,
  Minimize,
  Lock,
  Unlock,
  Captions,
  CaptionsOff,
  Sliders,
  Check,
  Plus,
  FileText,
  Clock,
  Settings,
} from 'lucide-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Colors } from '../constants/theme';
import { DownloadItem } from '../types/downloads';

interface OfflinePlayerModalProps {
  visible: boolean;
  item: DownloadItem | null;
  onClose: () => void;
}

export type VideoScaleMode = 'fit' | 'stretch' | 'fill';

export interface SubtitleCue {
  id: number;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;
}

export type SubtitleSize = 'small' | 'medium' | 'large' | 'xlarge';
export type SubtitleColor = '#FFFFFF' | '#FFEB3B' | '#00E5FF' | '#69F0AE';
export type SubtitleBackground = 'outline' | 'box' | 'solid';

export interface SubtitleTrack {
  id: string;
  name: string;
  source: 'external' | 'embedded';
  cues: SubtitleCue[];
  uri?: string;
}

export function parseSubtitles(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  if (!content || typeof content !== 'string') return cues;

  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\n+/);
  let idCounter = 1;

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length === 0) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }
    if (timeLineIdx === -1) continue;

    const timeLine = lines[timeLineIdx];
    const parts = timeLine.split('-->');
    if (parts.length < 2) continue;

    const startSec = parseTimestamp(parts[0].trim());
    const endSec = parseTimestamp(parts[1].trim().split(' ')[0]);

    const textLines = lines.slice(timeLineIdx + 1);
    const text = textLines
      .join('<br/>')
      .replace(/<(?!\/?br\b)[^>]*>/gi, '')
      .trim();

    if (text && endSec > startSec) {
      cues.push({
        id: idCounter++,
        start: startSec,
        end: endSec,
        text,
      });
    }
  }

  return cues.sort((a, b) => a.start - b.start);
}

function parseTimestamp(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw.replace(',', '.');
  const parts = cleaned.split(':');
  if (parts.length === 3) {
    const hrs = parseFloat(parts[0]) || 0;
    const mins = parseFloat(parts[1]) || 0;
    const secs = parseFloat(parts[2]) || 0;
    return hrs * 3600 + mins * 60 + secs;
  } else if (parts.length === 2) {
    const mins = parseFloat(parts[0]) || 0;
    const secs = parseFloat(parts[1]) || 0;
    return mins * 60 + secs;
  }
  return parseFloat(cleaned) || 0;
}

type HudType = 'brightness' | 'volume' | 'seek' | 'scale' | null;

interface HudState {
  type: HudType;
  value: number;
  targetTime: number;
  deltaSec: number;
  scaleTitle?: string;
  scaleDesc?: string;
  scaleMode?: VideoScaleMode;
  visible: boolean;
}

export const OfflinePlayerModal: React.FC<OfflinePlayerModalProps> = ({
  visible,
  item,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const webViewRef = useRef<WebView>(null);

  const [contentUri, setContentUri] = useState<string>('');
  const [fileExisted, setFileExisted] = useState<boolean>(true);
  const [playerError, setPlayerError] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [controlsVisible, setControlsVisible] = useState<boolean>(true);
  const [controlsLocked, setControlsLocked] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [scaleMode, setScaleMode] = useState<VideoScaleMode>('fit');

  // Subtitle States & Settings
  const [subtitlesEnabled, setSubtitlesEnabled] = useState<boolean>(true);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string>('none');
  const [subSize, setSubSize] = useState<SubtitleSize>('medium');
  const [subColor, setSubColor] = useState<SubtitleColor>('#FFFFFF');
  const [subBg, setSubBg] = useState<SubtitleBackground>('outline');
  const [subOffset, setSubOffset] = useState<number>(0); // Sync offset in seconds
  const [subtitleModalVisible, setSubtitleModalVisible] = useState<boolean>(false);
  const [subModalTab, setSubModalTab] = useState<'tracks' | 'appearance' | 'timing'>('tracks');

  // MX Player Style Gestures State: Brightness (0.1 to 1.0), Volume (0.0 to 1.0)
  const [brightness, setBrightness] = useState<number>(1.0);
  const [volume, setVolume] = useState<number>(1.0);
  const [hud, setHud] = useState<HudState>({
    type: null,
    value: 100,
    targetTime: 0,
    deltaSec: 0,
    visible: false,
  });

  const hideControlsTimer = useRef<any>(null);
  const hudTimeout = useRef<any>(null);
  const scrubberWidthRef = useRef<number>(0);
  const scaleModeRef = useRef<VideoScaleMode>('fit');
  scaleModeRef.current = scaleMode;

  // Refs for gesture access without stale closures
  const brightnessRef = useRef<number>(brightness);
  brightnessRef.current = brightness;
  const volumeRef = useRef<number>(volume);
  volumeRef.current = volume;
  const currentTimeRef = useRef<number>(currentTime);
  currentTimeRef.current = currentTime;
  const durationRef = useRef<number>(duration);
  durationRef.current = duration;
  const controlsLockedRef = useRef<boolean>(controlsLocked);
  controlsLockedRef.current = controlsLocked;
  const windowDimsRef = useRef({ width: windowWidth, height: windowHeight });
  windowDimsRef.current = { width: windowWidth, height: windowHeight };

  const gestureRef = useRef<{
    mode: 'none' | 'brightness' | 'volume' | 'seek';
    startX: number;
    startY: number;
    startBrightness: number;
    startVolume: number;
    startTime: number;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startBrightness: 1.0,
    startVolume: 1.0,
    startTime: 0,
  });

  const seekPreviewRef = useRef<number | null>(null);

  useEffect(() => {
    if (!item) return;

    setPlayerError(false);
    setIsPlaying(true);
    setCurrentTime(0);
    setDuration(0);
    setBrightness(1.0);
    setVolume(1.0);
    setSubOffset(0);

    const checkFile = async () => {
      const targetUri = item.fileUri || item.movieFileUri;
      if (targetUri && targetUri.startsWith('file://')) {
        try {
          const info = await FileSystem.getInfoAsync(targetUri);
          setFileExisted(info.exists);

          if (
            Platform.OS === 'android' &&
            info.exists &&
            typeof FileSystem.getContentUriAsync === 'function'
          ) {
            const cUri = await FileSystem.getContentUriAsync(targetUri);
            setContentUri(cUri);
          }
        } catch (err) {
          console.warn('Error checking file in player:', err);
        }
      }
    };

    const tryLoadSameFolderSubtitle = async () => {
      const targetUri = item.fileUri || item.movieFileUri;
      if (!targetUri || !targetUri.startsWith('file://')) return;

      const srtUri = targetUri.replace(/\.[a-z0-9]+$/i, '.srt');
      const vttUri = targetUri.replace(/\.[a-z0-9]+$/i, '.vtt');

      try {
        const srtInfo = await FileSystem.getInfoAsync(srtUri);
        if (srtInfo.exists) {
          const content = await FileSystem.readAsStringAsync(srtUri);
          const parsed = parseSubtitles(content);
          if (parsed.length > 0) {
            const track: SubtitleTrack = {
              id: 'auto_srt',
              name: 'Movie Subtitles (.srt)',
              source: 'external',
              cues: parsed,
              uri: srtUri,
            };
            setSubtitleTracks([track]);
            setSelectedTrackId('auto_srt');
            setSubtitlesEnabled(true);
            return;
          }
        }
      } catch {}

      try {
        const vttInfo = await FileSystem.getInfoAsync(vttUri);
        if (vttInfo.exists) {
          const content = await FileSystem.readAsStringAsync(vttUri);
          const parsed = parseSubtitles(content);
          if (parsed.length > 0) {
            const track: SubtitleTrack = {
              id: 'auto_vtt',
              name: 'Movie Subtitles (.vtt)',
              source: 'external',
              cues: parsed,
              uri: vttUri,
            };
            setSubtitleTracks([track]);
            setSelectedTrackId('auto_vtt');
            setSubtitlesEnabled(true);
            return;
          }
        }
      } catch {}
    };

    checkFile();
    tryLoadSameFolderSubtitle();
    resetHideTimer();

    return () => {
      if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
      if (hudTimeout.current) clearTimeout(hudTimeout.current);
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, [item]);

  const resetHideTimer = () => {
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (!controlsLockedRef.current) {
        setControlsVisible(false);
      }
    }, 4500);
  };

  const sendPlayerCommand = (jsCode: string) => {
    webViewRef.current?.injectJavaScript(`
      (function() {
        try {
          var v = document.getElementById('netflix-video');
          if (v) { ${jsCode} }
        } catch(e) {}
      })();
      true;
    `);
  };

  const syncSubtitlesToPlayer = (
    cues: SubtitleCue[],
    enabled: boolean,
    size: SubtitleSize,
    color: SubtitleColor,
    bg: SubtitleBackground,
    offsetSec: number
  ) => {
    const sizeMap: Record<SubtitleSize, number> = {
      small: 16,
      medium: 21,
      large: 27,
      xlarge: 34,
    };
    const px = sizeMap[size] || 21;
    const jsonCues = JSON.stringify(enabled ? cues : []);

    sendPlayerCommand(`
      if (window.setSubtitleCues) {
        window.setSubtitleCues(${jsonCues});
      }
      if (window.setSubtitleOffset) {
        window.setSubtitleOffset(${offsetSec});
      }
      if (window.setSubtitleStyle) {
        window.setSubtitleStyle(${px}, '${color}', '${bg}');
      }
    `);
  };

  const handlePickSubtitleFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['*/*', 'application/x-subrip', 'text/vtt', 'text/plain'],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        const rawText = await FileSystem.readAsStringAsync(file.uri);
        const parsed = parseSubtitles(rawText);

        if (parsed.length === 0) {
          Alert.alert(
            'Empty Subtitle',
            'Could not parse subtitle cues from this file. Please verify it is a valid .srt or .vtt file.'
          );
          return;
        }

        const trackId = `track_${Date.now()}`;
        const newTrack: SubtitleTrack = {
          id: trackId,
          name: file.name,
          source: 'external',
          cues: parsed,
          uri: file.uri,
        };

        setSubtitleTracks((prev) => [...prev, newTrack]);
        setSelectedTrackId(trackId);
        setSubtitlesEnabled(true);
        syncSubtitlesToPlayer(parsed, true, subSize, subColor, subBg, subOffset);
      }
    } catch (err: any) {
      Alert.alert('Subtitle Picker', err?.message || 'Could not pick subtitle file.');
    }
  };

  const handleSelectTrack = (trackId: string) => {
    if (trackId === 'none') {
      setSelectedTrackId('none');
      setSubtitlesEnabled(false);
      syncSubtitlesToPlayer([], false, subSize, subColor, subBg, subOffset);
    } else {
      setSelectedTrackId(trackId);
      setSubtitlesEnabled(true);
      const track = subtitleTracks.find((t) => t.id === trackId);
      if (track) {
        syncSubtitlesToPlayer(track.cues, true, subSize, subColor, subBg, subOffset);
      }
    }
  };

  const handleAdjustSubtitleOffset = (deltaSec: number) => {
    setSubOffset((prev) => {
      const next = Math.round((prev + deltaSec) * 10) / 10;
      const clamped = Math.max(-10, Math.min(10, next));
      sendPlayerCommand(`if (window.setSubtitleOffset) { window.setSubtitleOffset(${clamped}); }`);
      return clamped;
    });
  };

  const handleResetSubtitleOffset = () => {
    setSubOffset(0);
    sendPlayerCommand(`if (window.setSubtitleOffset) { window.setSubtitleOffset(0); }`);
  };

  useEffect(() => {
    const activeTrack = subtitleTracks.find((t) => t.id === selectedTrackId);
    const cues = activeTrack ? activeTrack.cues : [];
    syncSubtitlesToPlayer(
      cues,
      subtitlesEnabled && selectedTrackId !== 'none',
      subSize,
      subColor,
      subBg,
      subOffset
    );
  }, [subSize, subColor, subBg, subOffset, selectedTrackId, subtitlesEnabled, subtitleTracks]);

  useEffect(() => {
    sendPlayerCommand(`if (window.setSubtitlePosition) { window.setSubtitlePosition(${controlsVisible}); }`);
  }, [controlsVisible]);

  const handleToggleFullscreen = async () => {
    try {
      if (isFullscreen) {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
        setIsFullscreen(false);
      } else {
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        setIsFullscreen(true);
      }
    } catch (err) {
      console.warn('Orientation change error:', err);
    }
    resetHideTimer();
  };

  const handleClosePlayer = async () => {
    try {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      await ScreenOrientation.unlockAsync();
    } catch {}
    setIsFullscreen(false);
    onClose();
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      sendPlayerCommand('v.pause();');
      setIsPlaying(false);
    } else {
      sendPlayerCommand('v.play();');
      setIsPlaying(true);
    }
    resetHideTimer();
  };

  const handleSeek = (deltaSeconds: number) => {
    const cur = currentTimeRef.current;
    const dur = durationRef.current;
    const target = Math.max(0, Math.min(dur || 0, cur + deltaSeconds));
    setCurrentTime(target);
    sendPlayerCommand(`if (window.seekTo) { window.seekTo(${target}); } else { v.currentTime = ${target}; }`);
    resetHideTimer();
  };

  const handleCycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 0.75];
    const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
    const nextSpeed = speeds[nextIdx];
    setPlaybackSpeed(nextSpeed);
    sendPlayerCommand(`v.playbackRate = ${nextSpeed};`);
    resetHideTimer();
  };

  const setVideoScaleMode = (mode: VideoScaleMode) => {
    setScaleMode(mode);
    scaleModeRef.current = mode;

    let fitCss = 'contain';
    let title = 'FIT SCREEN';
    let desc = 'Original Aspect Ratio (Letterbox)';
    if (mode === 'stretch') {
      fitCss = 'fill';
      title = 'STRETCH';
      desc = 'Full Screen (Stretched 100%)';
    } else if (mode === 'fill') {
      fitCss = 'cover';
      title = 'FILL SCREEN';
      desc = 'Cropped & Zoomed (No Black Bars)';
    }

    sendPlayerCommand(`
      if (window.setVideoScaleMode) {
        window.setVideoScaleMode('${mode}');
      } else if (v) {
        v.style.objectFit = '${fitCss}';
      }
    `);

    // Trigger MX Player Style HUD
    if (hudTimeout.current) clearTimeout(hudTimeout.current);
    setHud({
      type: 'scale',
      value: 100,
      targetTime: 0,
      deltaSec: 0,
      scaleTitle: title,
      scaleDesc: desc,
      scaleMode: mode,
      visible: true,
    });

    hudTimeout.current = setTimeout(() => {
      setHud((prev) => (prev.type === 'scale' ? { ...prev, visible: false } : prev));
    }, 1600);

    resetHideTimer();
  };

  const handleCycleScaleMode = () => {
    const modes: VideoScaleMode[] = ['fit', 'stretch', 'fill'];
    const nextIdx = (modes.indexOf(scaleModeRef.current) + 1) % modes.length;
    setVideoScaleMode(modes[nextIdx]);
  };

  const handleOpenExternal = async () => {
    const localFileUri = item?.fileUri || item?.movieFileUri || '';
    const movieTitle = item?.title || item?.movieFileName || item?.fileName || 'Movie';
    try {
      const uriToOpen = contentUri || localFileUri;
      if (uriToOpen) {
        const can = await Linking.canOpenURL(uriToOpen).catch(() => false);
        if (can) {
          await Linking.openURL(uriToOpen);
          return;
        }
      }
    } catch {}

    try {
      await Share.share({
        title: movieTitle,
        message: `Play movie: ${movieTitle}`,
        url: localFileUri,
      });
    } catch (shareErr) {
      console.warn('Could not launch external player:', shareErr);
    }
  };

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs) || secs < 0) return '0:00';
    const totalSeconds = Math.floor(secs);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const secStr = seconds < 10 ? `0${seconds}` : `${seconds}`;

    if (hours > 0) {
      const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      return `${hours}:${minStr}:${secStr}`;
    }
    return `${minutes}:${secStr}`;
  };

  // Interactive scrubber seek handler
  const handleScrubberSeek = (locationX: number) => {
    const trackWidth = scrubberWidthRef.current;
    const totalDuration = durationRef.current;
    if (!totalDuration || trackWidth <= 0) return;

    const ratio = Math.max(0, Math.min(1, locationX / trackWidth));
    const targetSec = ratio * totalDuration;
    setCurrentTime(targetSec);
    sendPlayerCommand(`if (window.seekTo) { window.seekTo(${targetSec}); } else { v.currentTime = ${targetSec}; }`);
    resetHideTimer();
  };

  // Scrubber PanResponder for dragging and direct tap
  const scrubberPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt: GestureResponderEvent) => {
          handleScrubberSeek(evt.nativeEvent.locationX);
        },
        onPanResponderMove: (evt: GestureResponderEvent) => {
          handleScrubberSeek(evt.nativeEvent.locationX);
        },
        onPanResponderRelease: () => {
          resetHideTimer();
        },
      }),
    []
  );

  // MX Player Style Gestures PanResponder (Screen swipe up/down for Brightness & Volume)
  const screenPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gs) =>
          Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10,
        onPanResponderGrant: (evt) => {
          gestureRef.current = {
            mode: 'none',
            startX: evt.nativeEvent.pageX,
            startY: evt.nativeEvent.pageY,
            startBrightness: brightnessRef.current,
            startVolume: volumeRef.current,
            startTime: currentTimeRef.current,
          };
          if (hudTimeout.current) clearTimeout(hudTimeout.current);
        },
        onPanResponderMove: (_, gs) => {
          if (controlsLockedRef.current) return;
          const g = gestureRef.current;
          const dims = windowDimsRef.current;

          // Determine gesture direction
          if (g.mode === 'none') {
            if (Math.abs(gs.dx) > Math.abs(gs.dy) * 1.3 && Math.abs(gs.dx) > 14) {
              g.mode = 'seek';
            } else if (Math.abs(gs.dy) > 14) {
              const isLeftSide = g.startX < dims.width / 2;
              g.mode = isLeftSide ? 'brightness' : 'volume';
            }
          }

          if (g.mode === 'brightness') {
            // Dragging up (negative dy) increases brightness
            const delta = -gs.dy / (dims.height * 0.45);
            const nextBrightness = Math.max(0.1, Math.min(1.0, g.startBrightness + delta));
            setBrightness(nextBrightness);
            brightnessRef.current = nextBrightness;
            setHud({
              type: 'brightness',
              value: Math.round(nextBrightness * 100),
              targetTime: 0,
              deltaSec: 0,
              visible: true,
            });
          } else if (g.mode === 'volume') {
            // Dragging up (negative dy) increases volume
            const delta = -gs.dy / (dims.height * 0.45);
            const nextVol = Math.max(0, Math.min(1.0, g.startVolume + delta));
            setVolume(nextVol);
            volumeRef.current = nextVol;
            sendPlayerCommand(`if (v) { v.volume = ${nextVol.toFixed(2)}; v.muted = false; }`);
            setHud({
              type: 'volume',
              value: Math.round(nextVol * 100),
              targetTime: 0,
              deltaSec: 0,
              visible: true,
            });
          } else if (g.mode === 'seek') {
            const totalDur = durationRef.current || 300;
            const maxSeekWindow = Math.min(120, Math.max(30, totalDur * 0.2));
            const deltaSec = (gs.dx / dims.width) * maxSeekWindow;
            const target = Math.max(0, Math.min(totalDur, g.startTime + deltaSec));
            seekPreviewRef.current = target;
            setHud({
              type: 'seek',
              value: 0,
              targetTime: target,
              deltaSec: Math.round(deltaSec),
              visible: true,
            });
          }
        },
        onPanResponderRelease: (_, gs) => {
          const g = gestureRef.current;
          if (g.mode === 'seek' && seekPreviewRef.current !== null) {
            const target = seekPreviewRef.current;
            setCurrentTime(target);
            sendPlayerCommand(`if (window.seekTo) { window.seekTo(${target}); } else { v.currentTime = ${target}; }`);
            seekPreviewRef.current = null;
          } else if (g.mode === 'none') {
            // Screen Tap toggles controls
            if (controlsLockedRef.current) {
              setControlsVisible((prev) => !prev);
            } else {
              setControlsVisible((prev) => {
                const next = !prev;
                if (next) resetHideTimer();
                return next;
              });
            }
          }

          g.mode = 'none';

          // Hide HUD after 1.2 seconds of inactivity
          if (hudTimeout.current) clearTimeout(hudTimeout.current);
          hudTimeout.current = setTimeout(() => {
            setHud((prev) => ({ ...prev, visible: false }));
          }, 1200);

          resetHideTimer();
        },
      }),
    []
  );

  if (!item) return null;

  const localFileUri = item.fileUri || item.movieFileUri || '';
  const httpFallback = item.url || '';
  const movieTitle = item.title || item.movieFileName || item.fileName || 'Movie';
  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  const playerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
      <style>
        * { box-sizing: border-box; }
        body, html {
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          background-color: #000000;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          font-family: -apple-system, Roboto, sans-serif;
        }
        video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          background: #000;
          outline: none;
          transition: object-fit 0.25s ease;
        }
        video.fit {
          object-fit: contain !important;
        }
        video.stretch {
          object-fit: fill !important;
        }
        video.fill {
          object-fit: cover !important;
        }
        #subtitle-overlay {
          position: absolute;
          bottom: 7%;
          left: 5%;
          right: 5%;
          text-align: center;
          pointer-events: none;
          z-index: 25;
          font-family: -apple-system, Roboto, sans-serif;
          font-weight: 700;
          line-height: 1.35;
          white-space: pre-wrap;
          display: none;
          transition: bottom 0.25s ease, font-size 0.15s ease;
        }
        #subtitle-overlay.controls-up {
          bottom: 16% !important;
        }
        #fallbackNotice {
          display: none;
          position: absolute;
          background: rgba(20, 20, 20, 0.95);
          border: 1px solid #333;
          border-radius: 12px;
          padding: 24px;
          text-align: center;
          color: #fff;
          max-width: 85%;
          z-index: 10;
        }
        .actionBtn {
          display: inline-block;
          margin-top: 14px;
          background-color: #E50914;
          color: #ffffff;
          padding: 10px 20px;
          border-radius: 20px;
          font-weight: 700;
          text-decoration: none;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <video
        id="netflix-video"
        class="${scaleMode}"
        style="object-fit: ${scaleMode === 'stretch' ? 'fill' : scaleMode === 'fill' ? 'cover' : 'contain'};"
        playsinline
        webkit-playsinline
        autoplay
        preload="auto"
      >
        ${localFileUri ? `<source src="${localFileUri}" type="video/mp4" />` : ''}
        ${contentUri ? `<source src="${contentUri}" type="video/mp4" />` : ''}
        ${httpFallback ? `<source src="${httpFallback}" type="video/mp4" />` : ''}
      </video>

      <div id="subtitle-overlay"></div>

      <div id="fallbackNotice">
        <div style="font-size: 16px; font-weight: 800; margin-bottom: 6px;">Format Notice</div>
        <div style="font-size: 12px; color: #aaa; line-height: 1.4;">
          This video file format may play best in VLC or MX Player.
        </div>
        <a class="actionBtn" href="javascript:void(0)" onclick="window.ReactNativeWebView.postMessage(JSON.stringify({type:'OPEN_EXTERNAL'}))">
          Open in VLC / MX Player
        </a>
      </div>

      <script>
        var v = document.getElementById('netflix-video');
        var notice = document.getElementById('fallbackNotice');

        function post(msg) {
          if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
            window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          }
        }

        window.setVideoScaleMode = function(mode) {
          if (!v) return;
          v.classList.remove('fit', 'stretch', 'fill');
          if (mode === 'stretch') {
            v.style.objectFit = 'fill';
            v.classList.add('stretch');
          } else if (mode === 'fill') {
            v.style.objectFit = 'cover';
            v.classList.add('fill');
          } else {
            v.style.objectFit = 'contain';
            v.classList.add('fit');
          }
        };

        window.__subCues = [];
        window.__subOffset = 0;

        window.setSubtitleCues = function(cues) {
          window.__subCues = Array.isArray(cues) ? cues : [];
          updateSubtitle(v ? v.currentTime : 0);
        };

        window.setSubtitleOffset = function(sec) {
          window.__subOffset = typeof sec === 'number' ? sec : 0;
          updateSubtitle(v ? v.currentTime : 0);
        };

        window.setSubtitleStyle = function(px, color, bgType) {
          var subBox = document.getElementById('subtitle-overlay');
          if (!subBox) return;
          subBox.style.fontSize = px + 'px';
          subBox.style.color = color;
          if (bgType === 'box') {
            subBox.style.backgroundColor = 'rgba(0, 0, 0, 0.75)';
            subBox.style.padding = '4px 14px';
            subBox.style.borderRadius = '6px';
            subBox.style.textShadow = 'none';
          } else if (bgType === 'solid') {
            subBox.style.backgroundColor = '#000000';
            subBox.style.padding = '4px 14px';
            subBox.style.borderRadius = '6px';
            subBox.style.textShadow = 'none';
          } else {
            subBox.style.backgroundColor = 'transparent';
            subBox.style.padding = '0';
            subBox.style.textShadow = '2px 2px 4px #000, -2px -2px 4px #000, 2px -2px 4px #000, -2px 2px 4px #000, 0 2px 4px #000';
          }
        };

        window.setSubtitlePosition = function(isControlsVisible) {
          var subBox = document.getElementById('subtitle-overlay');
          if (!subBox) return;
          if (isControlsVisible) {
            subBox.classList.add('controls-up');
          } else {
            subBox.classList.remove('controls-up');
          }
        };

        function updateSubtitle(curTime) {
          var subBox = document.getElementById('subtitle-overlay');
          if (!subBox) return;
          if (!window.__subCues || window.__subCues.length === 0) {
            subBox.innerHTML = '';
            subBox.style.display = 'none';
            return;
          }
          var t = (curTime || 0) + (window.__subOffset || 0);
          var activeCue = null;
          for (var i = 0; i < window.__subCues.length; i++) {
            var c = window.__subCues[i];
            if (t >= c.start && t <= c.end) {
              activeCue = c;
              break;
            }
            if (c.start > t) break;
          }
          if (activeCue) {
            subBox.innerHTML = activeCue.text;
            subBox.style.display = 'inline-block';
          } else {
            subBox.innerHTML = '';
            subBox.style.display = 'none';
          }
        }

        function emitTime() {
          if (!v) return;
          var dur = v.duration;
          var validDur = (typeof dur === 'number' && isFinite(dur) && dur > 0) ? dur : 0;
          post({
            type: 'TIME_UPDATE',
            currentTime: v.currentTime || 0,
            duration: validDur
          });
          updateSubtitle(v.currentTime || 0);
        }

        window.seekTo = function(secs) {
          if (v) {
            try {
              v.currentTime = Math.max(0, Math.min(v.duration || secs, secs));
              updateSubtitle(v.currentTime);
            } catch(e) {}
          }
        };

        v.addEventListener('loadedmetadata', emitTime);
        v.addEventListener('durationchange', emitTime);
        v.addEventListener('canplay', emitTime);
        v.addEventListener('timeupdate', emitTime);
        v.addEventListener('seeking', function() { emitTime(); updateSubtitle(v.currentTime); });
        v.addEventListener('seeked', function() { emitTime(); updateSubtitle(v.currentTime); });
        v.addEventListener('play', function() { post({ type: 'PLAYING' }); });
        v.addEventListener('pause', function() { post({ type: 'PAUSED' }); });
        v.addEventListener('ended', function() { post({ type: 'ENDED' }); });

        v.addEventListener('error', function() {
          if (notice) notice.style.display = 'block';
          post({ type: 'VIDEO_ERROR' });
        }, true);
      </script>
    </body>
    </html>
  `;

  // Darkness overlay for smooth MX Player-style brightness adjustment
  const brightnessDimOpacity = (1 - brightness) * 0.88;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      onRequestClose={handleClosePlayer}
      statusBarTranslucent
    >
      <StatusBar hidden />
      <View style={styles.container}>
        {/* WebView Video Element with gesture listener */}
        <View style={styles.playerContainer} {...screenPanResponder.panHandlers}>
          <WebView
            ref={webViewRef}
            originWhitelist={['*']}
            source={{ html: playerHtml, baseUrl: '' }}
            allowsFullscreenVideo
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            mixedContentMode="always"
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data.type === 'TIME_UPDATE') {
                  setCurrentTime(data.currentTime);
                  if (data.duration && data.duration > 0) {
                    setDuration(data.duration);
                  }
                } else if (data.type === 'PLAYING') {
                  setIsPlaying(true);
                } else if (data.type === 'PAUSED') {
                  setIsPlaying(false);
                } else if (data.type === 'OPEN_EXTERNAL') {
                  handleOpenExternal();
                } else if (data.type === 'VIDEO_ERROR') {
                  setPlayerError(true);
                }
              } catch {}
            }}
            style={styles.webView}
          />

          {/* Real-time Brightness Overlay (Dim layer) */}
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#000000', opacity: brightnessDimOpacity },
            ]}
          />
        </View>

        {/* MX Player Style On-Screen HUD for Brightness, Volume & Seek */}
        {hud.visible && (
          <View style={styles.hudOverlay} pointerEvents="none">
            <View style={styles.hudCard}>
              {hud.type === 'brightness' && (
                <>
                  <Sun color="#FFD700" size={32} />
                  <View style={styles.hudBarTrack}>
                    <View
                      style={[
                        styles.hudBarFill,
                        { width: `${hud.value}%`, backgroundColor: '#FFD700' },
                      ]}
                    />
                  </View>
                  <Text style={styles.hudText}>{hud.value}%</Text>
                </>
              )}

              {hud.type === 'volume' && (
                <>
                  {hud.value === 0 ? (
                    <VolumeX color="#FFFFFF" size={32} />
                  ) : hud.value < 50 ? (
                    <Volume1 color="#FFFFFF" size={32} />
                  ) : (
                    <Volume2 color="#FFFFFF" size={32} />
                  )}
                  <View style={styles.hudBarTrack}>
                    <View
                      style={[
                        styles.hudBarFill,
                        { width: `${hud.value}%`, backgroundColor: Colors.netflixRed },
                      ]}
                    />
                  </View>
                  <Text style={styles.hudText}>{hud.value}%</Text>
                </>
              )}

              {hud.type === 'seek' && (
                <>
                  <RotateCw color="#FFFFFF" size={28} />
                  <Text style={styles.hudTimeText}>{formatTime(hud.targetTime)}</Text>
                  <Text style={styles.hudDeltaText}>
                    {hud.deltaSec >= 0 ? `+${hud.deltaSec}s` : `${hud.deltaSec}s`}
                  </Text>
                </>
              )}

              {hud.type === 'scale' && (
                <>
                  <Maximize color="#FFFFFF" size={32} />
                  <Text style={styles.hudScaleTitle}>{hud.scaleTitle}</Text>
                  <Text style={styles.hudScaleDesc}>{hud.scaleDesc}</Text>
                  <View style={styles.hudScalePillRow}>
                    {(['fit', 'stretch', 'fill'] as VideoScaleMode[]).map((m) => (
                      <View
                        key={m}
                        style={[
                          styles.hudScaleMiniPill,
                          hud.scaleMode === m && styles.hudScaleMiniPillActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.hudScaleMiniPillText,
                            hud.scaleMode === m && styles.hudScaleMiniPillTextActive,
                          ]}
                        >
                          {m === 'fit' ? 'FIT' : m === 'stretch' ? 'STRETCH' : 'FILL'}
                        </Text>
                      </View>
                    ))}
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Netflix Player Overlay Controls */}
        {controlsVisible && (
          <View style={styles.overlayControls} pointerEvents="box-none">
            {/* Top Bar */}
            <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
              <TouchableOpacity
                style={styles.circleBtn}
                onPress={handleClosePlayer}
                activeOpacity={0.8}
              >
                <X color="#FFFFFF" size={22} />
              </TouchableOpacity>

              <View style={styles.titleInfo}>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  {movieTitle}
                </Text>
                <Text style={styles.videoSubtitle}>
                  Offline Ready • {item.resolution || '1080p'} • MX Gestures Active
                </Text>
              </View>



            </View>

            {/* Center Controls: Seek -10s, Play/Pause, Seek +10s */}
            {!controlsLocked && (
              <View style={styles.centerControlsRow} pointerEvents="box-none">
                <TouchableOpacity
                  style={styles.seekBtn}
                  onPress={() => handleSeek(-10)}
                  activeOpacity={0.7}
                >
                  <RotateCcw color="#FFFFFF" size={28} />
                  <Text style={styles.seekBtnText}>10</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.mainPlayBtn}
                  onPress={handleTogglePlay}
                  activeOpacity={0.85}
                >
                  {isPlaying ? (
                    <Pause color="#FFFFFF" size={34} fill="#FFFFFF" />
                  ) : (
                    <Play color="#FFFFFF" size={34} fill="#FFFFFF" style={{ marginLeft: 3 }} />
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.seekBtn}
                  onPress={() => handleSeek(10)}
                  activeOpacity={0.7}
                >
                  <RotateCw color="#FFFFFF" size={28} />
                  <Text style={styles.seekBtnText}>10</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Bottom Scrubber & Netflix Player Bar */}
            <View style={[styles.bottomBar, { bottom: insets.bottom + 12 }]} pointerEvents="box-none">
              {/* Progress Scrubber with Touch & Drag Seeking */}
              <View style={styles.scrubberRow} pointerEvents="box-none">
                <Text style={styles.timeText}>{formatTime(currentTime)}</Text>

                {/* Scrubber Touch Area */}
                <View
                  style={styles.scrubberTouchArea}
                  {...scrubberPanResponder.panHandlers}
                  onLayout={(e) => {
                    scrubberWidthRef.current = e.nativeEvent.layout.width;
                  }}
                >
                  <View style={styles.progressBarTrack}>
                    <View
                      style={[
                        styles.progressBarFill,
                        { width: `${progressPercent}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.scrubberDot,
                        { left: `${progressPercent}%` },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.timeText}>
                  {duration > 0 ? formatTime(duration) : '0:00'}
                </Text>
              </View>

              {/* Bottom Quick Actions */}
              <View style={{ width: '100%' }}>
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.bottomActionsRow} 
                  pointerEvents="box-none"
                >
                  {/* Lock Controls */}
                  <TouchableOpacity
                    style={styles.bottomActionItem}
                    onPress={() => setControlsLocked(!controlsLocked)}
                    activeOpacity={0.7}
                  >
                    {controlsLocked ? (
                      <Lock color={Colors.netflixRed} size={18} />
                    ) : (
                      <Unlock color="#FFFFFF" size={18} />
                    )}
                    <Text
                      style={[
                        styles.bottomActionText,
                        controlsLocked && { color: Colors.netflixRed },
                      ]}
                    >
                      {controlsLocked ? 'Locked' : 'Lock'}
                    </Text>
                  </TouchableOpacity>

                  {/* Speed Selector */}
                  <TouchableOpacity
                    style={styles.bottomActionItem}
                    onPress={handleCycleSpeed}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.speedBadgeText}>Speed ({playbackSpeed}x)</Text>
                  </TouchableOpacity>

                  {/* Subtitles Button */}
                  <TouchableOpacity
                    style={styles.bottomActionItem}
                    onPress={() => setSubtitleModalVisible(true)}
                    activeOpacity={0.7}
                  >
                    {selectedTrackId !== 'none' && subtitlesEnabled ? (
                      <Captions color={Colors.netflixRed} size={18} />
                    ) : (
                      <CaptionsOff color="#888888" size={18} />
                    )}
                    <Text
                      style={[
                        styles.bottomActionText,
                        selectedTrackId !== 'none' && subtitlesEnabled && { color: Colors.netflixRed, fontWeight: '700' },
                      ]}
                    >
                      Subtitles
                    </Text>
                  </TouchableOpacity>

                  {/* Fullscreen Button */}
                  <TouchableOpacity
                    style={styles.bottomActionItem}
                    onPress={handleToggleFullscreen}
                    activeOpacity={0.7}
                  >
                    {isFullscreen ? (
                      <Minimize color="#FFFFFF" size={18} />
                    ) : (
                      <Maximize color="#FFFFFF" size={18} />
                    )}
                    <Text style={styles.bottomActionText}>
                      {isFullscreen ? 'Exit Full' : 'Fullscreen'}
                    </Text>
                  </TouchableOpacity>

                  {/* External Player */}
                  <TouchableOpacity
                    style={styles.bottomActionItem}
                    onPress={handleOpenExternal}
                    activeOpacity={0.7}
                  >
                    <ExternalLink color="#FFFFFF" size={18} />
                    <Text style={styles.bottomActionText}>External</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </View>
        )}

        {/* Subtitle & Audio Settings Bottom Sheet Modal */}
        <Modal
          visible={subtitleModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setSubtitleModalVisible(false)}
        >
          <View style={styles.subModalBackdrop}>
            <TouchableOpacity
              style={StyleSheet.absoluteFill}
              activeOpacity={1}
              onPress={() => setSubtitleModalVisible(false)}
            />

            <View style={styles.subModalContainer}>
              {/* Sheet Header */}
              <View style={styles.subModalHeader}>
                <View style={styles.subModalHeaderTitleRow}>
                  <View style={styles.subModalIconWrap}>
                    <Captions color={Colors.netflixRed} size={20} />
                  </View>
                  <View>
                    <Text style={styles.subModalTitle}>Subtitles & Audio</Text>
                    <Text style={styles.subModalSubtitle}>SRT / VTT Track, Styling & Timing</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.subModalCloseBtn}
                  onPress={() => setSubtitleModalVisible(false)}
                  activeOpacity={0.7}
                >
                  <X color="#FFFFFF" size={18} />
                </TouchableOpacity>
              </View>

              {/* Segmented Tab Controls */}
              <View style={styles.subTabSegmentRow}>
                <TouchableOpacity
                  style={[styles.subTabBtn, subModalTab === 'tracks' && styles.subTabBtnActive]}
                  onPress={() => setSubModalTab('tracks')}
                  activeOpacity={0.8}
                >
                  <FileText
                    color={subModalTab === 'tracks' ? '#FFFFFF' : '#888888'}
                    size={15}
                  />
                  <Text
                    style={[
                      styles.subTabText,
                      subModalTab === 'tracks' && styles.subTabTextActive,
                    ]}
                  >
                    Tracks
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subTabBtn, subModalTab === 'appearance' && styles.subTabBtnActive]}
                  onPress={() => setSubModalTab('appearance')}
                  activeOpacity={0.8}
                >
                  <Sliders
                    color={subModalTab === 'appearance' ? '#FFFFFF' : '#888888'}
                    size={15}
                  />
                  <Text
                    style={[
                      styles.subTabText,
                      subModalTab === 'appearance' && styles.subTabTextActive,
                    ]}
                  >
                    Appearance
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.subTabBtn, subModalTab === 'timing' && styles.subTabBtnActive]}
                  onPress={() => setSubModalTab('timing')}
                  activeOpacity={0.8}
                >
                  <Clock
                    color={subModalTab === 'timing' ? '#FFFFFF' : '#888888'}
                    size={15}
                  />
                  <Text
                    style={[
                      styles.subTabText,
                      subModalTab === 'timing' && styles.subTabTextActive,
                    ]}
                  >
                    Timing Sync
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Tab Contents */}
              <ScrollView
                style={styles.subTabContentScroll}
                contentContainerStyle={styles.subTabContentContainer}
                showsVerticalScrollIndicator={false}
              >
                {/* --- TAB 1: TRACKS --- */}
                {subModalTab === 'tracks' && (
                  <View style={styles.tracksTabContent}>
                    <Text style={styles.subSectionHeading}>SELECT SUBTITLE TRACK</Text>

                    {/* Off Option */}
                    <TouchableOpacity
                      style={[
                        styles.trackItemRow,
                        selectedTrackId === 'none' && styles.trackItemRowActive,
                      ]}
                      onPress={() => handleSelectTrack('none')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.trackItemLeft}>
                        <CaptionsOff
                          color={selectedTrackId === 'none' ? Colors.netflixRed : '#888888'}
                          size={18}
                        />
                        <Text
                          style={[
                            styles.trackItemName,
                            selectedTrackId === 'none' && styles.trackItemNameActive,
                          ]}
                        >
                          Off (Disabled)
                        </Text>
                      </View>
                      {selectedTrackId === 'none' && (
                        <Check color={Colors.netflixRed} size={18} />
                      )}
                    </TouchableOpacity>

                    {/* Loaded Tracks */}
                    {subtitleTracks.map((trk) => {
                      const isSelected = selectedTrackId === trk.id;
                      return (
                        <TouchableOpacity
                          key={trk.id}
                          style={[
                            styles.trackItemRow,
                            isSelected && styles.trackItemRowActive,
                          ]}
                          onPress={() => handleSelectTrack(trk.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.trackItemLeft}>
                            <Captions
                              color={isSelected ? Colors.netflixRed : '#FFFFFF'}
                              size={18}
                            />
                            <View style={{ flex: 1 }}>
                              <Text
                                style={[
                                  styles.trackItemName,
                                  isSelected && styles.trackItemNameActive,
                                ]}
                                numberOfLines={1}
                              >
                                {trk.name}
                              </Text>
                              <Text style={styles.trackItemSub}>
                                {trk.cues.length} dialogues • {trk.name.toLowerCase().endsWith('.vtt') ? 'VTT' : 'SRT'}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.trackBadge}>
                            <Text style={styles.trackBadgeText}>
                              {trk.name.toLowerCase().endsWith('.vtt') ? 'VTT' : 'SRT'}
                            </Text>
                          </View>
                          {isSelected && (
                            <Check color={Colors.netflixRed} size={18} style={{ marginLeft: 8 }} />
                          )}
                        </TouchableOpacity>
                      );
                    })}

                    {/* Pick External Subtitle File */}
                    <TouchableOpacity
                      style={styles.addTrackBtn}
                      onPress={handlePickSubtitleFile}
                      activeOpacity={0.8}
                    >
                      <Plus color={Colors.netflixRed} size={20} />
                      <View style={{ flex: 1, marginLeft: 8 }}>
                        <Text style={styles.addTrackTitle}>Load Subtitle File</Text>
                        <Text style={styles.addTrackSubtitle}>
                          Select .srt or .vtt from phone storage or downloads
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                )}

                {/* --- TAB 2: APPEARANCE --- */}
                {subModalTab === 'appearance' && (
                  <View style={styles.appearanceTabContent}>
                    {/* Live Preview Box */}
                    <View style={styles.previewBox}>
                      <Text style={styles.previewBoxTag}>PREVIEW</Text>
                      <View
                        style={[
                          styles.previewBubble,
                          subBg === 'box' && styles.previewBgSemi,
                          subBg === 'solid' && styles.previewBgSolid,
                        ]}
                      >
                        <Text
                          style={[
                            styles.previewText,
                            {
                              color: subColor,
                              fontSize:
                                subSize === 'small'
                                  ? 14
                                  : subSize === 'medium'
                                  ? 17
                                  : subSize === 'large'
                                  ? 21
                                  : 25,
                              textShadowColor: subBg === 'outline' ? 'rgba(0,0,0,0.95)' : 'transparent',
                              textShadowRadius: subBg === 'outline' ? 4 : 0,
                            },
                          ]}
                        >
                          [VFlix] Subtitle will look like this
                        </Text>
                      </View>
                    </View>

                    {/* Size Options */}
                    <Text style={styles.subSectionHeading}>FONT SIZE</Text>
                    <View style={styles.pillRow}>
                      {(
                        [
                          { key: 'small', label: 'Small' },
                          { key: 'medium', label: 'Medium' },
                          { key: 'large', label: 'Large' },
                          { key: 'xlarge', label: 'Huge' },
                        ] as const
                      ).map((sz) => (
                        <TouchableOpacity
                          key={sz.key}
                          style={[
                            styles.chipBtn,
                            subSize === sz.key && styles.chipBtnActive,
                          ]}
                          onPress={() => setSubSize(sz.key)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              subSize === sz.key && styles.chipBtnTextActive,
                            ]}
                          >
                            {sz.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Color Options */}
                    <Text style={[styles.subSectionHeading, { marginTop: 18 }]}>TEXT COLOR</Text>
                    <View style={styles.colorPaletteRow}>
                      {[
                        { code: '#FFFFFF' as const, label: 'White', hex: '#FFFFFF' },
                        { code: '#FFEB3B' as const, label: 'Yellow', hex: '#FFEB3B' },
                        { code: '#00E5FF' as const, label: 'Cyan', hex: '#00E5FF' },
                        { code: '#69F0AE' as const, label: 'Mint', hex: '#69F0AE' },
                      ].map((col) => (
                        <TouchableOpacity
                          key={col.code}
                          style={[
                            styles.colorItemBtn,
                            subColor === col.code && styles.colorItemBtnActive,
                          ]}
                          onPress={() => setSubColor(col.code)}
                          activeOpacity={0.8}
                        >
                          <View style={[styles.colorDot, { backgroundColor: col.hex }]} />
                          <Text
                            style={[
                              styles.colorLabel,
                              subColor === col.code && styles.colorLabelActive,
                            ]}
                          >
                            {col.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    {/* Background Options */}
                    <Text style={[styles.subSectionHeading, { marginTop: 18 }]}>BACKGROUND STYLE</Text>
                    <View style={styles.pillRow}>
                      {[
                        { key: 'outline' as const, label: 'Text Shadow' },
                        { key: 'box' as const, label: 'Translucent' },
                        { key: 'solid' as const, label: 'Solid Black' },
                      ].map((bg) => (
                        <TouchableOpacity
                          key={bg.key}
                          style={[
                            styles.chipBtn,
                            subBg === bg.key && styles.chipBtnActive,
                          ]}
                          onPress={() => setSubBg(bg.key)}
                          activeOpacity={0.8}
                        >
                          <Text
                            style={[
                              styles.chipBtnText,
                              subBg === bg.key && styles.chipBtnTextActive,
                            ]}
                          >
                            {bg.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {/* --- TAB 3: TIMING SYNC --- */}
                {subModalTab === 'timing' && (
                  <View style={styles.timingTabContent}>
                    <Text style={styles.subSectionHeading}>SYNCHRONIZE TIMING</Text>
                    <Text style={styles.syncDescription}>
                      Fix audio delay or subtitle lag. Subtitle offset shifts dialogue earlier or later in real time.
                    </Text>

                    {/* Current Offset Badge */}
                    <View style={styles.offsetBadgeContainer}>
                      <Text style={styles.offsetBadgeValue}>
                        {subOffset > 0 ? `+${subOffset.toFixed(1)}s` : `${subOffset.toFixed(1)}s`}
                      </Text>
                      <Text style={styles.offsetBadgeState}>
                        {subOffset === 0
                          ? 'Perfect Sync (0.0s)'
                          : subOffset > 0
                          ? `Delayed by +${subOffset.toFixed(1)}s (appears later)`
                          : `Advanced by ${subOffset.toFixed(1)}s (appears earlier)`}
                      </Text>
                    </View>

                    {/* Stepper Buttons Row */}
                    <View style={styles.timingButtonsRow}>
                      <TouchableOpacity
                        style={styles.timeAdjBtn}
                        onPress={() => handleAdjustSubtitleOffset(-0.5)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeAdjBtnText}>-0.5s</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.timeAdjBtn}
                        onPress={() => handleAdjustSubtitleOffset(-0.1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeAdjBtnText}>-0.1s</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.timeResetBtn}
                        onPress={handleResetSubtitleOffset}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeResetBtnText}>Reset (0s)</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.timeAdjBtn}
                        onPress={() => handleAdjustSubtitleOffset(0.1)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeAdjBtnText}>+0.1s</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.timeAdjBtn}
                        onPress={() => handleAdjustSubtitleOffset(0.5)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.timeAdjBtnText}>+0.5s</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  playerContainer: {
    flex: 1,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  hudOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  hudCard: {
    backgroundColor: 'rgba(15, 15, 15, 0.88)',
    paddingHorizontal: 22,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 10,
    minWidth: 140,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 10,
  },
  hudBarTrack: {
    width: 100,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  hudBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  hudText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hudTimeText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  hudDeltaText: {
    color: '#AAAAAA',
    fontSize: 12,
    fontWeight: '700',
  },
  overlayControls: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'space-between',
    zIndex: 30,
  },
  topBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 35,
  },
  circleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleInfo: {
    flex: 1,
    gap: 2,
  },
  videoTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  videoSubtitle: {
    color: '#AAAAAA',
    fontSize: 11,
  },
  externalPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  externalPlayerText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  centerControlsRow: {
    position: 'absolute',
    top: '45%',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 40,
    zIndex: 35,
  },
  seekBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 50,
    height: 50,
  },
  seekBtnText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    marginTop: -4,
  },
  mainPlayBtn: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(229, 9, 20, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    gap: 12,
    zIndex: 35,
  },
  scrubberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeText: {
    color: '#CCCCCC',
    fontSize: 11,
    fontWeight: '600',
    minWidth: 44,
    textAlign: 'center',
  },
  scrubberTouchArea: {
    flex: 1,
    height: 36,
    justifyContent: 'center',
  },
  progressBarTrack: {
    width: '100%',
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 3,
    position: 'relative',
    justifyContent: 'center',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.netflixRed,
    borderRadius: 3,
  },
  scrubberDot: {
    position: 'absolute',
    top: -4.5,
    marginLeft: -7,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.netflixRed,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 4,
  },
  bottomActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 4,
    gap: 12,
  },
  bottomActionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  bottomActionText: {
    color: '#DDDDDD',
    fontSize: 12,
    fontWeight: '600',
  },
  speedBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  scaleCycleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.22)',
  },
  scaleCycleBtnLabel: {
    color: '#8E8E93',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  scaleCycleBadge: {
    backgroundColor: Colors.netflixRed,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  scaleCycleBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  scaleSelectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(20, 20, 20, 0.88)',
    borderRadius: 22,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    gap: 4,
  },
  scalePillBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
  },
  scalePillBtnActive: {
    backgroundColor: Colors.netflixRed,
  },
  scalePillText: {
    color: '#AAAAAA',
    fontSize: 11,
    fontWeight: '600',
  },
  scalePillTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  hudScaleTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginTop: 8,
  },
  hudScaleDesc: {
    color: '#CCCCCC',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  hudScalePillRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 12,
  },
  hudScaleMiniPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#262626',
    borderWidth: 0.5,
    borderColor: '#383838',
  },
  hudScaleMiniPillActive: {
    backgroundColor: Colors.netflixRed,
    borderColor: Colors.netflixRed,
  },
  hudScaleMiniPillText: {
    color: '#777777',
    fontSize: 9,
    fontWeight: '700',
  },
  hudScaleMiniPillTextActive: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  captionsTopBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(25, 25, 25, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  captionsTopBtnActive: {
    borderColor: Colors.netflixRed,
    backgroundColor: 'rgba(229, 9, 20, 0.25)',
  },
  captionsTopBtnText: {
    color: '#888888',
    fontSize: 10,
    fontWeight: '800',
  },
  captionsTopBtnTextActive: {
    color: '#FFFFFF',
  },
  subModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  subModalContainer: {
    backgroundColor: '#141414',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '82%',
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: '#262626',
  },
  subModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  subModalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  subModalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(229, 9, 20, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  subModalSubtitle: {
    color: '#888888',
    fontSize: 11,
    marginTop: 1,
  },
  subModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#222222',
    justifyContent: 'center',
    alignItems: 'center',
  },
  subTabSegmentRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  subTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#1C1C1C',
  },
  subTabBtnActive: {
    backgroundColor: '#2A2A2A',
    borderWidth: 1,
    borderColor: Colors.netflixRed,
  },
  subTabText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  subTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subTabContentScroll: {
    flexGrow: 0,
  },
  subTabContentContainer: {
    padding: 20,
  },
  tracksTabContent: {},
  appearanceTabContent: {},
  timingTabContent: {},
  subSectionHeading: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    marginBottom: 10,
  },
  trackItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: '#1C1C1C',
    borderRadius: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#282828',
  },
  trackItemRowActive: {
    borderColor: Colors.netflixRed,
    backgroundColor: 'rgba(229, 9, 20, 0.12)',
  },
  trackItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  trackItemName: {
    color: '#DDDDDD',
    fontSize: 14,
    fontWeight: '600',
  },
  trackItemNameActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  trackItemSub: {
    color: '#888888',
    fontSize: 11,
    marginTop: 2,
  },
  trackBadge: {
    backgroundColor: '#2A2A2A',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  trackBadgeText: {
    color: '#AAAAAA',
    fontSize: 10,
    fontWeight: '800',
  },
  addTrackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#333333',
    borderStyle: 'dashed',
    backgroundColor: '#161616',
    marginTop: 4,
  },
  addTrackTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addTrackSubtitle: {
    color: '#888888',
    fontSize: 11,
    marginTop: 1,
  },
  previewBox: {
    backgroundColor: '#0A0A0A',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 90,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#242424',
    position: 'relative',
  },
  previewBoxTag: {
    position: 'absolute',
    top: 8,
    left: 12,
    color: '#555555',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  previewBubble: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  previewBgSemi: {
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  previewBgSolid: {
    backgroundColor: '#000000',
  },
  previewText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  pillRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  chipBtn: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1C1C1C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  chipBtnActive: {
    borderColor: Colors.netflixRed,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
  },
  chipBtnText: {
    color: '#888888',
    fontSize: 12,
    fontWeight: '600',
  },
  chipBtnTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  colorPaletteRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#1C1C1C',
    borderWidth: 1,
    borderColor: '#2C2C2C',
  },
  colorItemBtnActive: {
    borderColor: Colors.netflixRed,
    backgroundColor: 'rgba(229, 9, 20, 0.2)',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  colorLabel: {
    color: '#888888',
    fontSize: 11,
    fontWeight: '600',
  },
  colorLabelActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  syncDescription: {
    color: '#888888',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 18,
  },
  offsetBadgeContainer: {
    backgroundColor: '#1C1C1C',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  offsetBadgeValue: {
    color: Colors.netflixRed,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 1,
  },
  offsetBadgeState: {
    color: '#CCCCCC',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  timingButtonsRow: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
  },
  timeAdjBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#202020',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#303030',
  },
  timeAdjBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  timeResetBtn: {
    flex: 1.3,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: Colors.netflixRed,
    alignItems: 'center',
  },
  timeResetBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
});
