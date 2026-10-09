const memoryStorage = new Map<string, string>();

let mmkvInstance: any = null;
try {
    const { createMMKV } = require('react-native-mmkv');
    mmkvInstance = createMMKV({ id: 'tmv' });
} catch (e) {
    console.warn('[StorageService] react-native-mmkv not available, using fallback storage');
}

export const StorageKeys = {
    SERVERS_KEY: 'TMV_SERVERS',
    ADDONS_KEY: 'TMV_ADDONS',
    DEFAULT_MEDIA_PLAYER_KEY: 'TMV_DEFAULT_MEDIA_PLAYER',
    OPENSUBTITLES_API_KEY: 'TMV_OPENSUBTITLES_API_KEY',
    OPENSUBTITLES_USER_AGENT: 'TMV_OPENSUBTITLES_USER_AGENT',
    WATCH_HISTORY_KEY: 'TMV_WATCH_HISTORY_KEY',
    SUBTITLE_LANGUAGES_KEY: 'TMV_SUBTITLE_LANGUAGES_KEY',
    LIBRARY_KEY: 'TMV_LIBRARY_KEY'
} as const;

export const storageService = {
    getItem(key: string): string | undefined {
        try {
            if (mmkvInstance) return mmkvInstance.getString(key);
            if (typeof localStorage !== 'undefined') return localStorage.getItem(key) ?? undefined;
            return memoryStorage.get(key);
        } catch (error) {
            console.error('Error reading storage:', error);
            return undefined;
        }
    },

    setItem(key: string, value: string): void {
        try {
            if (mmkvInstance) {
                mmkvInstance.set(key, value);
                return;
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, value);
                return;
            }
            memoryStorage.set(key, value);
        } catch (error) {
            console.error('Error writing to storage:', error);
        }
    },

    removeItem(key: string): void {
        try {
            if (mmkvInstance) {
                mmkvInstance.remove(key);
                return;
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem(key);
                return;
            }
            memoryStorage.delete(key);
        } catch (error) {
            console.error('Error removing from storage:', error);
        }
    },

    clear(): void {
        try {
            if (mmkvInstance) {
                mmkvInstance.clearAll();
            } else if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            } else {
                memoryStorage.clear();
            }
        } catch (error) {
            console.error('Error clearing storage:', error);
        }
    },

    isAvailable(): boolean {
        return true;
    },

    getObject<T>(key: string): T | undefined {
        try {
            const value = this.getItem(key);
            return value ? JSON.parse(value) : undefined;
        } catch (error) {
            console.error('Error parsing object from storage:', error);
            return undefined;
        }
    },

    setObject(key: string, value: any): void {
        try {
            this.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Error setting object to storage:', error);
        }
    },

    getBoolean(key: string): boolean | undefined {
        try {
            const val = this.getItem(key);
            if (val === undefined) return undefined;
            return val === 'true';
        } catch (error) {
            return undefined;
        }
    },

    setBoolean(key: string, value: boolean): void {
        this.setItem(key, String(value));
    },

    getNumber(key: string): number | undefined {
        try {
            const val = this.getItem(key);
            if (val === undefined) return undefined;
            return Number(val);
        } catch (error) {
            return undefined;
        }
    },

    setNumber(key: string, value: number): void {
        this.setItem(key, String(value));
    },

    getAllKeys(): string[] {
        try {
            if (mmkvInstance) return mmkvInstance.getAllKeys();
            if (typeof localStorage !== 'undefined') return Object.keys(localStorage);
            return Array.from(memoryStorage.keys());
        } catch (error) {
            return [];
        }
    },

    contains(key: string): boolean {
        return this.getItem(key) !== undefined;
    }
};

export { mmkvInstance as storage };