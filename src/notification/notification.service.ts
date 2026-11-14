import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MediaRef } from '../rating/media-type';

@Injectable()
export class NotificationService {
  constructor(private readonly prisma: PrismaService) {}

  async createNotification(
    userId: number,
    title: string,
    message: string,
    type: string,
    media?: MediaRef,
  ) {
    return this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        fonte: media?.fonte,
        mediaId: media?.id,
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
      throw new ForbiddenException(
        'Não tem permissão para alterar esta notificação.',
      );
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
      throw new ForbiddenException(
        'Não tem permissão para eliminar esta notificação.',
      );
    }

    return this.prisma.notification.delete({
      where: { id },
    });
  }

  async createOrReplaceNotification(
    userId: number,
    title: string,
    message: string,
    type: string,
    media?: MediaRef,
  ) {
    const create = this.prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        fonte: media?.fonte,
        mediaId: media?.id,
      },
    });
    if (!media) return create;

    // Apagar a anterior e criar a nova na mesma transação: nunca fica sem nenhuma
    const [, created] = await this.prisma.$transaction([
      this.prisma.notification.deleteMany({
        where: {
          userId,
          type,
          fonte: media.fonte,
          mediaId: media.id,
        },
      }),
      create,
    ]);
    return created;
  }

  // Versão em lote de createOrReplaceNotification: uma notificação por utilizador sobre a mesma
  // obra, em duas instruções. `db` é a transação do chamador, para as notificações nascerem
  // (ou não) juntamente com a alteração que as provocou.
  async replaceMany(
    db: Prisma.TransactionClient,
    notifications: { userId: number; title: string; message: string }[],
    type: string,
    media: MediaRef,
  ) {
    if (notifications.length === 0) return;

    await db.notification.deleteMany({
      where: {
        userId: { in: notifications.map((n) => n.userId) },
        type,
        fonte: media.fonte,
        mediaId: media.id,
      },
    });
    await db.notification.createMany({
      data: notifications.map((n) => ({
        userId: n.userId,
        title: n.title,
        message: n.message,
        type,
        fonte: media.fonte,
        mediaId: media.id,
      })),
    });
  }

  async autoMarkOldAsRead(hours = 48) {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return this.prisma.notification.updateMany({
      where: {
        read: false,
        createdAt: {
          lt: cutoffDate,
        },
      },
      data: { read: true },
    });
  }

  async deleteAllNotifications(userId: number) {
    return this.prisma.notification.deleteMany({
      where: { userId },
    });
  }
}
