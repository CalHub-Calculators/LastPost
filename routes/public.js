// routes/public.js
const express = require('express');
const router = express.Router();

// Import Mongoose models from lib/db (your Mongo layer)
const {
  Post,
  Category,
  HeroSlide,
  Subscriber,
  Contact
} = require('../lib/db');

// Home page with search, category filter, pagination
router.get('/', async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const perPage = 6;
    const search = (req.query.q || '').trim();
    const categorySlug = (req.query.category || '').trim() || null;

    const filter = {};

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } }
      ];
    }

    if (categorySlug) {
      const cat = await Category.findOne({ slug: categorySlug }).lean();
      if (cat) {
        filter.category = cat._id;
      } else {
        filter.category = null; // ensures no posts match
      }
    }

    const totalPosts = await Post.countDocuments(filter);
    const totalPages = Math.max(1, Math.ceil(totalPosts / perPage));

    const [posts, latestPosts, categories, heroSlides] = await Promise.all([
      Post.find(filter)
        .populate('category')
        .sort({ created_at: -1 })
        .skip((page - 1) * perPage)
        .limit(perPage)
        .lean(),

      Post.find({})
        .populate('category')
        .sort({ created_at: -1 })
        .limit(5)
        .lean(),

      Category.find({}).sort({ name: 1 }).lean(),

      HeroSlide.find({ is_active: true })
        .sort({ sort_order: 1, created_at: -1 })
        .lean()
    ]);

    res.render('public/index', {
      posts: posts.map(p => ({
        ...p,
        category_name: p.category ? p.category.name : 'Uncategorized',
        category_slug: p.category ? p.category.slug : ''
      })),
      latestPosts: latestPosts.map(p => ({
        ...p,
        category_name: p.category ? p.category.name : 'Uncategorized'
      })),
      categories,
      page,
      totalPages,
      search,
      categorySlug,
      query: req.query,
      heroSlides
    });
  } catch (err) {
    next(err);
  }
});

// Single Post Page
router.get('/post/:slug', async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate('category')
      .lean();

    if (!post) return res.status(404).send('Post not found');

    // Increment views
    await Post.updateOne({ _id: post._id }, { $inc: { views_count: 1 } });

    res.render('public/post', {
      post: {
        ...post,
        category_name: post.category ? post.category.name : 'Uncategorized'
      }
    });
  } catch (err) {
    next(err);
  }
});

// About page
router.get('/about', (req, res) => {
  res.render('public/about', {
    pageTitle: 'About | FirstPost Journal',
    query: req.query
  });
});

// Contact page (GET)
router.get('/contact', (req, res) => {
  res.render('public/contact', {
    pageTitle: 'Contact | FirstPost Journal',
    query: req.query
  });
});

// Legal pages
router.get('/privacy-policy', (req, res) => {
  res.render('public/privacy-policy', {
    pageTitle: 'privacy-policy',
    query: req.query
  });
});

router.get('/term-and-condition', (req, res) => {
  res.render('public/term-and-condition', {
    pageTitle: 'term-and-condition',
    query: req.query
  });
});

router.get('/disclaimer', (req, res) => {
  res.render('public/disclaimer', {
    pageTitle: 'disclaimer',
    query: req.query
  });
});

// Contact form (POST) – save message in Mongo
router.post('/contact', async (req, res, next) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.redirect('/contact');
    }

    await Contact.create({
      name: name.trim(),
      email: email.trim(),
      message: message.trim()
    });

    res.redirect('/contact?sent=1');
  } catch (e) {
    console.error('Contact save error:', e);
    next(e);
  }
});

// Subscribe endpoint
router.post('/subscribe', async (req, res, next) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    if (!email) return res.redirect(req.get('referer') || '/');

    const existing = await Subscriber.findOne({ email });
    if (existing) {
      existing.is_active = true;
      await existing.save();
    } else {
      await Subscriber.create({ email, is_active: true });
    }

    const back = req.get('referer') || '/';
    const sep = back.includes('?') ? '&' : '?';
    res.redirect(back + sep + 'subscribed=1');
  } catch (e) {
    console.error('Subscribe error:', e);
    next(e);
  }
});

module.exports = router;