require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');

const { connectAndSeed, Category } = require('./lib/db');

const app = express();

app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'firstpost-secret-key',
  resave: false,
  saveUninitialized: false
}));

// Make categories + currentPath available to views
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
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/developer', adminRoutes);

const PORT = process.env.PORT || 3000;

// Connect to Mongo then start server
connectAndSeed()
  .then(() => {
    app.listen(PORT, () => console.log(`LastPost running on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('Failed to start app:', err);
    process.exit(1);
  });

module.exports = app;