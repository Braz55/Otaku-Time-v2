import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request, Query } from '@nestjs/common';
import { AnimeService } from './anime.service';
import { UpdateAnimeDto } from './dto/update-anime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('genres-and-tags')
  getGenresAndTags() {
    return this.animeService.getGenreTags();
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  importAnime(@Body() body: { nome: string; anilistId?: number }, @Request() req) {
    return this.animeService.importFromAniList(body.nome, req.user.userId, body.anilistId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('anilist/:id')
  getAniListById(@Param('id') id: string) {
    return this.animeService.searchAniListById(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('external/:nome')
  getExternalDetails(@Param('nome') nome: string) {
    return this.animeService.searchAniList(nome);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search/:nome')
  async search(@Param('nome') nome: string, @Request() req, @Query('page') page?: string) {
    return this.animeService.searchAnimeList(nome, page ? +page : 1, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('genre/:genre')
  async searchByGenre(@Param('genre') genre: string, @Request() req, @Query('page') page?: string) {
    return this.animeService.searchByGenre(genre, page ? +page : 1, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req) {
    return this.animeService.findAll(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.animeService.findOne(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAnimeDto: UpdateAnimeDto) {
    return this.animeService.update(+id, updateAnimeDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.animeService.remove(+id);
  }
}
