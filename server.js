// server.js
const express = require('express');
const fetch = require('node-fetch');
const db = require('./firebase');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

app.get('/api/players', async (req, res) => {
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error in /api/players:', err);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998');
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
