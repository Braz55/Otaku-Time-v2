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
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { RestoreBackupDto } from './dto/restore-backup.dto';
import { SetFavoriteDto } from './dto/set-favorite.dto';
import { UpdateUserStatisticsDto } from './dto/update-statistics.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';

@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @UseGuards(JwtAuthGuard)
  @Get('backup')
  exportBackup(@Request() req) {
    return this.userService.generateBackup(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('restore')
  restoreBackup(@Request() req, @Body() body: RestoreBackupDto) {
    return this.userService.restoreBackup(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('library')
  clearLibrary(@Request() req) {
    return this.userService.clearUserLibrary(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('library/anime')
  clearAnimeLibrary(@Request() req) {
    return this.userService.clearUserAnimeLibrary(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('library/manga')
  clearMangaLibrary(@Request() req) {
    return this.userService.clearUserMangaLibrary(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Request() req, @Body() updateDto: UpdateProfileDto) {
    return this.userService.update(req.user.userId, updateDto);
  }

  // --- Perfil Completo ---
  @UseGuards(JwtAuthGuard)
  @Get('profile/me')
  getProfileMe(@Request() req) {
    return this.userService.getUserProfile(req.user.userId);
  }

  @Get('profile/:id')
  getProfileId(@Param('id') id: string) {
    return this.userService.getUserProfile(+id);
  }

  // --- Destaques (Top Favorites) ---
  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  getFavorites(@Request() req) {
    return this.userService.getFavorites(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('favorites')
  setFavorite(
    @Request() req,
    @Body()
    favoriteData: SetFavoriteDto,
  ) {
    return this.userService.setFavorite(req.user.userId, favoriteData);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('favorites/:type/:rank')
  removeFavorite(
    @Request() req,
    @Param('type') type: string,
    @Param('rank') rank: string,
  ) {
    const mediaType = type.toUpperCase() as 'ANIME' | 'MANGA';
    return this.userService.removeFavorite(req.user.userId, mediaType, +rank);
  }

  // --- Estatísticas ---
  @UseGuards(JwtAuthGuard)
  @Get('statistics')
  getStatistics(@Request() req) {
    return this.userService.getStatistics(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('statistics')
  updateStatistics(@Request() req, @Body() statsData: UpdateUserStatisticsDto) {
    return this.userService.updateStatistics(req.user.userId, statsData);
  }

  // --- Rotas Administrativas ---
  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/stats')
  getAdminStats() {
    return this.userService.getAdminStats();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/users')
  getAdminUsers() {
    return this.userService.getAdminUsersList();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/users/:id/role')
  updateUserRole(@Param('id') id: string, @Body() body: UpdateUserRoleDto) {
    return this.userService.updateUserRole(+id, body.tipoConta);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/sync-logs')
  getSyncLogs() {
    return this.userService.getSyncLogs();
  }
}
