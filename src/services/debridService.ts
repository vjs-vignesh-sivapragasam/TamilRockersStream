import { Alert } from 'react-native';

export type DebridProvider = 'real-debrid' | 'alldebrid' | 'none';

export interface DebridConfig {
  provider: DebridProvider;
  apiKey: string;
  enabled: boolean;
}

const RD_API_BASE = 'https://api.real-debrid.com/rest/1.0';

export class DebridService {
  private config: DebridConfig = {
    provider: 'none',
    apiKey: '',
    enabled: false,
  };

  public setConfig(config: DebridConfig) {
    this.config = config;
  }

  public getConfig(): DebridConfig {
    return this.config;
  }

  public isEnabled(): boolean {
    return this.config.enabled && !!this.config.apiKey && this.config.provider !== 'none';
  }

  /**
   * Unrestrict a torrent magnet link or return a direct download link.
   * This is a simplified wrapper. Real-Debrid requires adding magnet, getting info,
   * selecting files, and un-restricting the link.
   */
  public async unrestrictTorrent(urlOrMagnet: string): Promise<string> {
    if (this.config.provider === 'real-debrid') {
      return this.processRealDebrid(urlOrMagnet);
    }
    // AllDebrid or other providers can be added here
    throw new Error('Unsupported Debrid provider');
  }

  private async processRealDebrid(magnet: string): Promise<string> {
    const headers = {
      Authorization: `Bearer ${this.config.apiKey}`,
    };

    try {
      // 1. Add Magnet
      const addRes = await fetch(`${RD_API_BASE}/torrents/addMagnet`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ magnet }),
      });
      const addData = await addRes.json();
      if (addData.error) throw new Error(addData.error);
      const torrentId = addData.id;

      // 2. Wait for seeders/info (in a real app, you'd poll here if status is 'magnet_conversion')
      // For simplicity, assuming it's instantly cached
      const infoRes = await fetch(`${RD_API_BASE}/torrents/info/${torrentId}`, { headers });
      const infoData = await infoRes.json();
      if (infoData.error) throw new Error(infoData.error);

      // Select all video files
      const fileIds = infoData.files
        .filter((f: any) => f.path.match(/\.(mp4|mkv|avi|webm)$/i))
        .map((f: any) => f.id)
        .join(',');

      if (!fileIds) throw new Error('No video files found in torrent');

      // 3. Select Files
      const selectRes = await fetch(`${RD_API_BASE}/torrents/selectFiles/${torrentId}`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ files: fileIds }),
      });
      if (!selectRes.ok) throw new Error('Failed to select files in Debrid');

      // 4. Get the unrestricted link
      const updatedInfoRes = await fetch(`${RD_API_BASE}/torrents/info/${torrentId}`, { headers });
      const updatedInfo = await updatedInfoRes.json();
      
      const restrictedLink = updatedInfo.links[0];
      if (!restrictedLink) throw new Error('Torrent not cached. Please wait and try again later.');

      const unrestrictRes = await fetch(`${RD_API_BASE}/unrestrict/link`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ link: restrictedLink }),
      });
      const unrestrictData = await unrestrictRes.json();

      if (unrestrictData.download) {
        return unrestrictData.download;
      }
      throw new Error('Failed to get direct download link');
    } catch (err: any) {
      console.warn('Debrid conversion failed:', err.message);
      throw new Error(`Proxy Error: ${err.message}`);
    }
  }

  /**
   * For Data URIs (.torrent files), Real-Debrid requires file upload.
   */
  public async unrestrictTorrentFile(dataUri: string): Promise<string> {
    if (this.config.provider === 'real-debrid') {
      const headers = { Authorization: `Bearer ${this.config.apiKey}` };
      
      // Convert data: URI to Blob
      const base64 = dataUri.split(',')[1];
      const binary = atob(base64);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
      
      const blob = new Blob([array], { type: 'application/x-bittorrent' });
      
      const res = await fetch(`${RD_API_BASE}/torrents/addTorrent`, {
        method: 'PUT',
        headers,
        body: blob,
      });
      const addData = await res.json();
      if (addData.error) throw new Error(addData.error);
      
      // Once added, the process is the same as magnet from Step 2
      const torrentId = addData.id;
      const infoRes = await fetch(`${RD_API_BASE}/torrents/info/${torrentId}`, { headers });
      const infoData = await infoRes.json();
      
      const fileIds = infoData.files
        .filter((f: any) => f.path.match(/\.(mp4|mkv|avi|webm)$/i))
        .map((f: any) => f.id)
        .join(',');
      
      await fetch(`${RD_API_BASE}/torrents/selectFiles/${torrentId}`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ files: fileIds || 'all' }),
      });
      
      const updatedInfoRes = await fetch(`${RD_API_BASE}/torrents/info/${torrentId}`, { headers });
      const updatedInfo = await updatedInfoRes.json();
      
      const restrictedLink = updatedInfo.links[0];
      if (!restrictedLink) throw new Error('Torrent not cached. Try again later.');

      const unrestrictRes = await fetch(`${RD_API_BASE}/unrestrict/link`, {
        method: 'POST',
        headers,
        body: new URLSearchParams({ link: restrictedLink }),
      });
      const unrestrictData = await unrestrictRes.json();
      return unrestrictData.download;
    }
    throw new Error('Unsupported Debrid provider');
  }
}

export const debridService = new DebridService();
