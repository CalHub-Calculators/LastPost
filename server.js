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
/*
require('dotenv').config();
const { connectAndSeed } = require('./lib/db');
const app = require('./api/index'); // your express app export

let isReady = false;

module.exports = async (req, res) => {
  try {
    if (!isReady) {
      await connectAndSeed();
      isReady = true;
      console.log('✅ DB connected & seeded (cold start)');
    }

    return app(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};*/
