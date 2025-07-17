document.addEventListener("DOMContentLoaded", () => {
  fetchPlayers();
  fetchMatches();

  const toggleButton = document.getElementById("toggle-button");
  const projectionsSection = document.getElementById("projections");
  const matchesSection = document.getElementById("match-history");

  let showingExtras = false;

  toggleButton.addEventListener("click", () => {
    showingExtras = !showingExtras;
    projectionsSection.style.display = showingExtras ? "block" : "none";
    matchesSection.style.display = showingExtras ? "block" : "none";
    toggleButton.textContent = showingExtras ? "Hide Projections & Matches" : "Show Projections & Matches";
  });
});

async function fetchPlayers() {
  try {
    const res = await fetch("/api/players");
    const players = await res.json();
    const container = document.getElementById("players");

    players.forEach(player => {
      const card = document.createElement("div");
      card.className = "player-card";
      card.innerHTML = `
        <img src="${player.image || 'https://via.placeholder.com/80'}" alt="${player.name}" />
        <div>
          <h3>${player.name}</h3>
          <p>Rating: ${player.rating}</p>
          <p>Goals: ${player.goals}</p>
          <p>Assists: ${player.assists}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Player fetch error:", err);
  }
}

async function fetchMatches() {
  try {
    const res = await fetch("/api/matches");
    const matches = await res.json();
    const container = document.getElementById("match-history");

    matches.forEach(match => {
      const card = document.createElement("div");
      card.className = "match-card";
      card.innerHTML = `
        <img src="${match.opponentImage || 'https://via.placeholder.com/80'}" alt="Opponent" />
        <div>
          <h4>${match.opponent}</h4>
          <p>Score: ${match.ourScore} - ${match.theirScore}</p>
          <p>Date: ${new Date(match.timestamp).toLocaleDateString()}</p>
        </div>
      `;
      container.appendChild(card);
    });
  } catch (err) {
    console.error("Match fetch error:", err);
  }
}
