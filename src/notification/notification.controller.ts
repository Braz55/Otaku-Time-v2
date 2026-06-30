import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notification')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  getNotifications(@Request() req) {
    return this.notificationService.getUserNotifications(req.user.userId);
  }

  @Patch(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.notificationService.markAsRead(req.user.userId, id);
  }

  @Post('read-all')
  markAllAsRead(@Request() req) {
    return this.notificationService.markAllAsRead(req.user.userId);
  }

  @Delete(':id')
  deleteNotification(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.notificationService.deleteNotification(req.user.userId, id);
  }

  @Delete()
  deleteAllNotifications(@Request() req) {
    return this.notificationService.deleteAllNotifications(req.user.userId);
  }
}
