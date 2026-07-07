import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json, urlencoded } from 'express';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) {
        callback(null, true);
        return;
      }

      const allowedOrigins = [
        'https://otaku-time-v2.onrender.com',
        'capacitor://localhost',
        'http://localhost',
      ];

      const frontendUrl = process.env.FRONTEND_URL;
      if (frontendUrl) {
        allowedOrigins.push(frontendUrl);
      }

      // Check if the origin matches any allowed origin or is local development/Capacitor
      const isLocalhost =
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin) ||
        /^capacitor:\/\//.test(origin);

      const isAllowed = allowedOrigins.includes(origin) || isLocalhost;

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ limit: '10mb', extended: true }));

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`[Nest] Server is running on port ${port} (0.0.0.0)`);
}
void bootstrap();
