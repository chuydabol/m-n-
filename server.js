<div id="match-history">
  <h2>Match History</h2>
  <button onclick="refreshMatches()">Refresh Matches</button>
  <table border="1" cellspacing="0" cellpadding="5" style="width:100%; max-width:600px; margin-top:10px;">
    <thead>
      <tr>
        <th>Date</th>
        <th>Opponent</th>
        <th>Score</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody id="match-table-body"></tbody>
  </table>
  <p id="status"></p>
</div>

<script>
  async function loadMatches() {
    const status = document.getElementById('status');
    status.textContent = 'Loading matches...';

    try {
      const res = await fetch('/api/matches');
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
      const matches = await res.json();

      const tbody = document.getElementById('match-table-body');
      tbody.innerHTML = '';

      matches.forEach(match => {
        const date = new Date(match.timestamp * 1000).toLocaleDateString();
        const opponent = match.opponentName || 'Unknown';
        const score = `${match.clubScore} - ${match.opponentScore}`;
        const result = match.clubScore > match.opponentScore ? 'Win' :
                       match.clubScore < match.opponentScore ? 'Loss' : 'Draw';

        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${date}</td>
          <td>${opponent}</td>
          <td>${score}</td>
          <td>${result}</td>
        `;
        tbody.appendChild(row);
      });

      status.textContent = `Loaded ${matches.length} matches.`;
    } catch (err) {
      status.textContent = `Error loading matches: ${err.message}`;
    }
  }

  async function refreshMatches() {
    const status = document.getElementById('status');
    status.textContent = 'Refreshing matches...';

    try {
      const res = await fetch('/api/matches/refresh');
      if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

      const data = await res.json();
      status.textContent = `Refreshed ${data.count} matches. Reloading...`;
      await loadMatches();
    } catch (err) {
      status.textContent = `Error refreshing matches: ${err.message}`;
    }
  }

  // Load matches when page loads
  loadMatches();
</script>
