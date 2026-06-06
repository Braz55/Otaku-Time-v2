import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;
  private readonly logger = new Logger(EmailService.name);

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.resend.com',
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || 'resend',
        pass: process.env.SMTP_PASS || '',
      },
    });
  }

  async sendVerificationEmail(to: string, token: string): Promise<boolean> {
    const backendUrl = process.env.BACKEND_URL || 'https://four7960897.onrender.com';
    const verifyLink = `${backendUrl}/auth/verify?token=${token}`;

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Otaku-Time" <noreply@otakutime.com>',
      to,
      subject: 'Verifica a tua conta Otaku-Time',
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #1a1c23; color: #e2e8f0;">
          <h2 style="color: #c2185b; text-align: center;">Bem-vindo ao Otaku-Time!</h2>
          <p style="font-size: 16px; line-height: 1.5; color: #e2e8f0;">Obrigado por te registares na nossa plataforma. Para ativares a tua conta e começares a acompanhar os teus animes e mangás favoritos, clica no botão abaixo:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verifyLink}" style="background-color: #c2185b; color: white; padding: 12px 24px; text-decoration: none; font-weight: bold; border-radius: 8px; font-size: 16px; display: inline-block; box-shadow: 0 4px 12px rgba(194,24,91,0.3);">Verificar Email</a>
          </div>
          <p style="font-size: 14px; color: #a0aec0; line-height: 1.5;">Se o botão não funcionar, copia e cola o seguinte link no teu navegador:</p>
          <p style="font-size: 12px; color: #c2185b; word-break: break-all;">${verifyLink}</p>
          <hr style="border: 0; border-top: 1px solid #4a5568; margin: 20px 0;" />
          <p style="font-size: 12px; text-align: center; color: #718096;">Este link expira em 24 horas.</p>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
      this.logger.log(`Email de verificação enviado com sucesso para ${to}`);
      return true;
    } catch (error) {
      this.logger.error(`Falha ao enviar email para ${to}: ${error.message || error}`);
      return false;
    }
  }
}
