const Database = require('better-sqlite3');
const db = new Database('LastPost.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    slug TEXT UNIQUE
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    slug TEXT UNIQUE,
    content TEXT,
    image_url TEXT,
    category_id INTEGER,

    -- affiliate
    affiliate_image_url TEXT,
    affiliate_link_url TEXT,
    affiliate_enabled INTEGER DEFAULT 1,

    -- paid promotion
    promo_image_url TEXT,
    promo_video_url TEXT,
    promo_link_url TEXT,
    promo_enabled INTEGER DEFAULT 1,

    -- Adsterra ads
    adsterra_enabled INTEGER DEFAULT 0,
    ad_top_code TEXT,
    ad_middle_code TEXT,
    ad_left_code TEXT,
    ad_right_code TEXT,

    -- analytics
    views_count INTEGER DEFAULT 0,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(category_id) REFERENCES categories(id)
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT,
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hero_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  subtitle TEXT,
  image_url TEXT,
  button_text TEXT,
  button_link TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


`);

// Seed Admin User + default categories
const adminExists = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run('RahulAdmin', 'RahulAdmin#@123');

  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Technology', 'technology');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Lifestyle', 'lifestyle');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Health and Fitness', 'health and fitness');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Food and Recipes', 'food and recipes');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Personal Finance and Investing', 'personal finance and investing');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Travel', 'travel');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Business and Marketing', 'business and marketing');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Gaming / eSports', 'gaming / e-sports');
  db.prepare('INSERT INTO categories (name, slug) VALUES (?, ?)').run('Education', 'education');
}

module.exports = db;