const express = require('express');
const session = require('express-session');
const path = require('path');
const app = express();

app.set('view engine', 'ejs');
const db = require('./lib/db');

app.use((req, res, next) => {
    try {
        const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();
        res.locals.categories = categories;
    } catch (e) {
        res.locals.categories = [];
    }
    res.locals.currentPath = req.path;
    next();
});
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'firstpost-secret-key',
    resave: false,
    saveUninitialized: false
}));


// Routes
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/developer', adminRoutes);

module.exports = app; // For Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`FirstPost running on http://localhost:${PORT}`));