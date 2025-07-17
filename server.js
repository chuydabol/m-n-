const express = require("express");
const fetch = require("node-fetch");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Constants for EA Pro Clubs API
const CLUB_ID = "249199"; // Replace with your actual Club ID
const PLATFORM = "common-gen5";

// Serve static files (like your HTML) from the "public" folder
app.use(express.static("public"));

// Endpoint to fetch players
app.get("/api/players", async (req, res) => {
  try {
    const response = await fetch(`https://proclubs.ea.com/api/fc/members/stats?platform=${PLATFORM}&clubId=${CLUB_ID}`);
    if (!response.ok) throw new Error("Failed to fetch players from EA API");

    const data = await response.json();
    const members = Object.values(data).map(player => ({
      name: player.name,
      proName: player.proName,
      proOverall: player.proOverall,
      favoritePosition: player.favoritePosition,
      gamesPlayed: player.gamesPlayed,
      winRate: player.winRate,
      goals: player.goals,
      assists: player.assists,
      ratingAve: player.ratingAve,
      shotSuccessRate: player.shotSuccessRate,
      passesMade: player.passesMade,
      passSuccessRate: player.passSuccessRate,
      tacklesMade: player.tacklesMade,
      tackleSuccessRate: player.tackleSuccessRate,
    }));

    res.json({ members });
  } catch (err) {
    console.error("Error in /api/players:", err.message);
    res.status(502).json({ error: "Failed to fetch player data" });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
