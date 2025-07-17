const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const db = require('./firebase');

const app = express();
const PORT = 80;

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/players', async (req, res) => {
  try {
    const response = await fetch(`https://proclubs.ea.com/api/fc/club/stats?platform=common-gen5&clubId=2491998`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

app.get('/api/matches', async (req, res) => {
  try {
    const url = `https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998`;
    const response = await fetch(url);
    const matches = await response.json();

    const batch = db.batch();
    matches.forEach(match => {
      const matchRef = db.collection('matches').doc(match.matchId.toString());
      batch.set(matchRef, match, { merge: true });
    });
    await batch.commit();

    res.json(matches);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
