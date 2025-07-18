const express = require('express');
const fetch = require('node-fetch');
const db = require('./firebase');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

// Optional: Quick status check
app.get('/api/status', (req, res) => {
  res.json({ status: 'Server is running', firebaseProject: process.env.FIREBASE_PROJECT_ID });
});

// Fetch player stats from EA API
app.get('/api/players', async (req, res) => {
  try {
    console.log('Fetching player stats from EA API...');
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998');

    if (!response.ok) {
      const text = await response.text();
      console.error('EA API error response:', text);
      return res.status(response.status).json({ error: 'Failed to fetch from EA API' });
    }

    const data = await response.json();
    console.log('Player data fetched successfully.');
    res.json(data);
  } catch (err) {
    console.error('Error in /api/players:', err);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

// Fetch match history from EA API and save to Firebase
app.get('/api/matches', async (req, res) => {
  try {
    console.log('Fetching match history from EA API...');
    const response = await fetch('https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998');

    if (!response.ok) {
      const text = await response.text();
      console.error('EA API error response:', text);
      return res.status(response.status).json({ error: 'Failed to fetch from EA API' });
    }

    const matches = await response.json();
    console.log(`Fetched ${matches.length} matches. Writing to Firebase...`);

    const batch = db.batch();
    matches.forEach(match => {
      const matchRef = db.collection('matches').doc(String(match.matchId));
      batch.set(matchRef, match, { merge: true });
    });

    await batch.commit();
    console.log('Matches saved to Firebase.');
    res.json(matches);
  } catch (err) {
    console.error('Error in /api/matches:', err);
    res.status(500).json({ error: 'Failed to fetch match history' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
});
