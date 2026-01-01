// routes/public.js
const express = require('express');
const router = express.Router();
const db = require('../lib/db');

// Home page with search, category filter, pagination
router.get('/', (req, res) => {
  const page = parseInt(req.query.page, 10) || 1;
  const perPage = 6;
  const search = (req.query.q || '').trim();
  const categorySlug = (req.query.category || '').trim() || null;

  const where = [];
  const params = [];

  if (search) {
    where.push('(posts.title LIKE ? OR posts.content LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (categorySlug) {
    where.push('categories.slug = ?');
    params.push(categorySlug);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const countRow = db.prepare(`
    SELECT COUNT(*) AS count
    FROM posts
    JOIN categories ON posts.category_id = categories.id
    ${whereClause}
  `).get(...params);

  const totalPosts = countRow.count;
  const totalPages = Math.max(1, Math.ceil(totalPosts / perPage));
  const offset = (page - 1) * perPage;

  const posts = db.prepare(`
    SELECT posts.*, categories.name AS category_name, categories.slug AS category_slug
    FROM posts
    JOIN categories ON posts.category_id = categories.id
    ${whereClause}
    ORDER BY posts.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, perPage, offset);

  const latestPosts = db.prepare(`
    SELECT posts.*, categories.name AS category_name
    FROM posts
    JOIN categories ON posts.category_id = categories.id
    ORDER BY posts.created_at DESC
    LIMIT 5
  `).all();

  const categories = db.prepare('SELECT * FROM categories ORDER BY name ASC').all();

  const heroSlides = db.prepare(`
  SELECT *
  FROM hero_slides
  WHERE is_active = 1
  ORDER BY sort_order ASC, created_at DESC
`).all();


 res.render('public/index', {
  posts,
  latestPosts,
  categories,
  page,
  totalPages,
  search,
  categorySlug,
  query: req.query,
  heroSlides
});

});

// Single Post Page
router.get('/post/:slug', (req, res) => {
  const post = db.prepare(`
    SELECT posts.*, categories.name as category_name
    FROM posts
    JOIN categories ON posts.category_id = categories.id
    WHERE posts.slug = ?
  `).get(req.params.slug);

  if (!post) return res.status(404).send('Post not found');

  // Increment views
  db.prepare(`
    UPDATE posts
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = ?
  `).run(post.id);

  res.render('public/post', { post });
});

// About page
router.get('/about', (req, res) => {
  res.render('public/about', { pageTitle: 'About | FirstPost Journal', query: req.query });
});

// Contact page
router.get('/contact', (req, res) => {
  res.render('public/contact', {
    pageTitle: 'Contact | FirstPost Journal',
    query: req.query
  });
});

//Legal Pages

router.get('/privacy-policy', (req, res) => {
  res.render('public/privacy-policy', { pageTitle: 'privacy-policy', query: req.query });
});

router.get('/term-and-condition', (req, res) => {
  res.render('public/term-and-condition', { pageTitle: 'term-and-condition', query: req.query });
});

router.get('/disclaimer', (req, res) => {
  res.render('public/disclaimer', { pageTitle: 'disclaimer', query: req.query });
});


router.post('/contact', (req, res) => {
  const { name, email, message } = req.body;

  if (!name || !email || !message) {
    // basic fallback – just reload without saving
    return res.redirect('/contact');
  }

  try {
    db.prepare(`
      INSERT INTO contacts (name, email, message)
      VALUES (?, ?, ?)
    `).run(name.trim(), email.trim(), message.trim());
  } catch (e) {
    console.error('Contact save error:', e);
  }

  res.redirect('/contact?sent=1');
});



// Subscribe endpoint
router.post('/subscribe', (req, res) => {
  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.redirect(req.get('referer') || '/');

  try {
    const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(email);
    if (existing) {
      db.prepare('UPDATE subscribers SET is_active = 1 WHERE email = ?').run(email);
    } else {
      db.prepare('INSERT INTO subscribers (email, is_active) VALUES (?, 1)').run(email);
    }
  } catch (e) {
    console.error('Subscribe error:', e);
  }

  const back = req.get('referer') || '/';
  const sep = back.includes('?') ? '&' : '?';
  res.redirect(back + sep + 'subscribed=1');
});

module.exports = router;