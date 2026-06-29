import { Controller, Get, Post, Query } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }

  @Post('start')
  async startSync(@Query('bypass') bypass?: string) {
    const bypassCooldown = bypass === 'true';
    // Inicia em background para não bloquear a resposta HTTP
    this.syncService.runAutoSync(bypassCooldown, 30 * 60 * 1000);
    return { message: 'Background sync started successfully' };
  }
}
