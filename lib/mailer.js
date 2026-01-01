require('dotenv').config();

// lib/mailer.js
const nodemailer = require('nodemailer');

const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Optional: verify on startup
transport.verify((err, success) => {
  if (err) {
    console.error('SMTP connection error:', err.message);
  } else {
    console.log('SMTP server is ready to take our messages');
  }
});

async function sendNewPostEmail({ to, post }) {
  const url = `${process.env.APP_URL || 'http://localhost:3000'}/post/${post.slug}`;

  try {
    const info = await transport.sendMail({
      from: process.env.FROM_EMAIL || '"FirstPost" <no-reply@firstpost.local>',
      to,
      subject: `New post on FirstPost: ${post.title}`,
      html: `
        <h2>${post.title}</h2>
        <p>A new article is live on FirstPost Journal.</p>
        <p><a href="${url}">Read it now</a></p>
      `
    });

    console.log('Email sent to', to, '=>', info.messageId);
  } catch (err) {
    console.error('sendNewPostEmail failed for', to, ':', err.message);
    throw err;
  }
}

module.exports = { sendNewPostEmail };