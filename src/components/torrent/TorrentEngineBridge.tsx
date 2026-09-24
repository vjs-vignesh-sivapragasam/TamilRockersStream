import React, { useRef, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { torrentEngine } from '../../services/torrentEngine';

const WEBTORRENT_BRIDGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Torrent P2P Engine</title>
  <script src="https://cdn.jsdelivr.net/npm/webtorrent@2.1.35/webtorrent.min.js"></script>
</head>
<body>
  <div id="status">WebTorrent Engine Ready</div>
  <script>
    (function() {
      var client = null;
      var activeTorrents = {};
      var progressIntervals = {};

      // Comprehensive WSS tracker list — more trackers = more peers
      var WSS_TRACKERS = [
        'wss://tracker.openwebtorrent.com',
        'wss://tracker.webtorrent.dev',
        'wss://tracker.btorrent.xyz',
        'wss://tracker.fastcast.nz',
        'wss://tracker.files.fm:7073/announce',
        'wss://spacetradegame.com:443/announce',
        'wss://tracker.novage.com.ua',
        'wss://tracker.openwebtorrent.com:443/announce'
      ];

      function sendToNative(type, id, data) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            engineEvent: true, type: type, id: id, data: data
          }));
        }
      }

      function log(msg) {
        console.log('[TorrentBridge]', msg);
      }

      function initClient() {
        if (typeof WebTorrent === 'undefined') {
          log('WebTorrent not loaded yet, retrying...');
          setTimeout(initClient, 500);
          return;
        }
        if (client) return;
        try {
          client = new WebTorrent({
            tracker: {
              rtcConfig: {
                iceServers: [
                  { urls: 'stun:stun.l.google.com:19302' },
                  { urls: 'stun:stun1.l.google.com:19302' },
                  { urls: 'stun:stun2.l.google.com:19302' },
                  { urls: 'stun:global.stun.twilio.com:3478' },
                  { urls: 'stun:stun.nextcloud.com:443' }
                ]
              }
            }
          });

          client.on('error', function(err) {
            log('WebTorrent client error: ' + err.message);
          });

          log('WebTorrent client initialized: v' + WebTorrent.VERSION);
          sendToNative('ready', 'engine', { version: WebTorrent.VERSION });
        } catch(e) {
          log('Failed to init WebTorrent: ' + e.message);
        }
      }

      initClient();

      // ── HTTP Tracker Announce (UDP fallback via HTTP) ────────────────────────
      // Queries HTTP trackers from the torrent's own announce list.
      // Returns peer count from HTTP trackers as a best-effort discovery.
      async function scrapeHttpTrackers(infoHash, trackerList) {
        if (!infoHash || !trackerList || trackerList.length === 0) return;
        var httpTrackers = trackerList.filter(function(t) {
          return t && (t.startsWith('http://') || t.startsWith('https://'));
        });
        if (httpTrackers.length === 0) return;

        // Build a fake peer_id and key for the HTTP announce
        var peerId = '-WT0200-' + Math.random().toString(36).substr(2, 12);
        var infoHashHex = infoHash.toLowerCase();

        for (var i = 0; i < Math.min(httpTrackers.length, 3); i++) {
          var tracker = httpTrackers[i];
          try {
            // Convert hex infohash to URL-encoded binary
            var encoded = '';
            for (var j = 0; j < infoHashHex.length; j += 2) {
              encoded += '%' + infoHashHex.substr(j, 2);
            }
            var announceUrl = tracker +
              '?info_hash=' + encoded +
              '&peer_id=' + encodeURIComponent(peerId) +
              '&port=6881&uploaded=0&downloaded=0&left=9999999999&compact=1&event=started&numwant=100';

            log('HTTP announce: ' + tracker);
            var res = await fetch(announceUrl, { signal: AbortSignal.timeout(8000) });
            if (res.ok) {
              log('HTTP tracker responded: ' + tracker);
            }
          } catch(e) {
            log('HTTP tracker failed: ' + tracker + ' - ' + e.message);
          }
        }
      }

      window.__handleTorrentCommand = function(commandStr) {
        try {
          var cmd = typeof commandStr === 'string' ? JSON.parse(commandStr) : commandStr;
          var action = cmd.action;
          var id = cmd.id;
          var source = cmd.source;
          // Extra trackers from the torrent file itself (passed from native)
          var extraTrackers = cmd.trackers || [];

          if (action === 'ADD') {
            if (!client) {
              initClient();
              setTimeout(function() { window.__handleTorrentCommand(commandStr); }, 1500);
              return;
            }

            // Merge WSS trackers + any WSS trackers from the torrent's announce list
            var torrentWssTrackers = extraTrackers.filter(function(t) {
              return t && (t.startsWith('wss://') || t.startsWith('ws://'));
            });
            var allTrackers = WSS_TRACKERS.concat(torrentWssTrackers);

            var opts = { announce: allTrackers };

            log('Adding torrent id=' + id + ' trackers=' + allTrackers.length);

            try {
              var torrent = client.add(source, opts, function(torrent) {
                activeTorrents[id] = torrent;

                var infoHash = torrent.infoHash;
                log('Torrent ready: ' + torrent.name + ' hash=' + infoHash);

                // Kick HTTP tracker announces in background
                scrapeHttpTrackers(infoHash, extraTrackers);

                // Find the largest video file
                var mainFile = null;
                var videoExts = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'ts', 'm4v'];
                for (var i = 0; i < torrent.files.length; i++) {
                  var f = torrent.files[i];
                  var ext = f.name.split('.').pop().toLowerCase();
                  if (videoExts.indexOf(ext) !== -1) {
                    if (!mainFile || f.length > mainFile.length) mainFile = f;
                  }
                }
                if (!mainFile && torrent.files.length > 0) {
                  mainFile = torrent.files.reduce(function(a, b) { return a.length > b.length ? a : b; });
                }

                sendToNative('metadata', id, {
                  name: torrent.name,
                  movieFileName: mainFile ? mainFile.name : torrent.name,
                  totalSize: torrent.length,
                  infoHash: infoHash,
                  files: torrent.files.map(function(f) {
                    return { name: f.name, length: f.length, path: f.path };
                  })
                });

                // Progress updates every 1s
                if (progressIntervals[id]) clearInterval(progressIntervals[id]);
                progressIntervals[id] = setInterval(function() {
                  if (!torrent || torrent.destroyed) {
                    clearInterval(progressIntervals[id]);
                    return;
                  }
                  var speed = torrent.downloadSpeed;
                  var speedStr = '0 KB/s';
                  if (speed >= 1024 * 1024) {
                    speedStr = (speed / (1024 * 1024)).toFixed(1) + ' MB/s';
                  } else if (speed > 0) {
                    speedStr = (speed / 1024).toFixed(0) + ' KB/s';
                  }

                  sendToNative('progress', id, {
                    progress: torrent.progress,
                    downloaded: torrent.downloaded,
                    total: torrent.length,
                    downloadSpeed: speedStr,
                    peersCount: torrent.numPeers,
                    timeRemaining: torrent.timeRemaining
                  });
                }, 1000);

                torrent.on('wire', function(wire) {
                  log('New peer connected: ' + wire.remoteAddress);
                  sendToNative('peer', id, { peers: torrent.numPeers });
                });

                torrent.on('done', function() {
                  clearInterval(progressIntervals[id]);
                  if (mainFile) {
                    mainFile.getBlobURL(function(err, url) {
                      sendToNative('done', id, {
                        movieFileName: mainFile.name,
                        blobUrl: url || '',
                        totalSize: torrent.length
                      });
                    });
                  } else {
                    sendToNative('done', id, {
                      movieFileName: torrent.name,
                      totalSize: torrent.length
                    });
                  }
                });

                torrent.on('error', function(err) {
                  sendToNative('error', id, { message: err.message || 'Torrent error' });
                });
              });

              torrent.on('error', function(err) {
                sendToNative('error', id, { message: err.message || 'Error adding torrent' });
              });

            } catch(addErr) {
              sendToNative('error', id, { message: addErr.message || 'Failed to start torrent' });
            }
          }

          if (action === 'PAUSE') {
            var t = activeTorrents[id];
            if (t && t.pause) t.pause();
          }

          if (action === 'RESUME') {
            var t = activeTorrents[id];
            if (t && t.resume) t.resume();
          }

          if (action === 'REMOVE') {
            if (progressIntervals[id]) clearInterval(progressIntervals[id]);
            var t = activeTorrents[id];
            if (t) {
              try { t.destroy(); } catch(e) {}
              delete activeTorrents[id];
            }
          }

        } catch(err) {
          console.error('Command handling error:', err);
        }
      };
    })();
  </script>
</body>
</html>
`;

export const TorrentEngineBridge: React.FC = () => {
  const webViewRef = useRef<WebView>(null);

  useEffect(() => {
    torrentEngine.setWebViewRef(webViewRef.current);
  }, []);

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.engineEvent) {
        torrentEngine.notify({
          type: data.type,
          id: data.id,
          data: data.data,
        });
      }
    } catch {}
  };

  return (
    <View style={styles.hiddenContainer} pointerEvents="none">
      <WebView
        ref={(ref) => {
          (webViewRef as any).current = ref;
          torrentEngine.setWebViewRef(ref);
        }}
        originWhitelist={['*']}
        source={{ html: WEBTORRENT_BRIDGE_HTML, baseUrl: 'https://localhost' }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        allowFileAccess
        allowUniversalAccessFromFileURLs
        mixedContentMode="always"
        mediaPlaybackRequiresUserAction={false}
        style={styles.hiddenWebView}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  hiddenContainer: {
    width: 0,
    height: 0,
    position: 'absolute',
    top: -9999,
    left: -9999,
    opacity: 0,
  },
  hiddenWebView: {
    width: 1,
    height: 1,
  },
});
