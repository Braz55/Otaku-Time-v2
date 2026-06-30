import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: number,
    title: string,
    message: string,
    type: string,
    mediaId?: number,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        mediaId,
      },
    });
  }

  async getUserNotifications(userId: number) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async markAsRead(userId: number, id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Não tem permissão para alterar esta notificação.');
    }

    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  async markAllAsRead(userId: number) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  async deleteNotification(userId: number, id: number) {
    const notification = await this.prisma.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new NotFoundException('Notificação não encontrada.');
    }

    if (notification.userId !== userId) {
      throw new ForbiddenException('Não tem permissão para eliminar esta notificação.');
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async deleteAllNotifications(userId: number) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }
}
