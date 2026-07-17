import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import * as nodemailer from 'nodemailer';
import 'dotenv/config';

async function main() {
  console.log("=== EMAIL CONFIGURATION CHECK ===");
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === 'true';
  const from = process.env.SMTP_FROM || '"Otaku Time" <noreply@otakutime.com>';

  console.log(`SMTP Host: ${host}`);
  console.log(`SMTP Port: ${port}`);
  console.log(`SMTP Secure: ${secure}`);
  console.log(`SMTP User: ${user}`);
  console.log(`SMTP Pass: ${pass ? '****' : 'undefined'}`);
  console.log(`SMTP From: ${from}`);

  if (user === 'o_teu_email@gmail.com' || pass === 'a_tua_palavra_passe_de_aplicacao') {
    console.warn("\n⚠️ WARNING: You are using the default placeholder credentials in your .env / .env.local files.");
    console.warn("Please change SMTP_USER and SMTP_PASS to your actual email and application password.\n");
  }

  // Connect to database to check for admins
  console.log("=== DATABASE ADMINS CHECK ===");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not defined in the environment variables.");
  } else {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
      const admins = await prisma.user.findMany({
        where: { tipoConta: 'ADMIN' },
        select: { id: true, nome: true, email: true, tipoConta: true }
      });
      console.log(`Found ${admins.length} admin(s) in database:`);
      console.log(JSON.stringify(admins, null, 2));

      if (admins.length === 0) {
        console.warn("⚠️ WARNING: No users with tipoConta = 'ADMIN' were found in the database.");
        console.warn("The sync notification function will not send emails to anyone unless they are an ADMIN.");
      }
    } catch (err: any) {
      console.error("Error reading from database:", err.message);
    } finally {
      await prisma.$disconnect();
      await pool.end();
    }
  }

  // Try to send a test email
  if (host && port && user && pass) {
    console.log("\n=== SENDING TEST EMAIL ===");
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure,
      auth: { user, pass },
    });

    console.log("Verifying SMTP connection...");
    try {
      await transporter.verify();
      console.log("✅ SMTP Connection is valid!");

      console.log(`Sending test email to ${user}...`);
      const info = await transporter.sendMail({
        from,
        to: user,
        subject: '[Otaku Time] Test Email',
        text: 'This is a test email from Otaku Time to verify SMTP credentials.',
        html: '<p>This is a test email from <strong>Otaku Time</strong> to verify SMTP credentials.</p>'
      });
      console.log("✅ Email sent successfully!", info.messageId);
    } catch (err: any) {
      console.error("❌ Error sending email:", err.message);
      if (err.stack) console.error(err.stack);
    }
  } else {
    console.error("\n❌ Cannot send test email because SMTP credentials are not fully configured.");
  }
}

main().catch(console.error);
