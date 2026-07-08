import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GiftCodeService {
  constructor(private readonly prisma: PrismaService) {}

  async redeemGiftCode(userId: number, inputCode: string) {
    const code = inputCode.trim().toUpperCase();
    const now = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const gift = await tx.giftCode.findUnique({
        where: { code },
      });

      if (!gift) {
        throw new BadRequestException('Código inválido ou não encontrado.');
      }
      if (gift.isUsed) {
        throw new BadRequestException('Este código já foi utilizado.');
      }
      if (gift.expiresAt && gift.expiresAt < now) {
        throw new BadRequestException('Este código expirou.');
      }

      const updateResult = await tx.giftCode.updateMany({
        where: {
          code,
          isUsed: false,
        },
        data: {
          isUsed: true,
          redeemedByUserId: userId,
          redeemedAt: now,
        },
      });

      if (updateResult.count !== 1) {
        throw new BadRequestException('Este código já foi utilizado.');
      }

      const durationMs = gift.durationDays * 24 * 60 * 60 * 1000;
      let newEndDate: Date;

      const sub = await tx.userSubscription.findUnique({
        where: { userId },
      });

      if (sub && sub.status === 'ACTIVE' && sub.currentPeriodEnd > now) {
        newEndDate = new Date(sub.currentPeriodEnd.getTime() + durationMs);
      } else {
        newEndDate = new Date(now.getTime() + durationMs);
      }

      await tx.userSubscription.upsert({
        where: { userId },
        update: {
          status: 'ACTIVE',
          currentPeriodEnd: newEndDate,
          planType: 'PREMIUM',
        },
        create: {
          userId,
          status: 'ACTIVE',
          startDate: now,
          currentPeriodEnd: newEndDate,
          planType: 'PREMIUM',
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { tipoConta: 'pro' },
      });

      return {
        durationDays: gift.durationDays,
        newEndDate,
      };
    });

    return {
      success: true,
      message: `Premium (${result.durationDays} dias) resgatado com sucesso!`,
      currentPeriodEnd: result.newEndDate,
    };
  }

  async listGiftCodes() {
    return this.prisma.giftCode.findMany({
      include: {
        redeemedByUser: {
          select: { id: true, nome: true, email: true },
        },
      },
      orderBy: { id: 'desc' },
    });
  }

  async generateGiftCode(
    durationDays: number,
    customCode?: string,
    expiresAt?: string,
  ) {
    let code = customCode?.trim().toUpperCase();
    if (!code) {
      const rand = () =>
        Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `OTAKU-${rand()}-${rand()}`;
    }

    const exists = await this.prisma.giftCode.findUnique({ where: { code } });
    if (exists) {
      throw new BadRequestException('O código inserido já existe.');
    }

    return this.prisma.giftCode.create({
      data: {
        code,
        durationDays,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
  }
}
