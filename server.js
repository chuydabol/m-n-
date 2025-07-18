const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const db = require('./firebase');

const app = express();
const PORT = 80;

// Serve static files (HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Fetch player stats
app.get('/api/players', async (req, res) => {
  try {
    const response = await fetch(
      'https://proclubs.ea.com/api/fc/club/members/stats?platform=common-gen5&clubId=2491998'
    );
    const data = await response.json();
    console.log('Fetched player data:', Object.keys(data.members || {}));
    res.json(data);
  } catch (err) {
    console.error('Error fetching player stats:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// Fetch and optionally store matches in Firebase
app.get('/api/matches', async (req, res) => {
  try {
    const url =
      'https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998';
    const response = await fetch(url);
    const matches = await response.json();
    console.log(`Fetched ${matches.length} matches`);

    // OPTIONAL: Save matches to Firebase (can comment out if not ready)
    const batch = db.batch();
    matches.forEach((match) => {
      const matchRef = db.collection('matches').doc(match.matchId.toString());
      batch.set(matchRef, match, { merge: true });
    });
    await batch.commit();

    res.json(matches);
  } catch (err) {
    console.error('Error fetching matches:', err);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

// Serve index.html for all other routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
