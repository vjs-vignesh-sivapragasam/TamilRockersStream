import React, { useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import {
  requireNativeComponent,
  UIManager,
  findNodeHandle,
  NativeSyntheticEvent,
  ViewStyle,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import { WebView } from 'react-native-webview';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KSAudioTrack {
  index: number;
  title: string;
  language: string;
  selected: boolean;
}

export interface KSTextTrack {
  index: number;
  title: string;
  language: string;
  selected: boolean;
}

export interface KSOnLoadData {
  duration: number;
  currentTime: number;
  naturalSize: { width: number; height: number; orientation: string };
  audioTracks: KSAudioTrack[];
  textTracks: KSTextTrack[];
}

export interface KSOnProgressData {
  currentTime: number;
  duration: number;
  playableDuration: number;
  seekableDuration: number;
}

export interface KSOnBufferData { isBuffering: boolean }
export interface KSOnErrorData { error: { message: string; code: number } }
/** NEW – emitted by the native side each time the subtitle line changes. */
export interface KSOnSubtitleTextData { text: string }

export interface KSPlayerViewProps {
  url: string;
  headers?: Record<string, string>;
  paused?: boolean;
  muted?: boolean;
  rate?: number;
  resizeMode?: 'contain' | 'cover' | 'stretch';
  pictureInPictureEnabled?: boolean;
  style?: ViewStyle;

  onLoad?: (data: KSOnLoadData) => void;
  onProgress?: (data: KSOnProgressData) => void;
  onBuffer?: (data: KSOnBufferData) => void;
  onError?: (data: KSOnErrorData) => void;
  onEnd?: () => void;
  onReadyForDisplay?: () => void;
  onAudioTracks?: (data: { audioTracks: KSAudioTrack[] }) => void;
  onTextTracks?: (data: { textTracks: KSTextTrack[] }) => void;
  /** NEW – called whenever the current subtitle text changes. */
  onSubtitleText?: (data: KSOnSubtitleTextData) => void;
}

export interface KSPlayerRef {
  seek: (time: number) => void;
  play: () => void;
  pause: () => void;
  selectAudioTrack: (index: number) => void;
  selectTextTrack: (index: number) => void;
  disableTextTrack: () => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  enterPictureInPicture: () => void;
  exitPictureInPicture: () => void;
  setBrightness: (value: number) => void;
  setVolume: (value: number) => void;
}

// ─── Native component ─────────────────────────────────────────────────────────

let isKSPlayerAvailable = false;
let KSPlayerNative: any = null;

if (Platform.OS === 'ios') {
  try {
    const hasConfig = typeof (UIManager as any)?.hasViewManagerConfig === 'function'
      ? Boolean((UIManager as any).hasViewManagerConfig('KSPlayerView'))
      : Boolean(UIManager?.getViewManagerConfig?.('KSPlayerView'));
    if (hasConfig) {
      KSPlayerNative = requireNativeComponent<any>('KSPlayerView');
      isKSPlayerAvailable = true;
    }
  } catch (e) {
    KSPlayerNative = null;
    isKSPlayerAvailable = false;
  }
}

function dispatchCommand(ref: React.RefObject<any>, command: string, args: any[] = []) {
  if (!isKSPlayerAvailable) return;
  const node = findNodeHandle(ref.current);
  if (!node) return;
  const commands = UIManager.getViewManagerConfig?.('KSPlayerView')?.Commands;
  if (!commands || commands[command] === undefined) {
    console.warn(`[KSPlayerView] Command "${command}" not found`);
    return;
  }
  UIManager.dispatchViewManagerCommand(node, commands[command], args);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const KSPlayerView = forwardRef<KSPlayerRef, KSPlayerViewProps>((props, ref) => {
  const nativeRef = useRef<any>(null);
  const webViewRef = useRef<WebView>(null);

  useImperativeHandle(ref, () => ({
    seek(time) {
      if (isKSPlayerAvailable) {
        dispatchCommand(nativeRef, 'seekTo', [time]);
      } else {
        webViewRef.current?.injectJavaScript(`(function(){ const v = document.getElementById('v'); if(v) v.currentTime = ${time}; })(); true;`);
      }
    },
    play() {
      if (isKSPlayerAvailable) {
        dispatchCommand(nativeRef, 'play');
      } else {
        webViewRef.current?.injectJavaScript(`(function(){ const v = document.getElementById('v'); if(v) v.play(); })(); true;`);
      }
    },
    pause() {
      if (isKSPlayerAvailable) {
        dispatchCommand(nativeRef, 'pause');
      } else {
        webViewRef.current?.injectJavaScript(`(function(){ const v = document.getElementById('v'); if(v) v.pause(); })(); true;`);
      }
    },
    selectAudioTrack(idx) { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'selectAudioTrack', [idx]); },
    selectTextTrack(idx) { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'selectTextTrack', [idx]); },
    disableTextTrack() { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'disableTextTrack'); },
    enterFullscreen() {
      if (isKSPlayerAvailable) {
        dispatchCommand(nativeRef, 'enterFullscreen');
      } else {
        webViewRef.current?.injectJavaScript(`(function(){ const v = document.getElementById('v'); if(v && v.requestFullscreen) v.requestFullscreen(); })(); true;`);
      }
    },
    exitFullscreen() { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'exitFullscreen'); },
    enterPictureInPicture() { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'enterPictureInPicture'); },
    exitPictureInPicture() { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'exitPictureInPicture'); },
    setBrightness(value) { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'setBrightness', [value]); },
    setVolume(value) { if (isKSPlayerAvailable) dispatchCommand(nativeRef, 'setVolume', [value]); },
  }));

  // ─── Event adapters ───────────────────────────────────────────────────────

  const handleLoad = useCallback(
    (e: NativeSyntheticEvent<KSOnLoadData>) => props.onLoad?.(e.nativeEvent),
    [props.onLoad]
  );
  const handleProgress = useCallback(
    (e: NativeSyntheticEvent<KSOnProgressData>) => props.onProgress?.(e.nativeEvent),
    [props.onProgress]
  );
  const handleBuffer = useCallback(
    (e: NativeSyntheticEvent<KSOnBufferData>) => props.onBuffer?.(e.nativeEvent),
    [props.onBuffer]
  );
  const handleError = useCallback(
    (e: NativeSyntheticEvent<KSOnErrorData>) => props.onError?.(e.nativeEvent),
    [props.onError]
  );
  const handleEnd = useCallback(() => props.onEnd?.(), [props.onEnd]);
  const handleReadyForDisplay = useCallback(() => props.onReadyForDisplay?.(), [props.onReadyForDisplay]);
  const handleAudioTracks = useCallback(
    (e: NativeSyntheticEvent<{ audioTracks: KSAudioTrack[] }>) => props.onAudioTracks?.(e.nativeEvent),
    [props.onAudioTracks]
  );
  const handleTextTracks = useCallback(
    (e: NativeSyntheticEvent<{ textTracks: KSTextTrack[] }>) => props.onTextTracks?.(e.nativeEvent),
    [props.onTextTracks]
  );
  /** NEW – forward subtitle text from native to the parent. */
  const handleSubtitleText = useCallback(
    (e: NativeSyntheticEvent<KSOnSubtitleTextData>) => props.onSubtitleText?.(e.nativeEvent),
    [props.onSubtitleText]
  );

  const html5Source = useMemo(() => {
    const safeUrl = (props.url || '').replace(/"/g, '&quot;');
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; background: #000; overflow: hidden; display: flex; align-items: center; justify-content: center; }
    video { width: 100%; height: 100%; max-height: 100vh; object-fit: contain; }
  </style>
</head>
<body>
  <video id="v" src="${safeUrl}" playsinline webkit-playsinline controls autoplay></video>
  <script>
    const v = document.getElementById('v');
    const send = (data) => {
      try {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(data));
        }
      } catch (e) {}
    };
    v.addEventListener('loadedmetadata', () => {
      send({ type: 'load', duration: v.duration || 0, width: v.videoWidth || 0, height: v.videoHeight || 0 });
    });
    v.addEventListener('timeupdate', () => {
      send({ type: 'progress', currentTime: v.currentTime || 0, duration: v.duration || 0 });
    });
    v.addEventListener('waiting', () => {
      send({ type: 'buffer', isBuffering: true });
    });
    v.addEventListener('playing', () => {
      send({ type: 'buffer', isBuffering: false });
    });
    v.addEventListener('ended', () => {
      send({ type: 'end' });
    });
    v.addEventListener('error', () => {
      send({ type: 'error', message: 'Playback error in embedded player' });
    });
  </script>
</body>
</html>`;
    return { html };
  }, [props.url]);

  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'load':
          props.onLoad?.({
            duration: data.duration,
            currentTime: 0,
            naturalSize: { width: data.width, height: data.height, orientation: 'landscape' },
            audioTracks: [],
            textTracks: [],
          });
          props.onReadyForDisplay?.();
          break;
        case 'progress':
          props.onProgress?.({
            currentTime: data.currentTime,
            duration: data.duration,
            playableDuration: data.currentTime,
            seekableDuration: data.duration,
          });
          break;
        case 'buffer':
          props.onBuffer?.({ isBuffering: data.isBuffering });
          break;
        case 'end':
          props.onEnd?.();
          break;
        case 'error':
          props.onError?.({ error: { message: data.message, code: -1 } });
          break;
      }
    } catch {}
  }, [props]);

  if (!isKSPlayerAvailable || !KSPlayerNative) {
    return (
      <View style={[styles.container, props.style]}>
        <WebView
          ref={webViewRef}
          style={StyleSheet.absoluteFill}
          source={html5Source}
          originWhitelist={['*']}
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleWebViewMessage}
          onError={() => props.onError?.({ error: { message: 'Failed to load video stream', code: -1 } })}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, props.style]}>
      <KSPlayerNative
        ref={nativeRef}
        style={StyleSheet.absoluteFill}
        url={props.url}
        headers={props.headers ?? {}}
        paused={props.paused ?? false}
        muted={props.muted ?? false}
        rate={props.rate ?? 1.0}
        resizeMode={props.resizeMode ?? 'cover'}
        pictureInPictureEnabled={props.pictureInPictureEnabled ?? true}
        onLoad={handleLoad}
        onProgress={handleProgress}
        onBuffer={handleBuffer}
        onError={handleError}
        onEnd={handleEnd}
        onReadyForDisplay={handleReadyForDisplay}
        onAudioTracks={handleAudioTracks}
        onTextTracks={handleTextTracks}
        onSubtitleText={handleSubtitleText}
      />
    </View>
  );
});

KSPlayerView.displayName = 'KSPlayerView';

const styles = StyleSheet.create({
  container: { backgroundColor: '#000', overflow: 'hidden' },
});

export default KSPlayerView;
