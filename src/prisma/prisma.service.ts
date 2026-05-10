import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaLibSql } from '@prisma/adapter-libsql';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
    const adapter = new PrismaLibSql({ url: dbUrl });
    
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}