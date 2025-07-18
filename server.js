// server.js
const express = require('express');
const fetch = require('node-fetch');
const db = require('./firebase');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.static('public'));

// Test endpoint to confirm server is up
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/api/players', async (req, res) => {
  console.log('Fetching player stats from EA API...');
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998');

    console.log('EA /players response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('EA /players response body (error):', errorText);
      return res.status(500).json({ error: 'Failed to fetch player stats from EA' });
    }

    const data = await response.json();
    console.log('EA /players data keys:', Object.keys(data));
    res.json(data);
  } catch (err) {
    console.error('Error in /api/players:', err);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

app.get('/api/matches', async (req, res) => {
  console.log('Fetching match history from EA API...');
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998');

    console.log('EA /matches response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('EA /matches response body (error):', errorText);
      return res.status(500).json({ error: 'Failed to fetch match history from EA' });
    }

    const matches = await response.json();
    console.log('EA /matches received:', matches.length, 'matches');

    // Save to Firebase
    const batch = db.batch();
    matches.forEach(match => {
      const matchRef = db.collection('matches').doc(String(match.matchId));
      batch.set(matchRef, match, { merge: true });
    });
    await batch.commit();
    console.log('Successfully saved matches to Firebase.');

    res.json(matches);
  } catch (err) {
    console.error('Error in /api/matches:', err);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
