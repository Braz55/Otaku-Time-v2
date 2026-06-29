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

    // Skip self-pings and direct health checks to prevent infinite keep-awake loops
    const isSelfPing =
      req.headers['x-self-ping'] === 'true' || req.path === '/health';

    if (!isSelfPing) {
      // Determine the base URL dynamically (helps with local testing vs Render deployment)
      const protocol =
        (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.headers.host;
      const baseUrl = `${protocol}://${host}`;

      this.keepAwakeService.startAwakeWindow(baseUrl);
    }

    next();
  }
}
