const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const db = require('./firebase');

const app = express();
const PORT = process.env.PORT || 80;

// Middleware: log each request
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// Serve static files from 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Simple root test route
app.get('/', (req, res) => {
  res.send('Server is up and running!');
});

// API route: get players
app.get('/api/players', async (req, res) => {
  try {
    const response = await fetch(
      'https://proclubs.ea.com/api/fc/club/members/stats?platform=common-gen5&clubId=2491998'
    );
    if (!response.ok) {
      console.error('EA API error:', response.status);
      return res.status(502).json({ error: 'EA API unreachable' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching players:', err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// API route: get matches and save to Firebase
app.get('/api/matches', async (req, res) => {
  try {
    const url =
      'https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998';
    const response = await fetch(url);
    if (!response.ok) {
      console.error('EA Matches API error:', response.status);
      return res.status(502).json({ error: 'EA Matches API unreachable' });
    }
    const matches = await response.json();
    console.log(`Fetched ${matches.length} matches`);

    // Save matches to Firebase
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

// Catch-all route: serve index.html for frontend routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
