type TorrentEventListener = (event: {
  type: 'metadata' | 'progress' | 'done' | 'error' | 'peer' | 'ready';
  id: string;
  data: any;
}) => void;

class TorrentEngineService {
  private listeners = new Set<TorrentEventListener>();
  private webViewRef: any = null;
  private pendingCommands: string[] = [];

  public setWebViewRef(ref: any) {
    this.webViewRef = ref;
    if (this.webViewRef && this.pendingCommands.length > 0) {
      for (const cmd of this.pendingCommands) {
        this.sendCommand(cmd);
      }
      this.pendingCommands = [];
    }
  }

  public subscribe(listener: TorrentEventListener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public notify(event: { type: 'metadata' | 'progress' | 'done' | 'error' | 'peer' | 'ready'; id: string; data: any }) {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.warn('Error in torrent listener:', err);
      }
    }
  }

  private sendCommand(commandJson: string) {
    if (this.webViewRef) {
      const script = `window.__handleTorrentCommand && window.__handleTorrentCommand(${JSON.stringify(commandJson)}); true;`;
      this.webViewRef.injectJavaScript(script);
    } else {
      this.pendingCommands.push(commandJson);
    }
  }

  /**
   * Add a torrent to the engine.
   * @param id      Unique download item ID
   * @param source  magnet: link, data: URI (base64 .torrent), or https:// URL
   * @param trackers Optional list of tracker URLs from the torrent's announce-list.
   *                 The engine will merge these with its built-in WSS tracker list.
   */
  public addTorrent(id: string, torrentSource: string, trackers: string[] = []) {
    this.sendCommand(
      JSON.stringify({
        action: 'ADD',
        id,
        source: torrentSource,
        trackers,          // passed to WebView so it can merge with WSS list
      })
    );
  }

  public pauseTorrent(id: string) {
    this.sendCommand(JSON.stringify({ action: 'PAUSE', id }));
  }

  public resumeTorrent(id: string) {
    this.sendCommand(JSON.stringify({ action: 'RESUME', id }));
  }

  public removeTorrent(id: string) {
    this.sendCommand(JSON.stringify({ action: 'REMOVE', id }));
  }
}

export const torrentEngine = new TorrentEngineService();
