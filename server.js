require('dotenv').config();
const { connectAndSeed } = require('./lib/db');
const app = require('./api'); // this is the exported handler

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    await connectAndSeed();
    // For dev we need a true server; wrap app(req,res) in a small handler
    const http = require('http');
    const server = http.createServer((req, res) => app(req, res));
    server.listen(PORT, () => {
      console.log(`LastPost running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start app:', err);
    process.exit(1);
  }
})();