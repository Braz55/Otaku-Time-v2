import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const host = process.env.SMTP_HOST;
    const port = process.env.SMTP_PORT;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (host && port && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: parseInt(port, 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user, pass },
      });
      this.logger.log('SMTP transporter initialized successfully.');
    } else {
      this.logger.warn('SMTP environment variables are missing. Email notifications will be disabled.');
    }
  }

  async sendEmail(to: string, subject: string, text: string, html?: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`Transporter not initialized. Cannot send email to ${to}`);
      return false;
    }

    try {
      const from = process.env.SMTP_FROM || '"Otaku Time" <noreply@otakutime.com>';
      await this.transporter.sendMail({
        from,
        to,
        subject,
        text,
        html,
      });
      this.logger.log(`Email sent successfully to ${to}`);
      return true;
    } catch (error: any) {
      this.logger.error(`Error sending email to ${to}: ${error.message}`, error.stack);
      return false;
    }
  }
}
