const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Dummy player stats for frontend to work
app.get('/api/players', (req, res) => {
  res.json({
    members: [
      {
        name: "ChuyLeal133",
        proName: "Lealinho",
        proOverall: 89,
        favoritePosition: "Forward",
        gamesPlayed: 50,
        winRate: 60,
        goals: 30,
        assists: 15,
        ratingAve: 8.2,
        shotSuccessRate: 70,
        passesMade: 300,
        passSuccessRate: 85,
        tacklesMade: 10,
        tackleSuccessRate: 65
      },
      {
        name: "therealmandem7",
        proName: "Hakimi",
        proOverall: 88,
        favoritePosition: "Defender",
        gamesPlayed: 50,
        winRate: 55,
        goals: 5,
        assists: 8,
        ratingAve: 7.5,
        shotSuccessRate: 50,
        passesMade: 250,
        passSuccessRate: 80,
        tacklesMade: 40,
        tackleSuccessRate: 75
      }
    ]
  });
});

// Dummy match history
app.get('/api/matches', (req, res) => {
  res.json([
    {
      matchId: 1,
      clubName: "Royal Republic FC",
      result: "W",
      score: "3-1"
    }
  ]);
});

// Serve index.html for everything else
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
