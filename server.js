const express = require('express');
const fetch = require('node-fetch'); // v2
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

const CLUB_ID = '2491998';
const PLATFORM = 'common-gen5';

// === Middleware ===
// Serve static files from /public folder
app.use(express.static(path.join(__dirname, 'public')));

// Enable CORS if needed
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// === Retry helper ===
async function fetchWithRetry(url, options = {}, retries = 2, backoff = 1000) {
  try {
    const res = await fetch(url, {
      ...options,
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        ...options.headers
      }
    });

    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    return await res.json();
  } catch (err) {
    if (retries > 0) {
      console.warn(`Fetch failed, retrying... (${retries} left): ${err.message}`);
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
};
const CACHE_DURATION = 60 * 1000; // 1 minute

// === Player stats endpoint ===
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
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

// === Root route ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// === Start server ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});
