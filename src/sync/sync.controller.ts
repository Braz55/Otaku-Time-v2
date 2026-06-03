import { Controller, Get, Post } from '@nestjs/common';
import { SyncService } from './sync.service';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }

  @Post('start')
  async startSync() {
    // Inicia em background para não bloquear a resposta HTTP
    this.syncService.runAutoSync();
    return { message: 'Background sync started successfully' };
  }
}

