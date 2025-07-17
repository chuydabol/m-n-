const express = require('express');
const fetch = require('node-fetch'); // v2
const AbortController = require('abort-controller');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

const CLUB_ID = '2491998';
const PLATFORM = 'common-gen5';
const DATA_DIR = path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

// Ensure the /data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// === Middleware ===
// Serve static files (index.html, client JS, CSS, etc.)
app.use(express.static(__dirname));

// Enable CORS (if you fetch from a different domain)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// === Fetch helper with timeout and retry using AbortController ===
async function fetchWithTimeout(url, options = {}, retries = 2, backoff = 1000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds timeout

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RenderBot/1.0)',
        ...options.headers,
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    clearTimeout(timeout);
    if (retries > 0) {
      console.warn(`Fetch failed, retrying in ${backoff}ms... (${retries} retries left) - ${err.message}`);
      await new Promise((r) => setTimeout(r, backoff));
      return fetchWithTimeout(url, options, retries - 1, backoff * 1.5);
    } else {
      throw err;
    }
  }
}

// === In-memory caches ===
const cache = {
  playersData: null,
  playersTimestamp: 0,
  matchesData: null,
  matchesTimestamp: 0,
};

const CACHE_DURATION = 60 * 1000; // 1 minute cache

// === Route: Get Player Stats with retry & cache ===
app.get('/api/players', async (req, res) => {
  console.log('GET /api/players');

  if (cache.playersData && Date.now() - cache.playersTimestamp < CACHE_DURATION) {
    console.log('Serving cached player stats');
    return res.json(cache.playersData);
  }

  try {
    const url = `https://proclubs.ea.com/api/fc/members/stats?platform=${PLATFORM}&clubId=${CLUB_ID}`;
    const data = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    cache.playersData = data;
    cache.playersTimestamp = Date.now();

    res.json(data);
  } catch (err) {
    console.error('Player fetch error:', err.stack || err.message);
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

// === Route: Get Match History (Persistent) with retry & cache ===
app.get('/api/matches', async (req, res) => {
  console.log('GET /api/matches');

  if (cache.matchesData && Date.now() - cache.matchesTimestamp < CACHE_DURATION) {
    console.log('Serving cached matches data');
    return res.json(cache.matchesData);
  }

  try {
    // Load existing matches from local storage
    let savedMatches = [];
    if (fs.existsSync(MATCHES_FILE)) {
      const fileContents = fs.readFileSync(MATCHES_FILE, 'utf8');
      savedMatches = JSON.parse(fileContents || '[]');
    }

    // Fetch new matches from EA with retries
    const url = `https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=${PLATFORM}&clubIds=${CLUB_ID}`;
    const latestMatches = await fetchWithTimeout(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });

    // Combine and deduplicate
    const existingIds = new Set(savedMatches.map((m) => m.matchId));
    const newMatches = latestMatches.filter((m) => !existingIds.has(m.matchId));
    const allMatches = [...newMatches, ...savedMatches];

    // Save updated match list locally
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(allMatches, null, 2));

    // Cache result
    cache.matchesData = allMatches;
    cache.matchesTimestamp = Date.now();

    res.json(allMatches);
  } catch (err) {
    console.error('Match fetch error:', err.stack || err.message);
    res.status(500).json({ error: 'Failed to fetch match history', details: err.message });
  }
});

// === Health Check for Render ===
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// === Serve Homepage ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === Start Server ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});
