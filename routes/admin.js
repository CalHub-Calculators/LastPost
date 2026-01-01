const express = require('express');
const router = express.Router();

const { User, Post, Category, Subscriber, Contact, HeroSlide } = require('../lib/db');
const { isAuthenticated } = require('../middleware/auth');
const { sendNewPostEmail } = require('../lib/mailer');

/* ========== AUTH ========== */

// Login GET
router.get('/login', (req, res) => {
  res.render('auth/login', { error: req.query.error });
});

// Login POST
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username }).lean();
    if (user && user.password === password) {
      req.session.userId = user._id.toString();
      return res.redirect('/developer');
    }
    res.redirect('/developer/login?error=1');
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/developer/login?error=1');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/developer/login');
  });
});

/* ========== DASHBOARD ========== */

router.get('/', isAuthenticated, async (req, res, next) => {
  try {
    const search = (req.query.q || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    const [posts, statsAgg, topPosts] = await Promise.all([
      Post.find(filter)
        .populate('category')
        .sort({ created_at: -1 })
        .lean(),

      Post.aggregate([
        {
          $group: {
            _id: null,
            total_posts: { $sum: 1 },
            total_views: { $sum: '$views_count' }
          }
        }
      ]),

      Post.find({})
        .sort({ views_count: -1, created_at: -1 })
        .limit(10)
        .lean()
    ]);

    const statsDoc = statsAgg[0] || { total_posts: 0, total_views: 0 };

    res.render('admin/dashboard', {
      posts: posts.map(p => ({
        ...p,
        id: p._id.toString(), // convenience for EJS
        category_name: p.category ? p.category.name : 'Uncategorized'
      })),
      stats: {
        totalPosts: statsDoc.total_posts || 0,
        totalViews: statsDoc.total_views || 0,
        topPosts: topPosts.map(p => ({
          id: p._id.toString(),
          title: p.title,
          slug: p.slug,
          views_count: p.views_count || 0
        }))
      },
      search
    });
  } catch (err) {
    next(err);
  }
});

// Analytics data for chart (AJAX)
router.get('/analytics/data', isAuthenticated, async (req, res, next) => {
  try {
    const [statsAgg, topPosts] = await Promise.all([
      Post.aggregate([
        {
          $group: {
            _id: null,
            total_posts: { $sum: 1 },
            total_views: { $sum: '$views_count' }
          }
        }
      ]),
      Post.find({})
        .sort({ views_count: -1, created_at: -1 })
        .limit(10)
        .lean()
    ]);

    const statsDoc = statsAgg[0] || { total_posts: 0, total_views: 0 };

    res.json({
      totalPosts: statsDoc.total_posts || 0,
      totalViews: statsDoc.total_views || 0,
      topPosts: topPosts.map(p => ({
        id: p._id.toString(),
        title: p.title,
        slug: p.slug,
        views_count: p.views_count || 0
      }))
    });
  } catch (err) {
    next(err);
  }
});

/* ========== POSTS (CRUD) ========== */

// New / Edit Post page
router.get('/post/new', isAuthenticated, async (req, res, next) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    let post = null;

    if (req.query.id) {
      post = await Post.findById(req.query.id).lean();
    }

    res.render('admin/editor', { post, categories });
  } catch (err) {
    next(err);
  }
});

// Save Post
router.post('/post/save', isAuthenticated, async (req, res, next) => {
  try {
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

    const slug = title
      .toLowerCase()
      .trim()
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');

    const data = {
      title,
      slug,
      content,
      image_url,
      affiliate_image_url,
      affiliate_link_url,
      promo_image_url,
      promo_video_url,
      promo_link_url,
      affiliate_enabled: !!affiliate_enabled,
      promo_enabled: !!promo_enabled,
      adsterra_enabled: !!adsterra_enabled,
      ad_top_code,
      ad_middle_code,
      ad_left_code,
      ad_right_code
    };

    if (category_id) data.category = category_id;

    const isNew = !id;
    let savedPost;

    if (id) {
      savedPost = await Post.findByIdAndUpdate(id, data, { new: true });
    } else {
      savedPost = await Post.create(data);
    }

    // send emails only for new posts
    if (isNew && savedPost) {
      try {
        const subs = await Subscriber.find({ is_active: true }).lean();
        for (const sub of subs) {
          sendNewPostEmail({ to: sub.email, post: savedPost }).catch(err =>
            console.error('Email send failed to', sub.email, ':', err.message)
          );
        }
      } catch (e) {
        console.error('Subscriber email loop failed:', e);
      }
    }

    res.redirect('/developer');
  } catch (err) {
    next(err);
  }
});

// Delete Post
router.get('/post/delete/:id', isAuthenticated, async (req, res, next) => {
  try {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect('/developer');
  } catch (err) {
    next(err);
  }
});

/* ========== SUBSCRIBERS ========== */

router.get('/subscribers', isAuthenticated, async (req, res, next) => {
  try {
    const search = (req.query.q || '').trim();
    const status = (req.query.status || '').trim(); // 'active', 'blocked', or ''

    const filter = {};
    if (search) {
      filter.email = { $regex: search, $options: 'i' };
    }
    if (status === 'active') filter.is_active = true;
    if (status === 'blocked') filter.is_active = false;

    const [subs, statsAgg] = await Promise.all([
      Subscriber.find(filter).sort({ created_at: -1 }).lean(),
      Subscriber.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            active: { $sum: { $cond: [{ $eq: ['$is_active', true] }, 1, 0] } },
            blocked: { $sum: { $cond: [{ $eq: ['$is_active', false] }, 1, 0] } }
          }
        }
      ])
    ]);

    const statsDoc = statsAgg[0] || { total: 0, active: 0, blocked: 0 };

    res.render('admin/subscribers', {
      subscribers: subs.map(s => ({ ...s, id: s._id.toString() })),
      stats: {
        total: statsDoc.total || 0,
        active: statsDoc.active || 0,
        blocked: statsDoc.blocked || 0
      },
      search,
      status
    });
  } catch (err) {
    next(err);
  }
});

// Block / unblock subscriber
router.post('/subscribers/toggle/:id', isAuthenticated, async (req, res, next) => {
  try {
    const sub = await Subscriber.findById(req.params.id);
    if (!sub) return res.redirect('/developer/subscribers');

    sub.is_active = !sub.is_active;
    await sub.save();

    res.redirect('/developer/subscribers');
  } catch (err) {
    next(err);
  }
});

// Delete subscriber
router.post('/subscribers/delete/:id', isAuthenticated, async (req, res, next) => {
  try {
    await Subscriber.findByIdAndDelete(req.params.id);
    res.redirect('/developer/subscribers');
  } catch (err) {
    next(err);
  }
});

/* ========== CONTACTS ========== */

router.get('/contacts', isAuthenticated, async (req, res, next) => {
  try {
    const search = (req.query.q || '').trim();

    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { message: { $regex: search, $options: 'i' } }
      ];
    }

    const [contacts, total] = await Promise.all([
      Contact.find(filter).sort({ created_at: -1 }).lean(),
      Contact.countDocuments()
    ]);

    res.render('admin/contacts', {
      contacts: contacts.map(c => ({ ...c, id: c._id.toString() })),
      stats: { total },
      search
    });
  } catch (err) {
    next(err);
  }
});

router.post('/contacts/delete/:id', isAuthenticated, async (req, res, next) => {
  try {
    await Contact.findByIdAndDelete(req.params.id);
    res.redirect('/developer/contacts');
  } catch (err) {
    next(err);
  }
});

/* ========== HERO SLIDES ========== */

router.get('/heroes', isAuthenticated, async (req, res, next) => {
  try {
    const slides = await HeroSlide.find({})
      .sort({ sort_order: 1, created_at: -1 })
      .lean();

    res.render('admin/heroes', {
      slides: slides.map(s => ({ ...s, id: s._id.toString() }))
    });
  } catch (err) {
    next(err);
  }
});

// New slide form
router.get('/heroes/edit', isAuthenticated, (req, res) => {
  const slide = null;
  res.render('admin/hero_form', { slide });
});

// Edit slide form
router.get('/heroes/edit/:id', isAuthenticated, async (req, res, next) => {
  try {
    const slide = await HeroSlide.findById(req.params.id).lean();
    res.render('admin/hero_form', { slide });
  } catch (err) {
    next(err);
  }
});

// Save slide
router.post('/heroes/save', isAuthenticated, async (req, res, next) => {
  try {
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

    const data = {
      title,
      subtitle,
      image_url,
      button_text,
      button_link,
      sort_order: sort_order ? Number(sort_order) : 0,
      is_active: !!is_active
    };

    if (id) {
      await HeroSlide.findByIdAndUpdate(id, data);
    } else {
      await HeroSlide.create(data);
    }

    res.redirect('/developer/heroes');
  } catch (err) {
    next(err);
  }
});

// Delete slide
router.post('/heroes/delete/:id', isAuthenticated, async (req, res, next) => {
  try {
    await HeroSlide.findByIdAndDelete(req.params.id);
    res.redirect('/developer/heroes');
  } catch (err) {
    next(err);
  }
});

/* ========== TEST EMAIL (optional) ========== */

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

module.exports = router;