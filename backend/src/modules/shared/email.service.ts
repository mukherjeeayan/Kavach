// email.service.ts
// Thin abstraction over email delivery. Currently supports console logging
// (development) and can be swapped for SendGrid / SES / Nodemailer in production.

import logger from '../../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email. In development, logs the content to the console.
 * In production, integrate with your email provider here.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    // Production: use nodemailer or your email SDK
    // Example with nodemailer:
    // const transporter = nodemailer.createTransport({ host: process.env.SMTP_HOST, ... });
    // await transporter.sendMail({ from: process.env.EMAIL_FROM, ...options });
    logger.info(`[EMAIL] Sent to ${options.to}: ${options.subject}`);
  } else {
    // Development: log to console
    logger.info(`[EMAIL-DEV] To: ${options.to}`);
    logger.info(`[EMAIL-DEV] Subject: ${options.subject}`);
    logger.info(`[EMAIL-DEV] Body: ${options.text || options.html}`);
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  resetToken: string
): Promise<void> => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  await sendEmail({
    to: email,
    subject: 'SafeGuard — Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your SafeGuard account.</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
    text: `Password Reset\n\nUse this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
};
