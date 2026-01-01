require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { Category, connectAndSeed } = require('../lib/db');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(process.cwd(), 'views'));   // ensure correct views path
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(process.cwd(), 'public'))); // safer for Vercel

app.use(session({
  secret: 'firstpost-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Make categories + currentPath available
app.use(async (req, res, next) => {
  try {
    const cats = await Category.find({}).sort({ name: 1 }).lean();
    res.locals.categories = cats;
  } catch (e) {
    res.locals.categories = [];
  }
  res.locals.currentPath = req.path;
  next();
});

// Routes
const publicRoutes = require('../routes/public');
const adminRoutes = require('../routes/admin');

app.use('/', publicRoutes);
app.use('/developer', adminRoutes);

// Error handler (so stack traces appear in Vercel logs)
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).send('Internal Server Error');
});

// --- Vercel handler wrapper: ensure Mongo is connected before handling requests ---
let mongoReady = false;
let mongoPromise = connectAndSeed()
  .then(() => {
    console.log('Mongo ready');
    mongoReady = true;
  })
  .catch(err => {
    console.error('Mongo connectAndSeed failed:', err);
  });

// For Vercel: export a function that waits for Mongo, then delegates to Express
module.exports = async (req, res) => {
  if (!mongoReady) {
    await mongoPromise;
  }
  return app(req, res);
};