import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { PrismaService } from '../prisma/prisma.service'; // Importamos a nossa ponte

@Injectable()
export class UserService {
  // Injetamos o PrismaService para podermos comunicar com a BD
  constructor(private readonly prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    // Aqui dizemos ao Prisma para criar um novo User com os dados do DTO
    return this.prisma.user.create({
      data: createUserDto,
    });
  }

  findAll() {
    return this.prisma.user.findMany(); // Já deixamos o findAll a funcionar também!
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateDto: any) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}