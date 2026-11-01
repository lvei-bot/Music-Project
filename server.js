import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Root route redirects to the primary trainer app
app.get('/', (req, res) => {
  res.redirect('/trainer');
});

// Explicit routes for trainer and practice suites
app.get('/trainer', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'trainer', 'index.html'));
});

app.get('/practice', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'practice', 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Music Projects server running at http://${HOST}:${PORT}`);
});
