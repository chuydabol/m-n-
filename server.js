const express = require('express');
const fetch = require('node-fetch'); // v2 syntax
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const CLUB_ID = '2491998';
const PLATFORM = 'common-gen5';
const DATA_DIR = path.join(__dirname, 'data');
const MATCHES_FILE = path.join(DATA_DIR, 'matches.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.static(__dirname));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

const cache = {
  playersData: null,
  playersTimestamp: 0,
  matchesData: null,
  matchesTimestamp: 0,
};

const CACHE_DURATION = 60 * 1000;

async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RenderBot/1.0)',
        ...options.headers
      }
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`Retrying ${url} in ${backoff}ms (${retries} retries left)`);
      await new Promise(r => setTimeout(r, backoff));
      return fetchWithRetry(url, options, retries - 1, backoff * 2);
    }
    throw err;
  }
}

app.get('/api/players', async (req, res) => {
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
    console.error('Error fetching players:', err.message);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

app.get('/api/matches', async (req, res) => {
  if (cache.matchesData && Date.now() - cache.matchesTimestamp < CACHE_DURATION) {
    return res.json(cache.matchesData);
  }

  try {
    let savedMatches = [];
    if (fs.existsSync(MATCHES_FILE)) {
      const fileContents = fs.readFileSync(MATCHES_FILE, 'utf8');
      savedMatches = JSON.parse(fileContents || '[]');
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
    console.error('Error fetching matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
