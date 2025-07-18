const express = require('express');
const path = require('path');
const fetch = require('node-fetch');
const db = require('./firebase');

const app = express();
const PORT = process.env.PORT || 80;

app.use(express.static(path.join(__dirname, 'public')));

// Helper: fetch with timeout
const fetchWithTimeout = async (url, options = {}, timeout = 8000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(url, {
    ...options,
    signal: controller.signal,
    headers: {
      'User-Agent': 'Mozilla/5.0', // spoof user agent
      ...(options.headers || {})
    }
  });
  clearTimeout(id);
  return response;
};

// Fetch player stats
app.get('/api/players', async (req, res) => {
  try {
    const response = await fetchWithTimeout(
      'https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998'
    );
    if (!response.ok) throw new Error(`EA API failed: ${response.status}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('❌ Error in /api/players:', err.message);
    res.status(500).json({ error: 'Failed to fetch players from EA' });
  }
});

// Fetch and store matches in Firebase
app.get('/api/matches', async (req, res) => {
  try {
    const url = 'https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=2491998';
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`EA API failed: ${response.status}`);
    const matches = await response.json();
    console.log(`✅ Fetched ${matches.length} matches`);

    const batch = db.batch();
    matches.forEach((match) => {
      const matchRef = db.collection('matches').doc(String(match.matchId));
      batch.set(matchRef, match, { merge: true });
    });
    await batch.commit();
    console.log('✅ Matches saved to Firestore');
    res.json(matches);
  } catch (err) {
    console.error('❌ Error in /api/matches:', err.message);
    res.status(500).json({ error: 'Failed to fetch matches from EA' });
  }
});

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
