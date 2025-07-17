const express = require('express');
const fetch = require('node-fetch'); // version 2
const path = require('path');
const app = express();
const PORT = 3000;

app.use(express.static(__dirname)); // serves index.html

// Dynamic API route
app.get('/api/players', async (req, res) => {
  try {
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998');
    if (!response.ok) return res.status(response.status).send('EA API error');
    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Error fetching EA API:', err);
    res.status(500).send('Server error fetching data');
  }
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
