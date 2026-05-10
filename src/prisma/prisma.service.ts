import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Dizemos ao cliente do Prisma exatamente onde está a BD
    super();
  }

  async onModuleInit() {
    await this.$connect();
  }
}