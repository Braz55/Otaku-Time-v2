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
  ParseArrayPipe,
} from '@nestjs/common';
import { AnimeService } from './anime.service';
import { UpdateAnimeDto } from './dto/update-anime.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { ImportAnimeDto } from './dto/import-anime.dto';
import { ImportTVTimeItemDto } from './dto/import-tvtime-item.dto';

@Controller('anime')
export class AnimeController {
  constructor(private readonly animeService: AnimeService) {}

  @UseGuards(JwtAuthGuard)
  @Get('genres-and-tags')
  getGenresAndTags(@Query('type') type?: 'ANIME' | 'MANGA') {
    return this.animeService.getGenreTags(type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('explore')
  explore(
    @Request() req,
    @Query('type') type?: 'ANIME' | 'MANGA',
    @Query('genres') genres?: string,
    @Query('tags') tags?: string,
    @Query('year') year?: string,
    @Query('season') season?: string,
    @Query('format') format?: string,
    @Query('status') status?: string,
    @Query('source') source?: string,
    @Query('country') country?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
  ) {
    const genresArr = genres
      ? genres
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    const tagsArr = tags
      ? tags
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : undefined;
    return this.animeService.explore(
      type || 'ANIME',
      genresArr,
      tagsArr,
      year ? +year : undefined,
      season,
      format,
      status,
      source,
      country,
      sort || 'TRENDING_DESC',
      page ? +page : 1,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('import')
  importAnime(@Body() importAnimeDto: ImportAnimeDto, @Request() req) {
    return this.animeService.importFromAniList(
      importAnimeDto.nome,
      req.user.userId,
      importAnimeDto.anilistId,
      importAnimeDto.format,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('anilist/:id')
  getAniListById(
    @Param('id') id: string,
    @Query('format') format: string,
    @Request() req,
  ) {
    return this.animeService.searchAniListById(+id, req.user.userId, format);
  }

  @UseGuards(JwtAuthGuard)
  @Get('tmdb/:id/season/:seasonNumber')
  getTVSeasonDetails(
    @Param('id') id: string,
    @Param('seasonNumber') seasonNumber: string,
  ) {
    return this.animeService.getTVSeasonDetails(+id, +seasonNumber);
  }

  @UseGuards(JwtAuthGuard)
  @Get('external/:nome')
  getExternalDetails(@Param('nome') nome: string, @Request() req) {
    return this.animeService.searchAniList(nome, req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('search/:nome')
  async search(
    @Param('nome') nome: string,
    @Request() req,
    @Query('page') page?: string,
  ) {
    return this.animeService.searchAnimeList(
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
    return this.animeService.searchByGenre(
      genre,
      page ? +page : 1,
      req.user.userId,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  findAll(@Request() req, @Query('status') status?: string) {
    return this.animeService.findAll(req.user.userId, status);
  }

  @UseGuards(JwtAuthGuard)
  @Post('import-tvtime')
  importTVTime(
    @Body(new ParseArrayPipe({ items: ImportTVTimeItemDto }))
    body: ImportTVTimeItemDto[],
    @Request() req,
  ) {
    return this.animeService.importFromTVTime(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('import-tvtime/status')
  getTVTimeImportStatus(@Request() req) {
    return this.animeService.getTvTimeImportStatus(req.user.userId);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Delete('clear-catalog')
  clearCatalog() {
    return this.animeService.clearAnimeCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @Get('calendar')
  getCalendar(@Request() req, @Query('start_date') startDate?: string) {
    return this.animeService.getCalendar(req.user.userId, startDate);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.animeService.findOne(+id, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAnimeDto: UpdateAnimeDto,
    @Request() req,
  ) {
    return this.animeService.update(+id, updateAnimeDto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.animeService.remove(+id, req.user);
  }
}
