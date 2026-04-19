import { Injectable } from '@nestjs/common';
import { CreateAnimeDto } from './dto/create-anime.dto';
import { UpdateAnimeDto } from './dto/update-anime.dto';
import { PrismaService } from '../prisma/prisma.service'; // <-- Importamos a ponte

@Injectable()
export class AnimeService {

  // Injetamos o Prisma aqui:
  constructor(private prisma: PrismaService) {}
  
  create(createAnimeDto: CreateAnimeDto) {
    return 'This action adds a new anime';
  }

  findAll() {
    return this.prisma.anime.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} anime`;
  }

  update(id: number, updateAnimeDto: UpdateAnimeDto) {
    return `This action updates a #${id} anime`;
  }

  remove(id: number) {
    return `This action removes a #${id} anime`;
  }
}
