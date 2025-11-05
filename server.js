const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 10000;

const distPath = path.join(__dirname, 'dist/RentEase/browser');

// Serve static files from Angular build
app.use(express.static(distPath));

// Handle Angular routing - send all requests to index.html
app.use((req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});