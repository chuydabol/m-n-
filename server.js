const express = require('express');
const { MongoClient } = require('mongodb');
const fetch = require('node-fetch');

const app = express();
const PORT = 80; // or use process.env.PORT

const MONGO_URI = 'your_mongodb_connection_string_here'; // Replace with your actual MongoDB URI
const CLUB_ID = '2491998';
const PLATFORM = 'common-gen5';
const MATCH_API_URL = `https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=${PLATFORM}&clubIds=${CLUB_ID}`;

const client = new MongoClient(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

async function fetchMatchHistory() {
  const response = await fetch(MATCH_API_URL);
  if (!response.ok) {
    throw new Error(`EA API error: ${response.status}`);
  }
  const data = await response.json();
  return data;
}

async function saveMatches(matchesCollection, matches) {
  for (const match of matches) {
    const exists = await matchesCollection.findOne({ matchId: match.matchId });
    if (!exists) {
      await matchesCollection.insertOne(match);
      console.log(`Saved match ${match.matchId}`);
    }
  }
}

async function main() {
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db('proclubs');
    const matchesCollection = db.collection('matches');

    // Fetch and save latest match data when server starts
    const latestMatches = await fetchMatchHistory();
    await saveMatches(matchesCollection, latestMatches);

    // Serve saved match data
    app.get('/api/matches', async (req, res) => {
      const savedMatches = await matchesCollection.find().sort({ timestamp: -1 }).toArray();
      res.json(savedMatches);
    });

    // Serve players (optional, if you want to add `/api/players` too)
    // app.get('/api/players', async (req, res) => {
    //   ...
    // });

    // Serve static files (if using public folder)
    app.use(express.static('public'));

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });

  } catch (err) {
    console.error('❌ Server Error:', err);
  }
}

main();
