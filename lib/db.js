// lib/mongo.js
const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI;

// ---- SCHEMAS ----
const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, index: true },
  password: String
}, { timestamps: true });

const categorySchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true, index: true }
}, { timestamps: true });

const postSchema = new mongoose.Schema({
  title: String,
  slug: { type: String, unique: true, index: true },
  content: String,
  image_url: String,
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },

  // affiliate
  affiliate_image_url: String,
  affiliate_link_url: String,
  affiliate_enabled: { type: Boolean, default: true },

  // paid promotion
  promo_image_url: String,
  promo_video_url: String,
  promo_link_url: String,
  promo_enabled: { type: Boolean, default: true },

  // Adsterra
  adsterra_enabled: { type: Boolean, default: false },
  ad_top_code: String,
  ad_middle_code: String,
  ad_left_code: String,
  ad_right_code: String,

  // analytics
  views_count: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const subscriberSchema = new mongoose.Schema({
  email: { type: String, unique: true },
  is_active: { type: Boolean, default: true }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const contactSchema = new mongoose.Schema({
  name: String,
  email: String,
  message: String
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const heroSlideSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  image_url: String,
  button_text: String,
  button_link: String,
  is_active: { type: Boolean, default: true },
  sort_order: { type: Number, default: 0 }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

// ---- MODELS ----
const User = mongoose.model('User', userSchema);
const Category = mongoose.model('Category', categorySchema);
const Post = mongoose.model('Post', postSchema);
const Subscriber = mongoose.model('Subscriber', subscriberSchema);
const Contact = mongoose.model('Contact', contactSchema);
const HeroSlide = mongoose.model('HeroSlide', heroSlideSchema);

// ---- CONNECTION + SEED ----
async function connectAndSeed() {
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI is not set in .env');
  }

  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Seed admin user
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  const existingAdmin = await User.findOne({ username: adminUsername });
  if (!existingAdmin) {
    await User.create({ username: adminUsername, password: adminPassword });
    console.log(`Seeded admin user: ${adminUsername}`);
  }

  // Seed categories if none
  const categoryCount = await Category.countDocuments();
  if (categoryCount === 0) {
    const defaultCategories = [
      { name: 'Technology', slug: 'technology' },
      { name: 'Lifestyle', slug: 'lifestyle' },
      { name: 'Health and Fitness', slug: 'health-and-fitness' },
      { name: 'Food and Recipes', slug: 'food-and-recipes' },
      { name: 'Personal Finance and Investing', slug: 'personal-finance-and-investing' },
      { name: 'Travel', slug: 'travel' },
      { name: 'Business and Marketing', slug: 'business-and-marketing' },
      { name: 'Gaming / eSports', slug: 'gaming-esports' },
      { name: 'Education', slug: 'education' }
    ];

    await Category.insertMany(defaultCategories);
    console.log('Seeded default categories');
  }

  // Seed one default hero slide if none
  const heroCount = await HeroSlide.countDocuments();
  if (heroCount === 0) {
    await HeroSlide.create({
      title: 'LastPost Journal',
      subtitle: 'Premium insights and stories from our expert developers.',
      image_url: 'https://via.placeholder.com/1600x500?text=LastPost+Hero',
      button_text: 'Read latest posts',
      button_link: '/',
      sort_order: 0,
      is_active: true
    });
    console.log('Seeded default hero slide');
  }
}

module.exports = {
  connectAndSeed,
  User,
  Category,
  Post,
  Subscriber,
  Contact,
  HeroSlide
};