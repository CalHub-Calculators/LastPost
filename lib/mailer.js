const nodemailer = require('nodemailer');

let transporter = null;

function isEmailEnabled() {
  return process.env.EMAIL_ENABLED === 'true';
}

function getTransporter() {
  if (!isEmailEnabled()) {
    return null; // 🔕 email disabled
  }

  if (transporter) return transporter;

  if (
    !process.env.SMTP_HOST ||
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASS
  ) {
    console.warn('⚠️ SMTP vars missing – email skipped');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return transporter;
}

async function sendNewPostEmail({ to, post }) {
  const t = getTransporter();
  if (!t) return; // 👈 silently ignore

  const url = `${process.env.APP_URL}/post/${post.slug}`;

  try {
    await t.sendMail({
      from: process.env.FROM_EMAIL,
      to,
      subject: `New post on FirstPost: ${post.title}`,
      html: `
        <h2>${post.title}</h2>
        <p>A new article is live on FirstPost Journal.</p>
        <p><a href="${url}">Read it now</a></p>
      `
    });
  } catch (err) {
    // 🚨 DO NOT crash app
    console.error('Email failed (ignored):', err.message);
  }
}

module.exports = { sendNewPostEmail };
