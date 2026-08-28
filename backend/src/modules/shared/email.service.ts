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
 * In production, uses nodemailer with SMTP if configured.
 */
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (process.env.NODE_ENV === 'production' && process.env.SMTP_HOST) {
    try {
      // Dynamic import for optional nodemailer dependency
      const nodemailer = await import('nodemailer') as any;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: process.env.SMTP_USER ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        } : undefined,
      });
      
      await transporter.sendMail({
        from: process.env.EMAIL_FROM || 'noreply@kavach.com',
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      
      logger.info(`[EMAIL] Sent to ${options.to}: ${options.subject}`);
    } catch (error) {
      logger.error(`[EMAIL] Failed to send to ${options.to}:`, error);
      throw error;
    }
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
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password#token=${resetToken}`;

  await sendEmail({
    to: email,
    subject: 'Kavach — Password Reset Request',
    html: `
      <h2>Password Reset</h2>
      <p>You requested a password reset for your Kavach account.</p>
      <p>Click the link below to reset your password. This link expires in 1 hour.</p>
      <p><a href="${resetUrl}">Reset Password</a></p>
      <p>If you didn't request this, you can safely ignore this email.</p>
    `,
    text: `Password Reset\n\nUse this link to reset your password: ${resetUrl}\n\nThis link expires in 1 hour.`,
  });
};
