import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // <-- Isto diz ao NestJS: "Toda a gente pode usar isto!"
@Module({
  providers: [PrismaService],
  exports: [PrismaService], // <-- Exportamos para que os outros o vejam
})
export class PrismaModule {}
