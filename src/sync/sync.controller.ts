import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { SyncService } from './sync.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get('status')
  getStatus() {
    return this.syncService.getStatus();
  }

  @Post('start')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async startSync() {
    // Inicia em background para não bloquear a resposta HTTP
    this.syncService.runManualSync();
    return { message: 'Background manual sync started successfully' };
  }
}
