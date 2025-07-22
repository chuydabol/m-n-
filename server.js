const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const admin = require('firebase-admin');
const cors = require('cors');
const cron = require('node-cron');

const serviceAccount = require('./config/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = admin.firestore();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(path.join(__dirname)));
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Fixed clubs with display names
const CLUB_IDS = ['2491998', '1527486', '1969494', '2086022', '2462194'];
const CLUB_NAMES = {
  '2491998': 'Royal Republic',
  '1527486': 'Gungan FC',
  '1969494': 'Club Frijol',
  '2086022': 'Brehemen',
  '2462194': 'Costa Chica FC',
};

async function fetchPlayersForClub(clubId) {
  const url = `https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=${clubId}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) throw new Error(`Failed fetching players for club ${clubId}, status: ${res.status}`);
    return res.json();
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

app.get('/api/players', async (req, res) => {
  try {
    const results = await Promise.all(CLUB_IDS.map(id =>
      fetchPlayersForClub(id).catch(e => {
        console.error(`[${new Date().toISOString()}] Error fetching club ${id}: ${e.message}`);
        return { members: [] };
      })
    ));
    const allMembers = results.flatMap(r => Array.isArray(r.members) ? r.members : []);
    const unique = new Map();
    for (const player of allMembers) {
      if (player?.name && !unique.has(player.name)) unique.set(player.name, player);
    }
    res.json({ members: Array.from(unique.values()) });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] /api/players error:`, error);
    res.status(500).json({ error: 'Failed to fetch player stats' });
  }
});

async function fetchMatchesForClubs() {
  let allMatches = [];
  for (const clubId of CLUB_IDS) {
    try {
      const url = `https://proclubs.ea.com/api/fc/clubs/matches?matchType=leagueMatch&platform=common-gen5&clubIds=${clubId}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const matches = await response.json();

      let matchesArray = [];
      if (Array.isArray(matches)) {
        matchesArray = matches;
      } else if (typeof matches === 'object' && matches !== null) {
        for (const key of Object.keys(matches)) {
          if (Array.isArray(matches[key])) {
            matchesArray = matchesArray.concat(matches[key]);
          }
        }
      }
      allMatches = allMatches.concat(matchesArray);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error fetching matches for club ${clubId}:`, error.message);
    }
  }
  return allMatches;
}

async function saveNewMatches(matches) {
  const BATCH_LIMIT = 400;
  let savedCount = 0;

  for (let i = 0; i < matches.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    const chunk = matches.slice(i, i + BATCH_LIMIT);

    for (const match of chunk) {
      const matchId = match.matchId?.toString() || match.id?.toString();
      if (!matchId) continue;

      const clubs = match.clubs || {};
      const clubIdsInMatch = Object.keys(clubs);
      if (clubIdsInMatch.length !== 2) continue;
      if (!clubIdsInMatch.some(id => CLUB_IDS.includes(id))) continue;

      for (const id of clubIdsInMatch) {
        if (!clubs[id].details) clubs[id].details = {};
        if (!clubs[id].details.name || clubs[id].details.name === id) {
          clubs[id].details.name = CLUB_NAMES[id] || `Club ${id}`;
        }
      }

      const docRef = db.collection('matches').doc(matchId);
      const doc = await docRef.get();
      if (!doc.exists) {
        batch.set(docRef, {
          ...match,
          timestamp: match.timestamp || Date.now(),
          clubs,
        });
        savedCount++;
        console.log(`[${new Date().toISOString()}] Queued new match for saving: ${matchId}`);
      }
    }

    await batch.commit();
    console.log(`[${new Date().toISOString()}] Batch commit done (${chunk.length} matches)`);
  }

  if (savedCount === 0) {
    console.log(`[${new Date().toISOString()}] No new matches to save.`);
  } else {
    console.log(`[${new Date().toISOString()}] Saved ${savedCount} new matches.`);
  }

  return savedCount;
}

app.get('/api/matches', async (req, res) => {
  try {
    const snapshot = await db.collection('matches')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get();
    const matches = snapshot.docs.map(doc => doc.data());
    res.json({ matches });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] /api/matches error:`, error.message);
    res.status(500).json({ error: 'Failed to fetch matches' });
  }
});

app.post('/api/update-matches', async (req, res) => {
  try {
    const matches = await fetchMatchesForClubs();
    const savedCount = await saveNewMatches(matches);
    res.json({ message: `Updated. Saved ${savedCount} new matches.`, updatedCount: savedCount });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] /api/update-matches error:`, error.message);
    res.status(500).json({ error: 'Failed to update matches' });
  }
});

app.get('/api/league', async (req, res) => {
  try {
    const snapshot = await db.collection('matches')
      .orderBy('timestamp', 'desc')
      .limit(1000)
      .get();
    const matches = snapshot.docs.map(doc => doc.data());

    // Initialize league table
    const leagueTable = {};
    for (const clubId of CLUB_IDS) {
      leagueTable[clubId] = {
        id: clubId,
        name: CLUB_NAMES[clubId],
        wins: 0,
        ties: 0,
        losses: 0,
        goals: 0,
        goalsAgainst: 0,
        points: 0,
      };
    }

    // Calculate standings
    for (const match of matches) {
      const clubs = match.clubs || {};
      const clubIdsInMatch = Object.keys(clubs);

      if (!clubIdsInMatch.some(id => CLUB_IDS.includes(id))) continue;

      const [clubAId, clubBId] = clubIdsInMatch;
      const clubA = clubs[clubAId];
      const clubB = clubs[clubBId];

      const goalsA = Number(clubA.goals || 0);
      const goalsB = Number(clubB.goals || 0);

      if (leagueTable[clubAId]) {
        leagueTable[clubAId].goals += goalsA;
        leagueTable[clubAId].goalsAgainst += goalsB;
      }

      if (leagueTable[clubBId]) {
        leagueTable[clubBId].goals += goalsB;
        leagueTable[clubBId].goalsAgainst += goalsA;
      }

      if (goalsA > goalsB) {
        if (leagueTable[clubAId]) {
          leagueTable[clubAId].wins++;
          leagueTable[clubAId].points += 3;
        }
        if (leagueTable[clubBId]) leagueTable[clubBId].losses++;
      } else if (goalsB > goalsA) {
        if (leagueTable[clubBId]) {
          leagueTable[clubBId].wins++;
          leagueTable[clubBId].points += 3;
        }
        if (leagueTable[clubAId]) leagueTable[clubAId].losses++;
      } else {
        if (leagueTable[clubAId]) {
          leagueTable[clubAId].ties++;
          leagueTable[clubAId].points += 1;
        }
        if (leagueTable[clubBId]) {
          leagueTable[clubBId].ties++;
          leagueTable[clubBId].points += 1;
        }
      }
    }

    // Aggregate player stats for goals and assists
    const playerGoals = {};
    const playerAssists = {};
    for (const match of matches) {
      if (match.players) {
        const playersByClub = match.players;
        for (const clubId in playersByClub) {
          const players = playersByClub[clubId];
          for (const playerId in players) {
            const p = players[playerId];
            const name = p.playername || 'Unknown';
            const goals = Number(p.goals || 0);
            const assists = Number(p.assists || 0);
            playerGoals[name] = (playerGoals[name] || 0) + goals;
            playerAssists[name] = (playerAssists[name] || 0) + assists;
          }
        }
      }
    }

    const topScorers = Object.entries(playerGoals)
      .map(([name, goals]) => ({ name, goals }))
      .filter(p => p.goals > 0)
      .sort((a, b) => b.goals - a.goals)
      .slice(0, 10);

    const topAssists = Object.entries(playerAssists)
      .map(([name, assists]) => ({ name, assists }))
      .filter(p => p.assists > 0)
      .sort((a, b) => b.assists - a.assists)
      .slice(0, 10);

    // Sort league table by points, then goal difference
    const standingsSorted = Object.values(leagueTable).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const gdB = b.goals - b.goalsAgainst;
      const gdA = a.goals - a.goalsAgainst;
      return gdB - gdA;
    });

    res.json({
      standings: standingsSorted,
      topScorers,
      topAssists,
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] /api/league error:`, error.message);
    res.status(500).json({ error: 'Failed to fetch league data' });
  }
});

// Cron job: fetch and save new matches every 10 minutes
const task = cron.schedule('*/10 * * * *', async () => {
  console.log(`[${new Date().toISOString()}] Auto update starting...`);
  try {
    const matches = await fetchMatchesForClubs();
    await saveNewMatches(matches);
    console.log(`[${new Date().toISOString()}] Auto update done.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Auto update failed:`, error.message);
  }
});

// Start server and do initial data sync
app.listen(PORT, () => {
  console.log(`[${new Date().toISOString()}] Server running at http://localhost:${PORT}`);
  (async () => {
    try {
      console.log(`[${new Date().toISOString()}] Initial match sync...`);
      const matches = await fetchMatchesForClubs();
      await saveNewMatches(matches);
      console.log(`[${new Date().toISOString()}] Initial sync complete.`);
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Initial sync error:`, error.message);
    }
  })();
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log(`[${new Date().toISOString()}] Gracefully shutting down...`);
  task.stop();
  process.exit();
});
process.on('SIGTERM', () => {
  console.log(`[${new Date().toISOString()}] Gracefully shutting down...`);
  task.stop();
  process.exit();
});
