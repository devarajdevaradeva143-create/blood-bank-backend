// backend/src/services/email.service.js
// Free Email OTP via Gmail SMTP (Nodemailer) — donor forgot + register ku.
// Env (Render dashboard / local .env — never commit secrets):
//   EMAIL_USER=you@gmail.com (Gmail address, 2-step ON)
//   EMAIL_PASS=xxxx xxxx xxxx xxxx (Gmail App Password, 16 letters)
//   EMAIL_FROM=Life Saver <you@gmail.com> (optional display name)
// No DLT / paid gateway needed. Gmail ~500 mails/day — donor reset/register ku podhum.
// NOTE: Supabase Email OTP ippo pause (SUPABASE-PENDING) — backend Gmail dhaan primary.
import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

let transporter = null;

export function isEmailConfigured() {
  return Boolean(
    String(config.email?.user || '').trim() && String(config.email?.pass || '').trim()
  );
}

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: String(config.email?.user || '').trim(),
      pass: String(config.email?.pass || '').replace(/\s+/g, ''),
    },
  });
  return transporter;
}

/**
 * Generic email sender. Best-effort — caller decides 502 vs silent.
 * @param {{to:string, subject:string, text:string, html?:string}} args
 */
export async function sendEmail({ to, subject, text, html }) {
  const toAddr = String(to || '').trim();
  if (!toAddr) throw new Error('Missing email recipient');
  if (!isEmailConfigured()) throw new Error('Missing EMAIL_USER / EMAIL_PASS');
  const from =
    String(config.email?.from || '').trim() ||
    `Life Saver <${String(config.email?.user || '').trim()}>`;
  await getTransporter().sendMail({ from, to: toAddr, subject, text, html });
  if (config.env !== 'production') console.log(`[EMAIL] ${toAddr} -> ${subject}`);
  return { ok: true };
}

/** Donor password-reset OTP mail — subject + body fixed for consistency. */
export async function sendDonorOtpEmail(email, code) {
  const ttl = Number(config.otp?.ttlMinutes || 5);
  const subject = 'Life Saver — Password Reset OTP';
  const text = `Your Life Saver OTP is: ${code}\nValid ${ttl} mins. Share pannadha.\nYaaravadhu neenga illa-na ignore pannunga.`;
  const html =
    `<p>Your Life Saver OTP is: <b style="font-size:20px;letter-spacing:4px">${code}</b></p>` +
    `<p>Valid ${ttl} mins. Share pannadha.</p>`;
  return sendEmail({ to: email, subject, text, html });
}

/** Donor registration OTP mail — backend primary (Supabase pause). */
export async function sendRegisterOtpEmail(email, code) {
  const ttl = Number(config.otp?.ttlMinutes || 5);
  const subject = 'Life Saver — Registration OTP';
  const text = `Your Life Saver registration OTP is: ${code}\nValid ${ttl} mins. Share pannadha.`;
  const html =
    `<p>Your Life Saver registration OTP is: <b style="font-size:20px;letter-spacing:4px">${code}</b></p>` +
    `<p>Valid ${ttl} mins. Share pannadha.</p>`;
  return sendEmail({ to: email, subject, text, html });
}

export default { sendEmail, sendDonorOtpEmail, sendRegisterOtpEmail, isEmailConfigured };
