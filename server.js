const express = require('express');
const fetch = require('node-fetch'); // v2
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 80;

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

// === Route: Get Player Stats ===
app.get('/api/players', async (req, res) => {
  console.log('GET /api/players');
  try {
    const response = await fetch(`https://proclubs.ea.com/api/fc/members/stats?platform=${PLATFORM}&clubId=${CLUB_ID}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      console.error('EA API error:', response.status);
      return res.status(response.status).json({ error: 'EA API error' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Player fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

// === Route: Get Match History (Persistent) ===
app.get('/api/matches', async (req, res) => {
  console.log('GET /api/matches');

  try {
    // Load existing matches from local storage
    let savedMatches = [];
    if (fs.existsSync(MATCHES_FILE)) {
      const fileContents = fs.readFileSync(MATCHES_FILE, 'utf8');
      savedMatches = JSON.parse(fileContents || '[]');
    }

    // Fetch new matches from EA
    const response = await fetch(`https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=${PLATFORM}&clubIds=${CLUB_ID}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    if (!response.ok) {
      console.error('EA Match API error:', response.status);
      return res.status(response.status).json({ error: 'EA Match API error' });
    }

    const latestMatches = await response.json();

    // Combine and deduplicate
    const existingIds = new Set(savedMatches.map(m => m.matchId));
    const newMatches = latestMatches.filter(m => !existingIds.has(m.matchId));
    const allMatches = [...newMatches, ...savedMatches];

    // Save updated match list
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(allMatches, null, 2));

    // Return to client
    res.json(allMatches);
  } catch (err) {
    console.error('Match fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history', details: err.message });
  }
});

// === Serve Homepage ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === Start Server ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running at http://0.0.0.0:${PORT}`);
});
