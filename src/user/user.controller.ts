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
import { UnlockAchievementDto } from './dto/unlock-achievement.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { RedeemGiftCodeDto } from './dto/redeem-gift-code.dto';
import { GenerateGiftCodeDto } from './dto/generate-gift-code.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { CreateAchievementDto } from './dto/create-achievement.dto';
import { UpdateAchievementDto } from './dto/update-achievement.dto';

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

  // --- Conquistas ---
  @UseGuards(JwtAuthGuard)
  @Get('achievements')
  getAchievements(@Request() req) {
    return this.userService.getAchievements(req.user.userId);
  }

  @Get('achievements/catalog')
  getAchievementCatalog() {
    return this.userService.getAchievementCatalog();
  }

  @UseGuards(JwtAuthGuard)
  @Post('achievements/unlock')
  unlockAchievement(@Request() req, @Body() body: UnlockAchievementDto) {
    return this.userService.unlockAchievement(
      req.user.userId,
      body.achievementId,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('achievements/seed')
  seedAchievements() {
    return this.userService.seedAchievements();
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

  // --- Rotas de Subscrições & Gift Codes ---
  @UseGuards(JwtAuthGuard)
  @Post('subscription/redeem')
  redeemGiftCode(@Request() req, @Body() body: RedeemGiftCodeDto) {
    return this.userService.redeemGiftCode(req.user.userId, body.code);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/gift-codes')
  getGiftCodes() {
    return this.userService.listGiftCodes();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/gift-codes/generate')
  generateGiftCode(@Body() body: GenerateGiftCodeDto) {
    return this.userService.generateGiftCode(
      body.durationDays,
      body.customCode,
      body.expiresAt,
    );
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/subscriptions')
  getSubscriptions() {
    return this.userService.listAllSubscriptions();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/subscriptions/:id')
  updateSubscription(
    @Param('id') id: string,
    @Body() body: UpdateSubscriptionDto,
  ) {
    return this.userService.updateSubscription(+id, body);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/achievements')
  createAchievement(
    @Body()
    data: CreateAchievementDto,
  ) {
    return this.userService.createAchievement(data);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/achievements/:id')
  updateAchievement(
    @Param('id') id: string,
    @Body()
    data: UpdateAchievementDto,
  ) {
    return this.userService.updateAchievement(+id, data);
  }
}
