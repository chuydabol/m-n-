const express = require('express');
const fetch = require('node-fetch'); // Use v2
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

const CLUB_ID = '2491998';
const PLATFORM = 'common-gen5';

const DATA_DIR = path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

// Ensure /data directory exists
fs.mkdirSync(DATA_DIR, { recursive: true });

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// CORS header (optional if frontend/backend on same domain)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Simple retry helper
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
  const timeoutOptions = {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CustomBot/1.0)',
      ...options.headers
    }
  };

  try {
    const res = await fetch(url, timeoutOptions);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying ${url} in ${backoff}ms...`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, timeoutOptions, retries - 1, backoff * 1.5);
    } else {
      throw err;
    }
  }
}

// In-memory cache
const cache = {
  playersData: null,
  playersTimestamp: 0,
  matchesData: null,
  matchesTimestamp: 0,
};

const CACHE_DURATION = 60 * 1000; // 1 minute

// GET /api/players
app.get('/api/players', async (req, res) => {
  console.log('GET /api/players');

  if (cache.playersData && (Date.now() - cache.playersTimestamp < CACHE_DURATION)) {
    console.log('Serving cached player stats');
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

// GET /api/matches
app.get('/api/matches', async (req, res) => {
  console.log('GET /api/matches');

  if (cache.matchesData && (Date.now() - cache.matchesTimestamp < CACHE_DURATION)) {
    console.log('Serving cached matches');
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

// Health check (optional for platforms like Render)
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Fallback: serve index.html for everything else
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
