import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import WebTorrent from 'webtorrent';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn, execFileSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express & Socket.io
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// High-speed tier-1 public trackers + regional trackers for fast peer discovery
const DEFAULT_TRACKERS = [
  'udp://tracker.opentrackr.org:1337/announce',
  'udp://open.demonii.com:1337/announce',
  'udp://open.stealth.si:80/announce',
  'udp://tracker.torrent.eu.org:451/announce',
  'udp://tracker.dler.org:6969/announce',
  'udp://explodie.org:6969/announce',
  'udp://tracker.coppersurfer.tk:6969/announce',
  'udp://p4p.arenabg.com:1337/announce',
  'udp://movies.zsw.ca:6969/announce',
  'udp://tracker.cyberia.is:6969/announce',
  'udp://tracker.moeking.me:6969/announce',
  'udp://opentracker.i2p.rocks:6969/announce',
  'http://tracker.openbittorrent.com:80/announce',
  'http://tracker.bt4g.com:2095/announce',
  'udp://tracker-udp.gbitt.info:80/announce',
  'http://ipv4announce.sktorrent.eu:6969/announce',
  'https://tracker.leechshield.link:443/announce',
  'https://torrents.tmtime.dev:443/announce',
  'udp://tracker.openbts.com:6969/announce',
];

// Helper to extract embedded trackers from magnet link and combine with defaults
function getCombinedTrackers(magnetString) {
  const set = new Set(DEFAULT_TRACKERS);
  if (typeof magnetString === 'string') {
    const matches = magnetString.matchAll(/[?&]tr=([^&]+)/gi);
    for (const m of matches) {
      try {
        set.add(decodeURIComponent(m[1]));
      } catch (_) {
        set.add(m[1]);
      }
    }
  }
  return Array.from(set);
}

// Prevent uncaught errors (like aborted client streams) from crashing node server
process.on('uncaughtException', (err) => {
  console.warn('[Server Warning] Caught unhandled exception:', err?.message || err);
});
process.on('unhandledRejection', (reason) => {
  console.warn('[Server Warning] Caught unhandled rejection:', reason);
});

// Initialize Torrent Engine with maximum peer connections and parallel DHT lookups
const client = new WebTorrent({
  maxConns: 150,
  dht: {
    concurrency: 32,
    bootstrap: [
      'router.bittorrent.com:6881',
      'dht.transmissionbt.com:6881',
      'router.utorrent.com:6881',
      'dht.aelitis.com:6881',
    ],
  },
});
client.on('error', (err) => {
  console.warn('[WebTorrent Engine Warning]:', err.message || err);
});

// Setup Directories
const DOWNLOAD_DIR = path.join(__dirname, 'downloads');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR);
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

// Setup File Uploads for .torrent files
const upload = multer({ dest: 'uploads/' });

// Serve downloaded files statically so the App can stream/download them
app.use('/downloads', express.static(DOWNLOAD_DIR));

/**
 * Handle adding a torrent (shared logic for Magnet and .torrent file)
 */
function addTorrentToEngine(torrentId, appId) {
  let cleanId = torrentId;
  if (typeof torrentId === 'string') {
    cleanId = torrentId.replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
  }

  // Check if torrent already exists
  const existing = client.get(cleanId);
  if (existing) {
    console.log(`[Engine] Torrent already active: ${existing.name || existing.infoHash}`);
    return existing.infoHash;
  }

  console.log(`\n======================================================`);
  console.log(`[Engine] Queuing Torrent / Magnet:`);
  console.log(typeof cleanId === 'string' ? cleanId.substring(0, 120) + '...' : cleanId);
  console.log(`[Engine] Announcing to trackers and resolving metadata...`);
  console.log(`======================================================\n`);

  const torrent = client.add(cleanId, { path: DOWNLOAD_DIR, announce: getCombinedTrackers(cleanId) }, (torrent) => {
    console.log(`\n[Torrent Metadata Ready] 🎬 "${torrent.name}"`);
    console.log(`[Torrent Details] Total Size: ${(torrent.length / (1024 * 1024)).toFixed(2)} MB | Files: ${torrent.files.length}`);
    torrent.files.forEach((f, idx) => {
      console.log(`  File ${idx + 1}: ${f.name} (${(f.length / (1024 * 1024)).toFixed(2)} MB)`);
    });
    
    // Broadcast newly added torrent
    io.emit('torrent_added', { 
      appId,
      id: torrent.infoHash, 
      name: torrent.name, 
      length: torrent.length 
    });

    // Stream live progress via WebSockets every 1 second AND log to console
    const progressInterval = setInterval(() => {
      const pct = (torrent.progress * 100).toFixed(2);
      const speedMB = (torrent.downloadSpeed / (1024 * 1024)).toFixed(2);
      const downloadedMB = (torrent.downloaded / (1024 * 1024)).toFixed(2);
      const totalMB = (torrent.length / (1024 * 1024)).toFixed(2);
      const peers = torrent.numPeers;

      console.log(`[Progress] ${pct}% | ${downloadedMB} / ${totalMB} MB | Speed: ${speedMB} MB/s | Active Peers: ${peers}`);

      io.emit('torrent_progress', {
        appId,
        id: torrent.infoHash,
        progress: torrent.progress,
        downloadSpeed: torrent.downloadSpeed,
        downloaded: torrent.downloaded,
        timeRemaining: torrent.timeRemaining,
        numPeers: torrent.numPeers
      });
    }, 1000);

    torrent.on('error', (err) => {
      console.error(`[Torrent Error] ${torrent.name}:`, err);
    });

    torrent.on('done', () => {
      clearInterval(progressInterval);
      console.log(`\n🎉 [Torrent Download Complete] ${torrent.name}`);
      
      // Find the main video file
      const videoExts = ['.mp4', '.mkv', '.avi', '.webm'];
      let mainFile = torrent.files.find(f => videoExts.includes(path.extname(f.name).toLowerCase()));
      if (!mainFile && torrent.files.length > 0) {
        mainFile = torrent.files.reduce((a, b) => a.length > b.length ? a : b);
      }

      io.emit('torrent_done', { 
        appId,
        id: torrent.infoHash, 
        name: torrent.name, 
        fileName: mainFile ? mainFile.name : torrent.name,
        downloadUrl: `/downloads/${mainFile ? encodeURIComponent(mainFile.path) : ''}`
      });
    });
  });

  torrent.on('infoHash', () => {
    console.log(`[InfoHash Identified]: ${torrent.infoHash}`);
  });

  torrent.on('wire', (wire, addr) => {
    console.log(`[Peer Handshake] Peer connected (${addr || 'remote'}). Total Peers: ${torrent.numPeers}`);
  });

  torrent.on('warning', (err) => {
    console.warn(`[Torrent Warning]:`, err?.message || err);
  });
}

// ---------------- API ENDPOINTS ---------------- //

// Server Health / Ping Endpoint
app.get('/api/ping', (req, res) => {
  res.json({
    status: 'ok',
    server: 'VFlix Torrent Engine',
    torrentsActive: client.torrents.length,
    timestamp: Date.now()
  });
});

app.post('/api/torrent/magnet', (req, res) => {
  const { magnet, appId } = req.body;
  console.log(`\n[API Received POST /api/torrent/magnet]`);
  if (!magnet) {
    console.warn(`[API] Missing magnet in request body`);
    return res.status(400).json({ error: 'Magnet link required' });
  }
  
  addTorrentToEngine(magnet, appId);
  res.json({ success: true, message: 'Magnet added to queue' });
});

app.post('/api/torrent/file', upload.single('torrent'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Torrent file required' });
  
  const torrentFilePath = req.file.path;
  const appId = req.body.appId;
  addTorrentToEngine(torrentFilePath, appId);
  res.json({ success: true, message: 'Torrent file added to queue' });
});

app.post('/api/torrent/file-base64', (req, res) => {
  const { appId, name, base64 } = req.body;
  if (!base64) return res.status(400).json({ error: 'Base64 data required' });
  
  // Extract actual base64 content if it has data URL prefix
  const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = Buffer.from(pureBase64, 'base64');
  
  const tempPath = path.join(UPLOADS_DIR, name || `upload_${Date.now()}.torrent`);
  fs.writeFileSync(tempPath, buffer);
  
  addTorrentToEngine(tempPath, appId);
  res.json({ success: true, message: 'Base64 torrent file added to queue' });
});

// Helper for video mime type
function getStreamContentType(fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = {
    '.mp4': 'video/mp4',
    '.m4v': 'video/mp4',
    '.webm': 'video/webm',
    '.mkv': 'video/mp4', // MP4 MIME allows HTML5 player to decode H.264/AAC streams smoothly
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.ts': 'video/mp2t',
  };
  return mimeMap[ext] || 'video/mp4';
}

/**
 * Detect if the file needs audio transcoding using ffprobe.
 * Returns true if any audio stream uses a codec not supported in HTML5 browsers.
 */
function needsAudioTranscoding(filePath) {
  try {
    const output = execFileSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a',
      '-show_entries', 'stream=codec_name',
      '-of', 'csv=p=0',
      filePath,
    ], { timeout: 5000, encoding: 'utf8' });
    // Codecs NOT supported in HTML5 / Android WebView
    const incompatible = ['eac3', 'ac3', 'dts', 'truehd', 'mlp', 'opus'];
    const codecs = output.trim().split('\n').map(c => c.trim().toLowerCase()).filter(Boolean);
    console.log(`[FFprobe] Audio codecs in file: ${codecs.join(', ')}`);
    return codecs.some(c => incompatible.includes(c));
  } catch (e) {
    console.warn('[FFprobe] Could not detect audio codec:', e.message);
    return false; // Fail open — don't transcode if ffprobe fails
  }
}

/**
 * Stream a video file through FFmpeg (EAC3/AC3/DTS → AAC) as fragmented MP4.
 * Reads from filePath directly (faster than pipe, supports seeking via -ss).
 */
function streamWithFfmpegTranscode(filePath, req, res) {
  if (res.writableEnded || res.destroyed) return;

  console.log(`[FFmpeg Transcode] Starting EAC3→AAC transcode for: ${path.basename(filePath)}`);

  // Parse optional start offset from Range header for basic seeking support
  let startSec = 0;
  const range = req.headers.range;
  // Note: byte-range seeking is approximate with transcoded output.
  // We use time-based seeking via -ss for cleaner behaviour.
  // The client sends Range: bytes=X — we map that to a time offset.
  // For simplicity, ignore Range on transcode streams (send full stream from start).
  // The fragmented MP4 output with empty_moov allows the browser to start playing immediately.

  res.writeHead(200, {
    'Content-Type': 'video/mp4',
    'Transfer-Encoding': 'chunked',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges',
    // Do NOT set Content-Length — output size is unknown until transcode completes
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  const ff = spawn('ffmpeg', [
    '-hide_banner',
    '-loglevel', 'warning',
    '-i', filePath,
    '-map', '0:v:0',    // first video stream
    '-map', '0:a:0',    // first audio stream (e.g. Tamil track)
    '-c:v', 'copy',     // copy video — no re-encode, preserves quality & speed
    '-c:a', 'aac',      // transcode audio to AAC (universally supported)
    '-ac', '2',         // downmix to stereo (5.1 → stereo for mobile)
    '-b:a', '192k',     // 192 kbps — good quality for stereo
    '-f', 'mp4',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof', // fragmented MP4 for streaming
    'pipe:1',           // output to stdout
  ]);

  ff.stdout.pipe(res);

  ff.stderr.on('data', (data) => {
    // Only log non-empty warning/error lines
    const msg = data.toString().trim();
    if (msg) console.warn(`[FFmpeg] ${msg}`);
  });

  ff.on('error', (err) => {
    console.error('[FFmpeg spawn error]:', err.message);
    if (!res.headersSent) {
      res.status(500).send('FFmpeg error: ' + err.message);
    }
  });

  ff.on('close', (code) => {
    console.log(`[FFmpeg] Process exited with code ${code}`);
    if (!res.writableEnded) res.end();
  });

  // Kill FFmpeg if client disconnects to free resources
  req.on('close', () => {
    try { ff.kill('SIGKILL'); } catch (_) {}
    console.log('[FFmpeg] Client disconnected — transcoding stopped.');
  });
}

/**
 * Stream a video file to an Express response with Range support and critical piece prioritization.
 * Automatically detects incompatible audio codecs and transcodes via FFmpeg.
 */
function streamVideoFileToResponse(torrent, file, req, res) {
  if (res.writableEnded || res.destroyed) return;

  // Deselect all non-video files to allocate 100% bandwidth to video
  torrent.files.forEach((f) => {
    if (f !== file && typeof f.deselect === 'function') {
      try { f.deselect(); } catch (_) {}
    }
  });

  // Prioritize this video file in WebTorrent
  if (typeof file.select === 'function') {
    try { file.select(0, file._endPiece - file._startPiece, 1); } catch (_) {}
  }

  // Set critical pieces for HEAD (container headers / moov / codec info) and TAIL (index)
  const startPiece = file._startPiece;
  const endPiece = file._endPiece;
  if (typeof torrent.critical === 'function') {
    try {
      torrent.critical(startPiece, Math.min(startPiece + 35, endPiece));
      torrent.critical(Math.max(startPiece, endPiece - 15), endPiece);
    } catch (_) {}
  }

  // Check if file is available on disk (partially or fully downloaded)
  // file.path from WebTorrent is RELATIVE (just filename) — resolve to absolute path
  const filePath = path.isAbsolute(file.path)
    ? file.path
    : path.join(DOWNLOAD_DIR, file.path);
  const fileExistsOnDisk = filePath && fs.existsSync(filePath);
  console.log(`[Stream] File path resolved: ${filePath} | exists: ${fileExistsOnDisk}`);

  // If it's MKV/AVI (potentially incompatible codecs) and file is on disk, probe audio
  const ext = path.extname(file.name).toLowerCase();
  const mightNeedTranscode = ['.mkv', '.avi', '.ts', '.mov'].includes(ext);

  if (fileExistsOnDisk && mightNeedTranscode && needsAudioTranscoding(filePath)) {
    console.log(`[Stream] Audio transcoding required for: ${file.name}`);
    return streamWithFfmpegTranscode(filePath, req, res);
  }

  // --- Standard streaming (MP4 / compatible audio) ---
  const contentType = getStreamContentType(file.name);
  const range = req.headers.range;

  if (!range) {
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': file.length,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Range',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
    });
    const stream = file.createReadStream();
    stream.on('error', (err) => {
      console.warn('[Stream Pipe error]:', err.message);
    });
    stream.pipe(res);
    req.on('close', () => {
      try { stream.destroy(); } catch (_) {}
    });
    return;
  }

  const positions = range.replace(/bytes=/, '').split('-');
  const start = parseInt(positions[0], 10);
  const total = file.length;

  // Chunk cap: 10MB per open-ended range request. This ensures initial headers
  // stream immediately to the player without waiting for gigabytes to buffer!
  const MAX_CHUNK_SIZE = 10 * 1024 * 1024; // 10MB
  const requestedEnd = positions[1] ? parseInt(positions[1], 10) : null;
  const end = requestedEnd !== null ? requestedEnd : Math.min(start + MAX_CHUNK_SIZE - 1, total - 1);
  const chunksize = end - start + 1;

  // Immediately prioritize pieces covering this range + next 15 pieces
  const pieceLength = torrent.pieceLength;
  if (pieceLength && typeof torrent.critical === 'function') {
    try {
      const reqStartPiece = Math.floor((file._offset + start) / pieceLength);
      const reqEndPiece = Math.floor((file._offset + end) / pieceLength);
      torrent.critical(reqStartPiece, Math.min(reqEndPiece + 15, endPiece));
    } catch (_) {}
  }

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Range',
    'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
  });

  const stream = file.createReadStream({ start, end });
  stream.on('error', (err) => {
    console.warn('[Stream Pipe error]:', err.message);
  });
  stream.pipe(res);
  req.on('close', () => {
    try { stream.destroy(); } catch (_) {}
  });
}

// Background stream pre-warmer: initiates tracker query & DHT resolution in advance
app.get('/api/stream/warmup', (req, res) => {
  const rawMagnet = req.query.magnet || req.query.hash || req.query.url;
  if (!rawMagnet) return res.status(400).json({ error: 'Magnet link required' });

  const cleanMagnet = rawMagnet.toString().replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
  const trackers = getCombinedTrackers(cleanMagnet);

  let infoHash = null;
  const hashMatch = cleanMagnet.match(/urn:btih:([a-zA-Z0-9]{40}|[a-zA-Z0-9]{32})/i);
  if (hashMatch) {
    infoHash = hashMatch[1].toLowerCase();
  }

  let torrent = (infoHash ? client.get(infoHash) : null) || client.get(cleanMagnet);
  if (!torrent) {
    try {
      torrent = client.add(cleanMagnet, {
        path: DOWNLOAD_DIR,
        deselect: true,
        announce: trackers,
      });
      console.log(`[Stream Warmup] Pre-connecting to peers for ${torrent.name || cleanMagnet.substring(0, 40)}...`);
    } catch (_) {}
  }
  res.json({ success: true, infoHash: torrent ? torrent.infoHash : infoHash });
});

// Direct HTTP Range Video Streaming for any active torrent or magnet (Stremio-style)
app.get('/api/stream/play', (req, res) => {
  const rawMagnet = req.query.magnet || req.query.hash || req.query.url;
  if (!rawMagnet) return res.status(400).send('Magnet link or hash required');

  const cleanMagnet = rawMagnet.toString().replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim();
  const trackers = getCombinedTrackers(cleanMagnet);

  let infoHash = null;
  const hashMatch = cleanMagnet.match(/urn:btih:([a-zA-Z0-9]{40}|[a-zA-Z0-9]{32})/i);
  if (hashMatch) {
    infoHash = hashMatch[1].toLowerCase();
  } else if (/^[a-zA-Z0-9]{40}$/i.test(cleanMagnet)) {
    infoHash = cleanMagnet.toLowerCase();
  }

  let torrent = (infoHash ? client.get(infoHash) : null) || client.get(cleanMagnet);
  if (!torrent) {
    try {
      torrent = client.add(cleanMagnet, {
        path: DOWNLOAD_DIR,
        deselect: true,
        announce: trackers,
      });
      torrent.on('error', (err) => {
        console.warn('[Torrent Stream Warning]:', err.message);
      });
      console.log(`[Stremio Stream Added] ${(torrent.name || cleanMagnet).substring(0, 60)}...`);
    } catch (e) {
      if (infoHash) torrent = client.get(infoHash);
      if (!torrent) return res.status(500).send('Failed to add torrent: ' + e.message);
    }
  }

  const findVideoAndStream = () => {
    const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.ts', '.mov', '.m4v'];
    let file = torrent.files && torrent.files.find((f) => videoExts.includes(path.extname(f.name).toLowerCase()));
    if (!file && torrent.files && torrent.files.length > 0) {
      file = torrent.files.reduce((a, b) => (a.length > b.length ? a : b));
    }
    if (!file) {
      if (!res.headersSent) res.status(404).send('No video file in torrent yet');
      return;
    }
    streamVideoFileToResponse(torrent, file, req, res);
  };

  if (torrent.files && torrent.files.length > 0) {
    findVideoAndStream();
  } else {
    torrent.once('ready', findVideoAndStream);
    torrent.once('metadata', findVideoAndStream);
    const timeout = setTimeout(() => {
      if (!res.headersSent && !res.destroyed) {
        res.status(504).send('Torrent metadata fetching timeout. Ensure torrent has active seeders.');
      }
    }, 45000);
    torrent.once('ready', () => clearTimeout(timeout));
    torrent.once('metadata', () => clearTimeout(timeout));
  }
});

// Direct HTTP Range Video Streaming for any active torrent by infoHash
app.get('/api/stream/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  const magnet = req.query.magnet;
  const isRaw = req.query.raw === '1' || Boolean(req.headers.range) || Boolean(req.headers.accept && req.headers.accept.includes('video/'));
  let torrent = client.get(infoHash.toLowerCase());

  if (!torrent) {
    const rawTarget = magnet
      ? magnet.toString().replace(/&amp;/g, '&').replace(/&#38;/g, '&').trim()
      : `magnet:?xt=urn:btih:${infoHash}`;
    const trackers = getCombinedTrackers(rawTarget);
    try {
      torrent = client.add(rawTarget, {
        path: DOWNLOAD_DIR,
        deselect: true,
        announce: trackers,
      });
    } catch (_) {}
  }

  // If opened directly in a browser without range headers, serve a sleek HTML5 video player page
  if (!isRaw && req.headers.accept && req.headers.accept.includes('text/html')) {
    const torrentName = (torrent && torrent.name) ? torrent.name : `Torrent Stream (${infoHash.slice(0, 8)})`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VFlix - ${torrentName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #000000; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; overflow: hidden; }
    .top-bar { position: absolute; top: 18px; left: 24px; right: 24px; display: flex; align-items: center; justify-content: space-between; z-index: 20; pointer-events: none; }
    .logo { color: #FA243C; font-size: 20px; font-weight: 900; letter-spacing: 1.5px; }
    .title { color: #A0A0A0; font-size: 13px; font-weight: 500; max-width: 60%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .player-wrap { width: 100vw; height: 100vh; display: flex; align-items: center; justify-content: center; background: #000; position: relative; }
    video { width: 100%; height: 100%; max-height: 100vh; object-fit: contain; outline: none; background: #000; }
  </style>
</head>
<body>
  <div class="top-bar">
    <span class="logo">VFLIX</span>
    <span class="title">${torrentName}</span>
  </div>
  <div class="player-wrap">
    <video controls autoplay playsinline preload="auto" src="/api/stream/${infoHash}?raw=1">
      Your browser does not support HTML5 video.
    </video>
  </div>
</body>
</html>`;
    return res.send(html);
  }

  if (!torrent) return res.status(404).send('Torrent not found in engine');

  const findVideoAndStream = () => {
    const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.ts', '.mov', '.m4v'];
    let file = torrent.files && torrent.files.find((f) => videoExts.includes(path.extname(f.name).toLowerCase()));
    if (!file && torrent.files && torrent.files.length > 0) {
      file = torrent.files.reduce((a, b) => (a.length > b.length ? a : b));
    }
    if (!file) {
      if (!res.headersSent) res.status(404).send('No video file in torrent');
      return;
    }
    streamVideoFileToResponse(torrent, file, req, res);
  };

  if (torrent.files && torrent.files.length > 0) {
    findVideoAndStream();
  } else {
    torrent.once('ready', findVideoAndStream);
    torrent.once('metadata', findVideoAndStream);
    const timeout = setTimeout(() => {
      if (!res.headersSent && !res.destroyed) {
        res.status(504).send('Torrent metadata fetching timeout.');
      }
    }, 45000);
    torrent.once('ready', () => clearTimeout(timeout));
    torrent.once('metadata', () => clearTimeout(timeout));
  }
});

app.get('/api/torrents', (req, res) => {
  const torrents = client.torrents.map(t => ({
    id: t.infoHash,
    name: t.name,
    progress: t.progress,
    downloadSpeed: t.downloadSpeed,
    numPeers: t.numPeers,
    done: t.done
  }));
  res.json({ torrents });
});

// Start Server
const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ VFlix Torrent Backend is running on port ${PORT}`);
  console.log(`📡 Ready to receive torrents and stream progress via WebSockets!`);
});
