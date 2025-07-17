const express = require('express');
const fetch = require('node-fetch'); // v2
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 80;

const MATCHES_FILE = path.join(__dirname, 'data', 'matches.json');
const CLUB_ID = '2491998';
const PLATFORM = 'common-gen5';

// Ensure data directory exists
fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });

// Serve static files
app.use(express.static(__dirname));

// CORS (optional)
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// === Route: Get Player Stats ===
app.get('/api/players', async (req, res) => {
  try {
    const response = await fetch(`https://proclubs.ea.com/api/fc/members/stats?platform=${PLATFORM}&clubId=${CLUB_ID}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'EA API error' });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Player fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

// === Route: Get Match History (persisted) ===
app.get('/api/matches', async (req, res) => {
  try {
    // 1. Load local match history
    let savedMatches = [];
    if (fs.existsSync(MATCHES_FILE)) {
      savedMatches = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf-8'));
    }

    // 2. Fetch latest matches from EA
    const response = await fetch(`https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=${PLATFORM}&clubIds=${CLUB_ID}`, {
      timeout: 10000,
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    if (!response.ok) return res.status(response.status).json({ error: 'EA Match API error' });
    const latestMatches = await response.json();

    // 3. Merge matches, avoiding duplicates
    const existingMatchIds = new Set(savedMatches.map(m => m.matchId));
    const newMatches = latestMatches.filter(m => !existingMatchIds.has(m.matchId));
    const combinedMatches = [...newMatches, ...savedMatches];

    // 4. Save updated match history
    fs.writeFileSync(MATCHES_FILE, JSON.stringify(combinedMatches, null, 2));

    // 5. Send to client
    res.json(combinedMatches);
  } catch (err) {
    console.error('Match fetch error:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history', details: err.message });
  }
});

// === Serve homepage ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
