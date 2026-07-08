import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async listAllSubscriptions() {
    return this.prisma.userSubscription.findMany({
      include: {
        user: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { currentPeriodEnd: 'desc' },
    });
  }

  async updateSubscription(id: number, updateData: UpdateSubscriptionDto) {
    const data: any = {};
    if (updateData.planType) data.planType = updateData.planType;
    if (updateData.status) data.status = updateData.status;
    if (updateData.currentPeriodEnd)
      data.currentPeriodEnd = new Date(updateData.currentPeriodEnd);

    const sub = await this.prisma.userSubscription.update({
      where: { id },
      data,
      include: {
        user: {
          select: { id: true, nome: true, email: true },
        },
      },
    });

    if (data.status === 'EXPIRED') {
      await this.prisma.user.update({
        where: { id: sub.userId },
        data: { tipoConta: 'padrao' },
      });
    } else if (data.status === 'ACTIVE') {
      await this.prisma.user.update({
        where: { id: sub.userId },
        data: { tipoConta: 'pro' },
      });
    }

    return sub;
  }
}
