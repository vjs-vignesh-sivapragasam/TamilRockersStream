import { Platform } from "react-native";
import { getOriginalPlatform } from "./platform";

export const isKSPlayerSupported = (): boolean => {
    if (Platform.OS !== 'ios') return false;
    try {
        const { UIManager, requireNativeComponent } = require('react-native');
        if (!UIManager) return false;
        const hasConfig = typeof (UIManager as any).hasViewManagerConfig === 'function'
            ? Boolean((UIManager as any).hasViewManagerConfig('KSPlayerView'))
            : Boolean(UIManager.getViewManagerConfig && UIManager.getViewManagerConfig('KSPlayerView'));
        if (!hasConfig) return false;
        requireNativeComponent('KSPlayerView');
        return true;
    } catch {
        return false;
    }
};

export const isNativeVideoSupported = (): boolean => {
    if (Platform.OS === 'web') return false;
    try {
        const { UIManager, requireNativeComponent } = require('react-native');
        if (!UIManager) return false;
        const hasConfig = typeof (UIManager as any).hasViewManagerConfig === 'function'
            ? Boolean((UIManager as any).hasViewManagerConfig('RCTVideo') || (UIManager as any).hasViewManagerConfig('RNVVideo'))
            : Boolean(UIManager.getViewManagerConfig && (UIManager.getViewManagerConfig('RCTVideo') || UIManager.getViewManagerConfig('RNVVideo')));
        if (!hasConfig) return false;
        requireNativeComponent('RCTVideo');
        return true;
    } catch {
        return false;
    }
};

export const isPictureInPictureSupported = (): boolean => {
    if (Platform.OS === 'ios' || Platform.OS === 'android') {
        return true;
    }

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
        return document.pictureInPictureEnabled === true;
    }

    return false;
};

export enum Players {
    Default = 'Default',
    External = 'External',
    VLC = 'VLC',
    Infuse = 'Infuse',
    VidHub = 'VidHub',
    Outplayer = 'Outplayer'
}

export const getPlatformSpecificPlayers = () => {
    if (getOriginalPlatform() === 'android') {
        return [
            { name: Players.Default, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.VLC, scheme: 'vlc://STREAMURL', encodeUrl: false },
            { name: Players.External, scheme: 'STREAMURL', encodeUrl: false },
        ];
    } else if (getOriginalPlatform() === 'ios') {
        return [
            { name: Players.Default, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.External, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.VLC, scheme: 'vlc://STREAMURL', encodeUrl: false },
            { name: Players.Infuse, scheme: 'infuse://x-callback-url/play?url=STREAMURL', encodeUrl: true },
            { name: Players.VidHub, scheme: 'open-vidhub://x-callback-url/open?url=STREAMURL', encodeUrl: true },
            { name: Players.Outplayer, scheme: 'outplayer://STREAMURL', encodeUrl: false },
        ];
    } else if (getOriginalPlatform() === 'web') {
        return [
            { name: Players.Default, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.External, scheme: 'STREAMURL', encodeUrl: false }
        ];
    } else if (getOriginalPlatform() === 'windows') {
        return [
            { name: Players.Default, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.External, scheme: 'STREAMURL', encodeUrl: false },
        ];
    } else if (getOriginalPlatform() === 'macos') {
        return [
            { name: Players.Default, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.External, scheme: 'STREAMURL', encodeUrl: false },
            { name: Players.VLC, scheme: 'vlc://STREAMURL', encodeUrl: false },
            { name: Players.Infuse, scheme: 'infuse://x-callback-url/play?url=STREAMURL', encodeUrl: true },
            { name: Players.VidHub, scheme: 'open-vidhub://x-callback-url/open?url=STREAMURL', encodeUrl: true },
        ];
    }
    return [];
};
