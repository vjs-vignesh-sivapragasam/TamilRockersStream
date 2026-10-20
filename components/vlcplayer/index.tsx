import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { TouchableOpacity, Animated, Platform } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { MenuComponentRef } from '@react-native-menu/menu';
import { UniversalMenu } from "@/components/WebMenuView";
import { styles } from "../coreplayer/styles";
import {
    usePlayerState,
    useSubtitleState,
    useUIState,
    useEnhancedPlayerSettings,
    useTimers,
    usePlayerAnimations,
    hideControls,
    CONSTANTS,
    loadSubtitle,
    handleSubtitleError,
    findActiveSubtitleWithDelay,
    performSeek,
    buildSettingsActions,
    buildSubtitleActions,
    buildAudioActions,
    buildStreamActions,
    calculateSliderValues,
    ArtworkBackground,
    WaitingLobby,
    SubtitleDisplay,
    CenterControls,
    ProgressBar,
    SubtitleSource,
    SubtitlePosition,
    ErrorDisplay,
    ExtendedMediaPlayerProps,
} from "../coreplayer";
import { View, Text } from "../Themed";
import { GlassView } from 'expo-glass-effect';
import { SkipBanner } from "../introdb/skipBanner";
import { useIntroDB } from "../introdb/useIntroDb";
import { isPictureInPictureSupported } from "@/utils/MediaPlayer";
import { VLCPlayerView as VideoComponent } from "./VLCPlayerView";

const RNResizeMode = { COVER: 'cover', CONTAIN: 'contain', STRETCH: 'stretch' };

const MenuWrapper = UniversalMenu;

export const MediaPlayer: React.FC<ExtendedMediaPlayerProps> = ({
    videoUrl,
    title,
    back: onBack,
    resumePositionSeconds = 0,
    pictureInPictureEnabled = true,
    artwork,
    subtitles = [],
    openSubtitlesClient,
    updateProgress,
    onPlaybackError,
    streams = [],
    currentStreamIndex = 0,
    onStreamChange,
    tvShow
}) => {
    const videoRef = useRef<any>(null);
    const shouldAutoHideControls = useRef(true);
    const isSeeking = useRef(false);
    const isHideControlsScheduled = useRef(false);
    const wasPlayingBeforeSeek = useRef(false);
    const lastKnownTimeRef = useRef<number>(0);
    const hasReportedErrorRef = useRef(false);
    const seekTimeoutRef = useRef<any>(null);
    const progressUpdateTimerRef = useRef<any>(null);
    const lastLoggedSecondRef = useRef<number>(-1);

    const playerState = usePlayerState();
    const subtitleState = useSubtitleState();
    const uiState = useUIState();
    const settings = useEnhancedPlayerSettings();
    const timers = useTimers();
    const animations = usePlayerAnimations();

    const setShowControls = uiState.setShowControls;
    const controlsOpacity = animations.controlsOpacity;
    const bufferOpacity = animations.bufferOpacity;
    const contentFitLabelOpacity = animations.contentFitLabelOpacity;
    const clearTimer = timers.clearTimer;
    const setTimer = timers.setTimer;
    const clearAllTimers = timers.clearAllTimers;

    const audioMenuRef = useRef<MenuComponentRef>(null);
    const subtitleMenuRef = useRef<MenuComponentRef>(null);
    const settingsMenuRef = useRef<MenuComponentRef>(null);
    const streamMenuRef = useRef<MenuComponentRef>(null);

    const [contentFit, setContentFit] = useState<string>(RNResizeMode.COVER);
    const [showContentFitLabel, setShowContentFitLabel] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [videoError, setVideoError] = useState<string | null>(null);
    const [availableAudioTracks, setAvailableAudioTracks] = useState<any[]>([]);
    const [availableTextTracks, setAvailableTextTracks] = useState<any[]>([]);
    const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(-1);

    const [selectedCustomSubtitleIndex, setSelectedCustomSubtitleIndex] = useState<number>(-1);
    const [selectedEmbeddedTextTrack, setSelectedEmbeddedTextTrack] = useState<number>(-1);
    const [embeddedSubtitleText, setEmbeddedSubtitleText] = useState<string>('');

    const isUsingCustomSub = selectedCustomSubtitleIndex >= 0;
    const isUsingEmbeddedSub = selectedEmbeddedTextTrack >= 0;
    const canUsePictureInPicture =
        pictureInPictureEnabled && isPictureInPictureSupported();

    // Android LibVLC Mount Log
    useEffect(() => {
        console.log('----------------------------------------------------');
        console.log(`[Android VLC] 🎬 Initializing LibVLC Video Player`);
        console.log(`[Android VLC] 📌 Media Title: "${title}"`);
        console.log(`[Android VLC] 🔗 Stream Video URL: ${videoUrl}`);
        if (resumePositionSeconds > 0) {
            console.log(`[Android VLC] ⏩ Resuming from timestamp: ${resumePositionSeconds}s`);
        }
        console.log('----------------------------------------------------');
    }, []);

    // Restore playback position
    useEffect(() => {
        if (!playerState.isReady || playerState.duration <= 0 || resumePositionSeconds <= 0) {
            return;
        }

        const currentTime = Math.min(resumePositionSeconds, playerState.duration);
        isSeeking.current = true;
        wasPlayingBeforeSeek.current = false;
        videoRef.current?.seek(currentTime);
        playerState.setCurrentTime(currentTime);
        lastKnownTimeRef.current = currentTime;

        const timeoutId = setTimeout(() => {
            isSeeking.current = false;
        }, 300);
        return () => clearTimeout(timeoutId);
    }, [playerState.isReady, playerState.duration, resumePositionSeconds]);

    const showControlsTemporarily = useCallback(() => {
        setShowControls(true);
        Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
        clearTimer('hideControls');
        isHideControlsScheduled.current = false;
        if (shouldAutoHideControls.current) {
            isHideControlsScheduled.current = true;
            setTimer('hideControls', () => {
                hideControls(setShowControls, controlsOpacity);
                isHideControlsScheduled.current = false;
            }, CONSTANTS.CONTROLS_AUTO_HIDE_DELAY);
        }
    }, [controlsOpacity, clearTimer, setTimer, setShowControls]);

    useEffect(() => {
        lastKnownTimeRef.current = playerState.currentTime;
    }, [playerState.currentTime]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (updateProgress) {
                updateProgress({
                    positionSeconds: lastKnownTimeRef.current,
                    durationSeconds: playerState.duration
                });
            }
            clearAllTimers();
            if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);
            if (progressUpdateTimerRef.current) clearInterval(progressUpdateTimerRef.current);
        };
    }, [clearAllTimers, updateProgress, playerState.duration]);

    // Load custom subtitles
    useEffect(() => {
        if (selectedCustomSubtitleIndex < 0 || selectedCustomSubtitleIndex >= subtitles.length) {
            subtitleState.setParsedSubtitles([]);
            subtitleState.setCurrentSubtitle('');
            return;
        }
        let isMounted = true;
        subtitleState.setIsLoadingSubtitles(true);
        const loadSub = async () => {
            try {
                const parsed = await loadSubtitle(
                    subtitles[selectedCustomSubtitleIndex] as SubtitleSource,
                    openSubtitlesClient
                );
                if (isMounted) subtitleState.setParsedSubtitles(parsed);
            } catch (error: any) {
                if (isMounted) {
                    handleSubtitleError(error);
                    subtitleState.setParsedSubtitles([]);
                }
            } finally {
                if (isMounted) {
                    subtitleState.setIsLoadingSubtitles(false);
                    subtitleState.setCurrentSubtitle('');
                }
            }
        };
        loadSub();
        return () => { isMounted = false; };
    }, [selectedCustomSubtitleIndex, subtitles, openSubtitlesClient]);

    // Update custom subtitle display text
    useEffect(() => {
        if (!isUsingCustomSub || subtitleState.parsedSubtitles.length === 0) return;
        const update = () => {
            const text = findActiveSubtitleWithDelay(
                playerState.currentTime,
                subtitleState.parsedSubtitles,
                settings.subtitleDelay
            );
            if (text !== subtitleState.currentSubtitle) {
                subtitleState.setCurrentSubtitle(text);
            }
        };
        update();
        const interval = setInterval(update, CONSTANTS.SUBTITLE_UPDATE_INTERVAL);
        return () => clearInterval(interval);
    }, [isUsingCustomSub, subtitleState.parsedSubtitles, playerState.currentTime, subtitleState.currentSubtitle, settings.subtitleDelay]);

    const handleLoad = useCallback((data: any) => {
        const durationSec = Math.round(data?.duration || 0);
        const width = data?.naturalSize?.width || 0;
        const height = data?.naturalSize?.height || 0;
        console.log(`[Android VLC] ✅ Video Loaded! Duration: ${durationSec}s | Natural Size: ${width}x${height}`);

        playerState.setIsReady(true);
        playerState.setIsBuffering(false);
        playerState.setDuration(data.duration);
        lastKnownTimeRef.current = data.currentTime ?? 0;
        playerState.setCurrentTime(lastKnownTimeRef.current);

        if (Array.isArray(data.audioTracks) && data.audioTracks.length > 0) {
            setAvailableAudioTracks(data.audioTracks);
            const sel = data.audioTracks.find((t: any) => t.selected);
            if (sel) setSelectedAudioTrack(sel.index);
            console.log(`[Android VLC] 🔊 Audio tracks detected (${data.audioTracks.length}):`, data.audioTracks.map((t: any) => `${t.name || t.language || 'Track'} [id=${t.index}]`).join(', '));
        }
        if (Array.isArray(data.textTracks) && data.textTracks.length > 0) {
            setAvailableTextTracks(data.textTracks);
            const sel = data.textTracks.find((t: any) => t.selected);
            if (sel) setSelectedEmbeddedTextTrack(sel.index);
            console.log(`[Android VLC] 💬 Subtitles detected (${data.textTracks.length}):`, data.textTracks.map((t: any) => `${t.name || t.language || 'Track'} [id=${t.index}]`).join(', '));
        }

        showControlsTemporarily();
    }, [playerState, showControlsTemporarily]);

    const handleProgress = useCallback((data: any) => {
        if (!isSeeking.current) {
            playerState.setCurrentTime(data.currentTime);
            lastKnownTimeRef.current = data.currentTime;
            if (data.duration && playerState.duration === 0) {
                playerState.setDuration(data.duration);
            }
            const sec = Math.floor(data.currentTime);
            if (sec > 0 && sec % 10 === 0 && sec !== lastLoggedSecondRef.current) {
                lastLoggedSecondRef.current = sec;
                console.log(`[Android VLC] ▶️ Playing: ${sec}s / ${Math.floor(playerState.duration || data.duration || 0)}s`);
            }
        }
    }, [playerState]);

    const handleBuffer = useCallback(({ isBuffering }: any) => {
        console.log(`[Android VLC] ⏳ Buffer state: ${isBuffering ? 'buffering data...' : 'ready / playing'}`);
        playerState.setIsBuffering(isBuffering);
        Animated.timing(bufferOpacity, {
            toValue: isBuffering ? 1 : 0,
            duration: 150,
            useNativeDriver: true,
        }).start();
    }, [bufferOpacity, playerState]);

    const handleError = useCallback((data: any) => {
        const errorMsg = data?.error?.message || 'LibVLC playback error';
        console.error('[Android VLC] ❌ Playback error:', errorMsg);
        setVideoError(errorMsg);
        playerState.setIsBuffering(false);
        onPlaybackError?.({ error: errorMsg });
    }, [playerState, onPlaybackError]);

    const handleEnd = useCallback(() => {
        console.log('[Android VLC] 🏁 Playback completed (End of Media)');
        playerState.setIsPlaying(false);
        setIsPaused(true);
        setShowControls(true);
    }, [playerState, setShowControls]);

    const handleAudioTracks = useCallback(({ audioTracks }: any) => {
        if (Array.isArray(audioTracks)) {
            console.log(`[Android VLC] 🔊 Audio tracks updated (${audioTracks.length}):`, audioTracks.map((t: any) => `${t.name || t.language || 'Track'} [id=${t.index}]`).join(', '));
            setAvailableAudioTracks(audioTracks);
            const sel = audioTracks.find((t: any) => t.selected);
            if (sel) setSelectedAudioTrack(sel.index);
        }
    }, []);

    const handleTextTracks = useCallback(({ textTracks }: any) => {
        if (Array.isArray(textTracks)) {
            console.log(`[Android VLC] 💬 Subtitle tracks updated (${textTracks.length}):`, textTracks.map((t: any) => `${t.name || t.language || 'Track'} [id=${t.index}]`).join(', '));
            setAvailableTextTracks(textTracks);
            const sel = textTracks.find((t: any) => t.selected);
            if (sel) setSelectedEmbeddedTextTrack(sel.index);
        }
    }, []);

    const handleSubtitleText = useCallback(({ text }: any) => {
        setEmbeddedSubtitleText(text || '');
    }, []);

    const seekTo = useCallback((seconds: number) => {
        if (!playerState.isReady || playerState.duration <= 0) return;
        if (seekTimeoutRef.current) clearTimeout(seekTimeoutRef.current);

        const clamped = performSeek(seconds, playerState.duration);
        console.log(`[Android VLC] ⏩ Seeking to: ${Math.round(clamped)}s`);
        wasPlayingBeforeSeek.current = !isPaused;
        if (!isPaused) setIsPaused(true);

        playerState.setIsBuffering(true);
        Animated.timing(bufferOpacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
        isSeeking.current = true;

        videoRef.current?.seek(clamped);
        playerState.setCurrentTime(clamped);

        seekTimeoutRef.current = setTimeout(() => {
            isSeeking.current = false;
            playerState.setIsBuffering(false);
            Animated.timing(bufferOpacity, { toValue: 0, duration: 200, useNativeDriver: true }).start();
            if (wasPlayingBeforeSeek.current) setIsPaused(false);
        }, 300);

        showControlsTemporarily();
    }, [playerState, isPaused, showControlsTemporarily, bufferOpacity]);

    const { activeSegment, skip: skipSegment } = useIntroDB({
        imdbId: tvShow?.imdbId ?? null,
        season: tvShow?.season ?? null,
        episode: tvShow?.episode ?? null,
        currentTime: playerState.currentTime,
        onSkip: seekTo,
    });

    const togglePlayPause = useCallback(() => {
        if (!playerState.isReady) return;
        setIsPaused((wasPaused) => {
            const next = !wasPaused;
            console.log(`[Android VLC] ⏯️ User action: ${next ? 'Paused' : 'Playing'}`);
            playerState.setIsPlaying(!next);
            return next;
        });
        showControlsTemporarily();
    }, [playerState, showControlsTemporarily]);

    const handleSkipBackward = useCallback(() => seekTo(playerState.currentTime - 10), [seekTo, playerState.currentTime]);
    const handleSkipForward = useCallback(() => seekTo(playerState.currentTime + 30), [seekTo, playerState.currentTime]);

    const handleSliderStart = useCallback(() => {
        playerState.setIsDragging(true);
        showControlsTemporarily();
    }, [showControlsTemporarily, playerState]);

    const handleSliderChange = useCallback((value: number) => {
        if (!playerState.isReady || playerState.duration <= 0) return;
        playerState.setIsDragging(true);
        playerState.setDragPosition(value);
    }, [playerState]);

    const handleSliderComplete = useCallback((value: number) => {
        if (playerState.isReady && playerState.duration > 0) {
            seekTo(value * playerState.duration);
        }
        playerState.setIsDragging(false);
    }, [playerState, seekTo]);

    const handleOverlayPress = useCallback(() => {
        if (uiState.showControls) {
            hideControls(setShowControls, controlsOpacity);
        } else {
            showControlsTemporarily();
        }
    }, [uiState.showControls, showControlsTemporarily, setShowControls, controlsOpacity]);

    const cycleContentFit = useCallback(() => {
        const modes = [RNResizeMode.CONTAIN, RNResizeMode.COVER, RNResizeMode.STRETCH];
        const next = modes[(modes.indexOf(contentFit) + 1) % modes.length];
        setContentFit(next);
        showControlsTemporarily();
    }, [contentFit, showControlsTemporarily]);

    const getContentFitIcon = () => {
        switch (contentFit) {
            case RNResizeMode.COVER: return 'crop';
            case RNResizeMode.CONTAIN: return 'fit-screen';
            case RNResizeMode.STRETCH: return 'aspect-ratio';
            default: return 'fit-screen';
        }
    };

    const handleMuteToggle = useCallback(() => {
        settings.setIsMuted(!settings.isMuted);
        showControlsTemporarily();
    }, [settings, showControlsTemporarily]);

    const handlePictureInPicture = useCallback(() => {
        videoRef.current?.enterPictureInPicture();
    }, []);

    const handleSpeedSelect = useCallback((speed: number) => {
        settings.setPlaybackSpeed(speed);
        showControlsTemporarily();
    }, [settings, showControlsTemporarily]);

    const handleSubtitleSelect = useCallback((index: number) => {
        setSelectedCustomSubtitleIndex(index);
        if (index >= 0) {
            setSelectedEmbeddedTextTrack(-1);
            videoRef.current?.disableTextTrack();
        }
        showControlsTemporarily();
    }, [showControlsTemporarily]);

    const handleEmbeddedSubtitleSelect = useCallback((trackIndex: number) => {
        setSelectedEmbeddedTextTrack(trackIndex);
        if (trackIndex >= 0) {
            setSelectedCustomSubtitleIndex(-1);
            subtitleState.setParsedSubtitles([]);
            subtitleState.setCurrentSubtitle('');
            videoRef.current?.selectTextTrack(trackIndex);
        } else {
            videoRef.current?.disableTextTrack();
            setEmbeddedSubtitleText('');
        }
        showControlsTemporarily();
    }, [showControlsTemporarily, subtitleState]);

    const handleAudioSelect = useCallback((index: number) => {
        setSelectedAudioTrack(index);
        videoRef.current?.selectAudioTrack(index);
        showControlsTemporarily();
    }, [showControlsTemporarily]);

    const handleStreamSelect = useCallback((index: number) => {
        onStreamChange?.(index);
        showControlsTemporarily();
    }, [onStreamChange, showControlsTemporarily]);

    const handleMenuAction = useCallback((id: string) => {
        if (!id) return;
        if (id.startsWith('speed-')) {
            const speed = parseFloat(id.split('-')[1]);
            if (!isNaN(speed)) handleSpeedSelect(speed);
        } else if (id === 'sub-off') {
            handleSubtitleSelect(-1);
            handleEmbeddedSubtitleSelect(-1);
        } else if (id.startsWith('sub-custom-')) {
            const idx = parseInt(id.replace('sub-custom-', ''), 10);
            if (!isNaN(idx)) handleSubtitleSelect(idx);
        } else if (id.startsWith('sub-embedded-')) {
            const idx = parseInt(id.replace('sub-embedded-', ''), 10);
            if (!isNaN(idx)) handleEmbeddedSubtitleSelect(idx);
        } else if (id.startsWith('audio-')) {
            const idx = parseInt(id.replace('audio-', ''), 10);
            if (!isNaN(idx)) handleAudioSelect(idx);
        } else if (id.startsWith('stream-')) {
            const idx = parseInt(id.replace('stream-', ''), 10);
            if (!isNaN(idx)) handleStreamSelect(idx);
        }
    }, [handleSpeedSelect, handleSubtitleSelect, handleEmbeddedSubtitleSelect, handleAudioSelect, handleStreamSelect]);

    const settingsActions = useMemo(() => buildSettingsActions(settings.playbackSpeed), [settings.playbackSpeed]);
    const subtitleActions = useMemo(() => buildSubtitleActions(
        subtitles as SubtitleSource[],
        selectedCustomSubtitleIndex,
        availableTextTracks,
        selectedEmbeddedTextTrack,
        settings.subtitlePosition,
        settings.subtitleDelay
    ), [subtitles, selectedCustomSubtitleIndex, availableTextTracks, selectedEmbeddedTextTrack, settings.subtitlePosition, settings.subtitleDelay]);
    const audioActions = useMemo(() => buildAudioActions(availableAudioTracks, selectedAudioTrack), [availableAudioTracks, selectedAudioTrack]);
    const streamActions = useMemo(() => buildStreamActions(streams, currentStreamIndex), [streams, currentStreamIndex]);

    const { displayTime, sliderValue } = useMemo(() => calculateSliderValues(
        playerState.isDragging,
        playerState.dragPosition,
        playerState.currentTime,
        playerState.duration
    ), [playerState.isDragging, playerState.dragPosition, playerState.currentTime, playerState.duration]);

    const handleNativeAction = useCallback(({ nativeEvent }: any) => handleMenuAction(nativeEvent?.event || nativeEvent), [handleMenuAction]);
    const handleWebAction = useCallback((id: string) => handleMenuAction(id), [handleMenuAction]);

    const handleMenuOpen = useCallback(() => {
        shouldAutoHideControls.current = false;
        clearTimer('hideControls');
    }, [clearTimer]);

    const handleMenuClose = useCallback(() => {
        shouldAutoHideControls.current = true;
        showControlsTemporarily();
    }, [showControlsTemporarily]);

    const handleBack = useCallback(() => {
        onBack({
            message: '',
            positionSeconds: lastKnownTimeRef.current,
            durationSeconds: playerState.duration,
            player: 'ksplayer' // Keep type contract or use vlcplayer
        });
    }, [playerState.duration, onBack]);

    const handleRetry = useCallback(() => {
        setVideoError(null);
        hasReportedErrorRef.current = false;
        playerState.setIsReady(false);
        playerState.setIsBuffering(true);
        videoRef.current?.seek(0);
        setIsPaused(false);
    }, [playerState]);

    const displaySubtitleText = isUsingCustomSub
        ? subtitleState.currentSubtitle
        : isUsingEmbeddedSub
            ? embeddedSubtitleText
            : '';

    if (videoError) {
        return <ErrorDisplay error={videoError} onBack={handleBack} onRetry={handleRetry} />;
    }

    return (
        <View style={styles.container}>
            <VideoComponent
                ref={videoRef}
                url={videoUrl}
                paused={isPaused}
                muted={settings.isMuted}
                rate={settings.playbackSpeed}
                resizeMode={contentFit as any}
                pictureInPictureEnabled={pictureInPictureEnabled}
                style={styles.video}
                onLoad={handleLoad}
                onProgress={handleProgress}
                onBuffer={handleBuffer}
                onError={handleError}
                onEnd={handleEnd}
                onAudioTracks={handleAudioTracks}
                onTextTracks={handleTextTracks}
                onSubtitleText={handleSubtitleText}
            />

            <ArtworkBackground
                artwork={artwork}
                isBuffering={playerState.isBuffering}
                hasStartedPlaying={playerState.isReady}
            />

            <WaitingLobby hasStartedPlaying={playerState.isReady} opacity={bufferOpacity} />

            <TouchableOpacity
                style={styles.touchArea}
                activeOpacity={1}
                onPress={handleOverlayPress}
            />

            {!!displaySubtitleText && (
                <SubtitleDisplay
                    subtitle={displaySubtitleText}
                    position={settings.subtitlePosition}
                />
            )}

            {tvShow && (
                <SkipBanner activeSegment={activeSegment} onSkip={skipSegment} />
            )}

            {uiState.showControls && (
                <Animated.View
                    style={[styles.controlsOverlay, { opacity: controlsOpacity }]}
                    pointerEvents="box-none"
                >
                    <View style={styles.topControls}>
                        <TouchableOpacity style={styles.backButton} onPress={handleBack}>
                            <Ionicons name="chevron-back" size={28} color="white" />
                        </TouchableOpacity>

                        <View style={styles.titleContainer}>
                            <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
                        </View>

                        <GlassView glassEffectStyle="clear" style={styles.topRightControls}>
                            {canUsePictureInPicture && playerState.isReady && (
                                <TouchableOpacity style={styles.controlButton} onPress={handlePictureInPicture}>
                                    <MaterialIcons name="picture-in-picture-alt" size={22} color="white" />
                                </TouchableOpacity>
                            )}

                            {streams.length > 1 && (
                                <MenuWrapper
                                    style={{ zIndex: 1000 }}
                                    ref={streamMenuRef}
                                    title="Select Stream"
                                    onPressAction={Platform.OS === 'web' ? handleWebAction : handleNativeAction}
                                    actions={streamActions}
                                    shouldOpenOnLongPress={false}
                                    themeVariant="dark"
                                    onOpenMenu={handleMenuOpen}
                                    onCloseMenu={handleMenuClose}
                                >
                                    <TouchableOpacity style={styles.controlButton} onPress={() => {
                                        streamMenuRef.current?.show();
                                    }}>
                                        <MaterialIcons name="ondemand-video" size={24} color="white" />
                                    </TouchableOpacity>
                                </MenuWrapper>
                            )}

                            <TouchableOpacity style={styles.controlButton} onPress={handleMuteToggle}>
                                <Ionicons
                                    name={settings.isMuted ? "volume-mute" : "volume-high"}
                                    size={24}
                                    color="white"
                                />
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.controlButton} onPress={cycleContentFit}>
                                <MaterialIcons name={getContentFitIcon()} size={24} color="white" />
                            </TouchableOpacity>

                            {availableAudioTracks.length > 0 && (
                                <MenuWrapper
                                    style={{ zIndex: 1000 }}
                                    title="Audio Track"
                                    ref={audioMenuRef}
                                    onPressAction={Platform.OS === 'web' ? handleWebAction : handleNativeAction}
                                    actions={audioActions}
                                    shouldOpenOnLongPress={false}
                                    themeVariant="dark"
                                    onOpenMenu={handleMenuOpen}
                                    onCloseMenu={handleMenuClose}
                                >
                                    <TouchableOpacity style={styles.controlButton} onPress={() => {
                                        audioMenuRef.current?.show();
                                    }}>
                                        <MaterialIcons name="multitrack-audio" size={24} color="white" />
                                    </TouchableOpacity>
                                </MenuWrapper>
                            )}

                            {(subtitles.length > 0 || availableTextTracks.length > 0) && (
                                <MenuWrapper
                                    style={{ zIndex: 1000 }}
                                    title="Subtitles"
                                    ref={subtitleMenuRef}
                                    onPressAction={Platform.OS === 'web' ? handleWebAction : handleNativeAction}
                                    actions={subtitleActions}
                                    shouldOpenOnLongPress={false}
                                    themeVariant="dark"
                                    onOpenMenu={handleMenuOpen}
                                    onCloseMenu={handleMenuClose}
                                >
                                    <TouchableOpacity style={styles.controlButton} onPress={() => {
                                        subtitleMenuRef.current?.show();
                                    }}>
                                        <MaterialIcons name="closed-caption" size={24} color="white" />
                                    </TouchableOpacity>
                                </MenuWrapper>
                            )}

                            <MenuWrapper
                                style={{ zIndex: 1000 }}
                                title="Settings"
                                ref={settingsMenuRef}
                                onPressAction={Platform.OS === 'web' ? handleWebAction : handleNativeAction}
                                actions={settingsActions}
                                shouldOpenOnLongPress={false}
                                themeVariant="dark"
                                onOpenMenu={handleMenuOpen}
                                onCloseMenu={handleMenuClose}
                            >
                                <TouchableOpacity style={styles.controlButton} onPress={() => {
                                    settingsMenuRef.current?.show();
                                }}>
                                    <MaterialIcons name="settings" size={24} color="white" />
                                </TouchableOpacity>
                            </MenuWrapper>
                        </GlassView>
                    </View>

                    <CenterControls
                        isPlaying={playerState.isPlaying}
                        isReady={playerState.isReady}
                        isBuffering={playerState.isBuffering}
                        onPlayPause={togglePlayPause}
                        onSkipBackward={handleSkipBackward}
                        onSkipForward={handleSkipForward}
                    />

                    <View style={styles.bottomControls}>
                        <ProgressBar
                            currentTime={displayTime}
                            duration={playerState.duration}
                            sliderValue={sliderValue}
                            isReady={playerState.isReady}
                            onValueChange={handleSliderChange}
                            onSlidingStart={handleSliderStart}
                            onSlidingComplete={handleSliderComplete}
                            showSpeed={settings.playbackSpeed !== 1.0}
                            playbackSpeed={settings.playbackSpeed}
                        />
                    </View>
                </Animated.View>
            )}
        </View>
    );
};

export default MediaPlayer;
