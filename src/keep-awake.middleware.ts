import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { KeepAwakeService } from './keep-awake.service';

@Injectable()
export class KeepAwakeMiddleware implements NestMiddleware {
  constructor(private readonly keepAwakeService: KeepAwakeService) {}

  use(req: Request, res: Response, next: NextFunction) {
    // Skip OPTIONS preflight requests
    if (req.method === 'OPTIONS') {
      return next();
    }

    // Skip self-pings to prevent infinite keep-awake loops
    if (req.headers['x-self-ping'] === 'true') {
      return next();
    }

    // Determine the base URL dynamically (helps with local testing vs Render deployment)
    const protocol =
      (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // Pings externos (GitHub Actions) ao /health também arrancam o self-ping,
    // mas não contam como atividade de utilizador (para não disparar o sync)
    if (req.path !== '/health') {
      this.keepAwakeService.recordUserActivity();
    }
    this.keepAwakeService.startAwakeWindow(baseUrl);

    next();
  }
}
