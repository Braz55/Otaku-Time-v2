import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Request,
  Query,
} from '@nestjs/common';
import { MangaService } from './manga.service';
import { UpdateMangaDto } from './dto/update-manga.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('manga')
export class MangaController {
  constructor(private readonly mangaService: MangaService) {}

  @UseGuards(JwtAuthGuard)
  @Post('import')
  importManga(
    @Body() body: { nome: string; anilistId?: number },
    @Request() req,
  ) {
    return this.mangaService.importFromAniList(
      body.nome,
      req.user.userId,
      body.anilistId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('latest-chapter/:anilistId')
  async getLatestChapter(@Param('anilistId') id: string) {
    const result = await this.mangaService.syncLatestChapter(+id);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Get('anilist/:id')
  getAniListById(@Param('id') id: string) {
    return this.mangaService.searchAniListById(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('external/:nome')
  getExternalDetails(@Param('nome') nome: string) {
    return this.mangaService.searchAniListManga(nome);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req, @Query('status') status?: string) {
    return this.mangaService.findAll(req.user.userId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search/:nome')
  search(
    @Param('nome') nome: string,
    @Request() req,
    @Query('page') page?: string,
  ) {
    return this.mangaService.searchMangaList(
      nome,
      page ? +page : 1,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('genre/:genre')
  async searchByGenre(
    @Param('genre') genre: string,
    @Request() req,
    @Query('page') page?: string,
  ) {
    return this.mangaService.searchByGenre(
      genre,
      page ? +page : 1,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mangaService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateMangaDto: UpdateMangaDto) {
    return this.mangaService.update(+id, updateMangaDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mangaService.remove(+id);
  }
}
