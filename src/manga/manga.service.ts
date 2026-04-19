import { Injectable } from '@nestjs/common';
import { CreateMangaDto } from './dto/create-manga.dto';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { PrismaService } from '../prisma/prisma.service'; // <-- Importamos a ponte

@Injectable()
export class MangaService {

  // Injetamos o Prisma aqui:
  constructor(private prisma: PrismaService) {}

  create(createMangaDto: CreateMangaDto) {
    return 'This action adds a new manga';
  }

  //metodo que vai a db e carrega o que lá está
  findAll() {
    return this.prisma.manga.findMany(); // <-- MAGIA ACONTECE AQUI!
  }

  findOne(id: number) {
    return `This action returns a #${id} manga`;
  }

  update(id: number, updateMangaDto: UpdateMangaDto) {
    return `This action updates a #${id} manga`;
  }

  remove(id: number) {
    return `This action removes a #${id} manga`;
  }
}
