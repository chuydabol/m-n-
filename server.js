// server.js
const express = require('express');
const fetch = require('node-fetch'); // Use node-fetch v2 for CommonJS
const path = require('path');
const app = express();

const PORT = process.env.PORT || 10000;

// Serve static files from the root directory (index.html, etc.)
app.use(express.static(__dirname));

// === Route: Player Stats ===
app.get('/api/players', async (req, res) => {
  console.log('📥 Request: /api/players');
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    if (!response.ok) {
      console.error('❌ EA /players error:', response.status);
      return res.status(response.status).json({ error: 'EA API error on /players' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('❌ Error fetching /players:', err.message);
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

// === Route: Match History ===
app.get('/api/matches', async (req, res) => {
  console.log('📥 Request: /api/matches');
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      timeout: 10000
    });

    if (!response.ok) {
      console.error('❌ EA /matches error:', response.status);
      return res.status(response.status).json({ error: 'EA API error on /matches' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('❌ Error fetching /matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history', details: err.message });
  }
});

// === Route: Serve HTML ===
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// === Start Server ===
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
