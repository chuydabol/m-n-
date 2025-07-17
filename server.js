const express = require('express');
const fetch = require('node-fetch'); // v2
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
// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS if needed
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// === Retry helper with exponential backoff ===
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RenderBot/1.0)',
        ...options.headers
      },
      timeout: 10000
    });
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying fetch (${retries} left): ${err.message}`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
    } else {
      throw err;
    }
  }
}

// === In-memory cache ===
const cache = {
  playersData: null,
  playersTimestamp: 0,
  matchesData: null,
  matchesTimestamp: 0
};

const CACHE_DURATION = 60 * 1000; // 1 minute

// === API Route: Get Player Stats ===
app.get('/api/players', async (req, res) => {
  console.log('GET /api/players');

  if (cache.playersData && Date.now() - cache.playersTimestamp < CACHE_DURATION) {
    return res.json(cache.playersData);
  }

  try {
    const url = `https://proclubs.ea.com/api/fc/members/stats?platform=${PLATFORM}&clubId=${CLUB_ID}`;
    const data = await fetchWithRetry(url);

    cache.playersData = data;
    cache.playersTimestamp = Date.now();

    res.json(data);
  } catch (err) {
    console.error('Player fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// === API Route: Get Match History ===
app.get('/api/matches', async (req, res) => {
  console.log('GET /api/matches');

  if (cache.matchesData && Date.now() - cache.matchesTimestamp < CACHE_DURATION) {
    return res.json(cache.matchesData);
  }

  try {
    let savedMatches = [];
    if (fs.existsSync(MATCHES_FILE)) {
      savedMatches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8') || '[]');
    }

    const url = `https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=${PLATFORM}&clubIds=${CLUB_ID}`;
    const latestMatches = await fetchWithRetry(url);

    const existingIds = new Set(savedMatches.map(m => m.matchId));
    const newMatches = latestMatches.filter(m => !existingIds.has(m.matchId));
    const allMatches = [...newMatches, ...savedMatches];

    fs.writeFileSync(MATCHES_FILE, JSON.stringify(allMatches, null, 2));

    cache.matchesData = allMatches;
    cache.matchesTimestamp = Date.now();

    res.json(allMatches);
  } catch (err) {
    console.error('Match fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

// === Fallback Route to Serve index.html ===
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// === Start Server ===
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
