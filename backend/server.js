import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import WebTorrent from 'webtorrent';
import cors from 'cors';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express & Socket.io
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Initialize Torrent Engine
const client = new WebTorrent();

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
  // Check if torrent already exists
  const existing = client.get(torrentId);
  if (existing) return existing.infoHash;

  client.add(torrentId, { path: DOWNLOAD_DIR }, (torrent) => {
    console.log(`[Torrent Added] ${torrent.name}`);
    
    // Broadcast newly added torrent
    io.emit('torrent_added', { 
      appId,
      id: torrent.infoHash, 
      name: torrent.name, 
      length: torrent.length 
    });

    // Stream live progress via WebSockets every 1 second
    const progressInterval = setInterval(() => {
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
      console.log(`[Torrent Finished] ${torrent.name}`);
      
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
  if (!magnet) return res.status(400).json({ error: 'Magnet link required' });
  
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

// Direct HTTP Range Video Streaming for any active torrent or magnet
app.get('/api/stream/play', (req, res) => {
  const magnetOrHash = req.query.magnet || req.query.hash || req.query.url;
  if (!magnetOrHash) return res.status(400).send('Magnet link or hash required');

  let torrent = client.get(magnetOrHash);
  if (!torrent) {
    try {
      torrent = client.add(magnetOrHash, { path: DOWNLOAD_DIR });
      console.log(`[Stream Auto-Added] ${magnetOrHash}`);
    } catch (e) {
      return res.status(500).send('Failed to add torrent: ' + e.message);
    }
  }

  const serveStream = () => {
    const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.ts', '.mov', '.m4v'];
    let file = torrent.files.find(f => videoExts.includes(path.extname(f.name).toLowerCase()));
    if (!file && torrent.files.length > 0) {
      file = torrent.files.reduce((a, b) => a.length > b.length ? a : b);
    }
    if (!file) return res.status(404).send('No video file in torrent yet');

    const range = req.headers.range;
    if (!range) {
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Length', file.length);
      file.createReadStream().pipe(res);
      return;
    }

    const positions = range.replace(/bytes=/, '').split('-');
    const start = parseInt(positions[0], 10);
    const total = file.length;
    const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
    const chunksize = end - start + 1;

    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${total}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    });

    file.createReadStream({ start, end }).pipe(res);
  };

  if (torrent.files && torrent.files.length > 0) {
    serveStream();
  } else {
    torrent.once('ready', serveStream);
    setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).send('Torrent metadata fetching timeout');
      }
    }, 20000);
  }
});

// Direct HTTP Range Video Streaming for any active torrent by infoHash
app.get('/api/stream/:infoHash', (req, res) => {
  const { infoHash } = req.params;
  const torrent = client.get(infoHash);
  if (!torrent) return res.status(404).send('Torrent not found in engine');

  const videoExts = ['.mp4', '.mkv', '.avi', '.webm', '.ts', '.mov', '.m4v'];
  let file = torrent.files.find(f => videoExts.includes(path.extname(f.name).toLowerCase()));
  if (!file && torrent.files.length > 0) {
    file = torrent.files.reduce((a, b) => a.length > b.length ? a : b);
  }
  if (!file) return res.status(404).send('No video file in torrent');

  const range = req.headers.range;
  if (!range) {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', file.length);
    file.createReadStream().pipe(res);
    return;
  }

  const positions = range.replace(/bytes=/, '').split('-');
  const start = parseInt(positions[0], 10);
  const total = file.length;
  const end = positions[1] ? parseInt(positions[1], 10) : total - 1;
  const chunksize = end - start + 1;

  res.writeHead(206, {
    'Content-Range': `bytes ${start}-${end}/${total}`,
    'Accept-Ranges': 'bytes',
    'Content-Length': chunksize,
    'Content-Type': 'video/mp4'
  });

  file.createReadStream({ start, end }).pipe(res);
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
