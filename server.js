const express = require('express');
const fetch = require('node-fetch'); // version 2
const path = require('path');
const app = express();
const PORT = 80;

app.use(express.static(__dirname)); // serves index.html

// Dynamic API route
app.get('/api/players', async (req, res) => {
  console.log('Received request to /api/players');
  try {
    console.log('Fetching data from EA API...');
    const response = await fetch('https://proclubs.ea.com/api/fc/members/stats?platform=common-gen5&clubId=2491998', {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    console.log('EA API response status:', response.status);
    
    if (!response.ok) {
      console.error('EA API returned error status:', response.status);
      return res.status(response.status).json({ error: 'EA API error', status: response.status });
    }
    
    const data = await response.json();
    console.log('Successfully fetched data from EA API');
    res.json(data);
  } catch (err) {
    console.error('Error fetching EA API:', err.message);
    res.status(500).json({ error: 'Server error fetching data', details: err.message });
  }
});

// Serve index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(Server running at http://0.0.0.0:${PORT});
});
