const express = require('express');
const fetch = require('node-fetch'); // make sure v2 installed for CommonJS
const path = require('path');

const app = express();
const PORT = process.env.PORT || 80;

// Serve static files (like index.html, CSS, JS)
app.use(express.static(__dirname));

// Optional: CORS headers if needed
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

// Route: Get Player Stats
app.get('/api/players', async (req, res) => {
  console.log('GET /api/players');
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error('EA API error:', response.status);
      return res.status(response.status).json({ error: 'EA API error', status: response.status });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Failed to fetch player stats', details: err.message });
  }
});

// Route: Get Match History
app.get('/api/matches', async (req, res) => {
  console.log('GET /api/matches');
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      console.error('EA Match API error:', response.status);
      return res.status(response.status).json({ error: 'EA Match API error', status: response.status });
    }

    const data = await response.json();

    // Log the full data to inspect structure for debugging
    console.log('Match history data:', JSON.stringify(data, null, 2));

    res.json(data);
  } catch (err) {
    console.error('Server error fetching matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch match history', details: err.message });
  }
});

// Serve the index.html page on root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});
