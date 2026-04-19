import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client'; // <-- Tens este import?

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit { 
  // O segredo está no "extends PrismaClient" ali em cima ^
  
  async onModuleInit() {
    await this.$connect();
  }
}