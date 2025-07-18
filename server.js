// server.js
const express = require('express');
const fetch = require('node-fetch');
const db = require('./firebase');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Status route to verify server is live
app.get('/api/status', (req, res) => {
  res.send('Server is running');
});

// Get player stats from EA API
app.get('/api/players', async (req, res) => {
  try {
    console.log('Fetching player stats from EA API...');
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('EA API /players error response:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch player stats' });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error in /api/players:', err);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Get match history from EA API and save to Firebase
app.get('/api/matches', async (req, res) => {
  try {
    console.log('Fetching match history from EA API...');
    const response = await fetch('https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998', {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('EA API /matches error response:', errorText);
      return res.status(response.status).json({ error: 'Failed to fetch match history' });
    }

    const matches = await response.json();

    // Save to Firebase
    const batch = db.batch();
    matches.forEach(match => {
      const matchRef = db.collection('matches').doc(String(match.matchId));
      batch.set(matchRef, match, { merge: true });
    });
    await batch.commit();

    res.json(matches);
  } catch (err) {
    console.error('Error in /api/matches:', err);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
