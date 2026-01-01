const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { isAuthenticated } = require('../middleware/auth');
const { sendNewPostEmail } = require('../lib/mailer');
// ...

// Login GET
router.get('/login', (req, res) => res.render('auth/login'));

// Login POST
router.post('/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (user && user.password === password) {
        req.session.userId = user.id;
        return res.redirect('/developer');
    }
    res.redirect('/developer/login?error=1');
});

// Dashboard with search + analytics
router.get('/', isAuthenticated, (req, res) => {
    const search = (req.query.q || '').trim();

    const where = [];
    const params = [];

    if (search) {
        where.push('(posts.title LIKE ? OR posts.slug LIKE ?)');
        params.push(`%${search}%`, `%${search}%`);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const posts = db.prepare(`
        SELECT posts.*, categories.name AS category_name
        FROM posts
        JOIN categories ON posts.category_id = categories.id
        ${whereClause}
        ORDER BY posts.created_at DESC
    `).all(...params);

    const statsRow = db.prepare(`
        SELECT
            COUNT(*) AS total_posts,
            COALESCE(SUM(views_count), 0) AS total_views
        FROM posts
    `).get();

    const topPosts = db.prepare(`
        SELECT id, title, slug, COALESCE(views_count, 0) AS views_count
        FROM posts
        ORDER BY views_count DESC, created_at DESC
        LIMIT 10
    `).all();

    res.render('admin/dashboard', {
        posts,
        stats: {
            totalPosts: statsRow.total_posts,
            totalViews: statsRow.total_views,
            topPosts
        },
        search
    });
});

// Analytics data for chart (AJAX)
router.get('/analytics/data', isAuthenticated, (req, res) => {
    const statsRow = db.prepare(`
        SELECT
            COUNT(*) AS total_posts,
            COALESCE(SUM(views_count), 0) AS total_views
        FROM posts
    `).get();

    const topPosts = db.prepare(`
        SELECT id, title, slug, COALESCE(views_count, 0) AS views_count
        FROM posts
        ORDER BY views_count DESC, created_at DESC
        LIMIT 10
    `).all();

    res.json({
        totalPosts: statsRow.total_posts,
        totalViews: statsRow.total_views,
        topPosts
    });
});

// Create Post Page
// Create / Edit Post Page
router.get('/post/new', isAuthenticated, (req, res) => {
    const categories = db.prepare('SELECT * FROM categories').all();

    let post = null;
    if (req.query.id) {
        post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.query.id);
    }

    res.render('admin/editor', { post, categories });
});

router.get('/login', (req, res) => {
    res.render('auth/login'); // Express looks in views/ + auth/login.ejs
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/developer/login');
});

// Save Post
router.post('/post/save', isAuthenticated, (req, res) => {
    const {
        id,
        title,
        content,
        category_id,
        image_url,
        affiliate_image_url,
        affiliate_link_url,
        promo_image_url,
        promo_video_url,
        promo_link_url,
        affiliate_enabled,
        promo_enabled,
        adsterra_enabled,
        ad_top_code,
        ad_middle_code,
        ad_left_code,
        ad_right_code
    } = req.body;

    const slug = title.toLowerCase()
        .trim()
        .replace(/ /g, '-')
        .replace(/[^\w-]+/g, '');

    const affiliateEnabledVal = affiliate_enabled ? 1 : 0;
    const promoEnabledVal = promo_enabled ? 1 : 0;
    const adsterraEnabledVal = adsterra_enabled ? 1 : 0;

    const isNew = !id;   // <-- flag
    let savedPostId = id;

  if (id) {
    // UPDATE query here...
  } else {
    const result = db.prepare(`
      INSERT INTO posts (
        title, slug, content, category_id, image_url,
        affiliate_image_url, affiliate_link_url,
        promo_image_url, promo_video_url, promo_link_url,
        affiliate_enabled, promo_enabled,
        adsterra_enabled, ad_top_code, ad_middle_code, ad_left_code, ad_right_code
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      slug,
      content,
      category_id,
      image_url,
      affiliate_image_url,
      affiliate_link_url,
      promo_image_url,
      promo_video_url,
      promo_link_url,
      affiliateEnabledVal,
      promoEnabledVal,
      adsterraEnabledVal,
      ad_top_code,
      ad_middle_code,
      ad_left_code,
      ad_right_code
    );
    savedPostId = result.lastInsertRowid;
  }

  // Send email notifications for new posts only
  if (isNew) {
    try {
      const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(savedPostId);
      const activeSubs = db.prepare('SELECT email FROM subscribers WHERE is_active = 1').all();

      for (const sub of activeSubs) {
        // Fire and forget; in production you’d queue this
        sendNewPostEmail({ to: sub.email, post }).catch(err =>
          console.error('Email to', sub.email, 'failed:', err.message)
        );
      }
    } catch (e) {
      console.error('Sending subscriber emails failed:', e);
    }
  }

  res.redirect('/developer');
});


// Subscribers list / management
router.get('/subscribers', isAuthenticated, (req, res) => {
  const search = (req.query.q || '').trim();
  const status = (req.query.status || '').trim(); // 'active', 'blocked', or ''

  const where = [];
  const params = [];

  if (search) {
    where.push('email LIKE ?');
    params.push(`%${search}%`);
  }

  if (status === 'active') {
    where.push('is_active = 1');
  } else if (status === 'blocked') {
    where.push('is_active = 0');
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const subs = db.prepare(`
      SELECT *
      FROM subscribers
      ${whereClause}
      ORDER BY created_at DESC
  `).all(...params);

  const stats = db.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) AS blocked
      FROM subscribers
  `).get();

  res.render('admin/subscribers', {
    subscribers: subs,
    stats,
    search,
    status
  });
});

// Block / unblock subscriber
router.post('/subscribers/toggle/:id', isAuthenticated, (req, res) => {
  const id = req.params.id;
  const sub = db.prepare('SELECT * FROM subscribers WHERE id = ?').get(id);
  if (!sub) return res.redirect('/developer/subscribers');

  const newStatus = sub.is_active ? 0 : 1;
  db.prepare('UPDATE subscribers SET is_active = ? WHERE id = ?').run(newStatus, id);

  res.redirect('/developer/subscribers');
});

// Delete subscriber
router.post('/subscribers/delete/:id', isAuthenticated, (req, res) => {
  db.prepare('DELETE FROM subscribers WHERE id = ?').run(req.params.id);
  res.redirect('/developer/subscribers');
});

// Contacts list / management
router.get('/contacts', isAuthenticated, (req, res) => {
  const search = (req.query.q || '').trim();

  const where = [];
  const params = [];

  if (search) {
    where.push('(name LIKE ? OR email LIKE ? OR message LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const contacts = db.prepare(`
    SELECT *
    FROM contacts
    ${whereClause}
    ORDER BY created_at DESC
  `).all(...params);

  const stats = db.prepare(`
    SELECT COUNT(*) AS total
    FROM contacts
  `).get();

  res.render('admin/contacts', {
    contacts,
    stats,
    search
  });
});

// Delete a contact
router.post('/contacts/delete/:id', isAuthenticated, (req, res) => {
  db.prepare('DELETE FROM contacts WHERE id = ?').run(req.params.id);
  res.redirect('/developer/contacts');
});



// Delete Post
router.get('/post/delete/:id', isAuthenticated, (req, res) => {
    db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    res.redirect('/developer');
});



router.get('/test-email', isAuthenticated, async (req, res) => {
  try {
    await sendNewPostEmail({
      to: 'your-real-email@example.com',
      post: {
        slug: 'test-post',
        title: 'Test email from FirstPost'
      }
    });
    res.send('Test email sent. Check your inbox or Mailtrap.');
  } catch (e) {
    console.error(e);
    res.status(500).send('Failed to send test email: ' + e.message);
  }
});


// List hero slides
router.get('/heroes', isAuthenticated, (req, res) => {
  const slides = db.prepare(`
    SELECT *
    FROM hero_slides
    ORDER BY sort_order ASC, created_at DESC
  `).all();

  res.render('admin/heroes', { slides });
});

// New slide form
router.get('/heroes/edit', isAuthenticated, (req, res) => {
  const slide = null;
  res.render('admin/hero_form', { slide });
});

// Edit slide form
router.get('/heroes/edit/:id', isAuthenticated, (req, res) => {
  const slide = db.prepare('SELECT * FROM hero_slides WHERE id = ?').get(req.params.id);
  res.render('admin/hero_form', { slide });
});

// Save slide
router.post('/heroes/save', isAuthenticated, (req, res) => {
  const {
    id,
    title,
    subtitle,
    image_url,
    button_text,
    button_link,
    sort_order,
    is_active
  } = req.body;

  const activeVal = is_active ? 1 : 0;
  const orderVal = sort_order ? Number(sort_order) : 0;

  if (id) {
    db.prepare(`
      UPDATE hero_slides
      SET
        title = ?,
        subtitle = ?,
        image_url = ?,
        button_text = ?,
        button_link = ?,
        sort_order = ?,
        is_active = ?
      WHERE id = ?
    `).run(
      title,
      subtitle,
      image_url,
      button_text,
      button_link,
      orderVal,
      activeVal,
      id
    );
  } else {
    db.prepare(`
      INSERT INTO hero_slides
        (title, subtitle, image_url, button_text, button_link, sort_order, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title,
      subtitle,
      image_url,
      button_text,
      button_link,
      orderVal,
      activeVal
    );
  }

  res.redirect('/developer/heroes');
});

// Delete slide
router.post('/heroes/delete/:id', isAuthenticated, (req, res) => {
  db.prepare('DELETE FROM hero_slides WHERE id = ?').run(req.params.id);
  res.redirect('/developer/heroes');
});

module.exports = router;