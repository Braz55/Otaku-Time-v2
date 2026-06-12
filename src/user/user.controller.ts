import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

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
  restoreBackup(@Request() req, @Body() body: any) {
    return this.userService.restoreBackup(req.user.userId, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('library')
  clearLibrary(@Request() req) {
    return this.userService.clearUserLibrary(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  updateProfile(@Request() req, @Body() updateDto: any) {
    return this.userService.update(req.user.userId, updateDto);
  }

  @Post()
  create(@Body() createUserDto: CreateUserDto) {
    return this.userService.create(createUserDto);
  }

  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get('id/:id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch('id/:id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete('id/:id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
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
  setFavorite(@Request() req, @Body() favoriteData: { anilistMediaId: number; mediaType: 'ANIME' | 'MANGA'; rankPosition: number }) {
    return this.userService.setFavorite(req.user.userId, favoriteData);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('favorites/:type/:rank')
  removeFavorite(@Request() req, @Param('type') type: string, @Param('rank') rank: string) {
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
  updateStatistics(@Request() req, @Body() statsData: any) {
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
  unlockAchievement(@Request() req, @Body('achievementId') achievementId: number) {
    return this.userService.unlockAchievement(req.user.userId, +achievementId);
  }

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
  updateUserRole(@Param('id') id: string, @Body('tipoConta') body: { tipoConta: string }) {
    // Note: check if body is nested or raw request body. If the client sends { "tipoConta": "pro" }, NestJS can bind it.
    // Let's support both raw Body('tipoConta') or body.tipoConta to prevent runtime payload errors.
    const roleValue = typeof body === 'object' && body !== null && 'tipoConta' in body ? (body as any).tipoConta : body;
    return this.userService.updateUserRole(+id, roleValue);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/sync-logs')
  getSyncLogs() {
    return this.userService.getSyncLogs();
  }

  // --- Rotas de Subscrições & Gift Codes ---
  @UseGuards(JwtAuthGuard)
  @Post('subscription/redeem')
  redeemGiftCode(@Request() req, @Body('code') code: string) {
    return this.userService.redeemGiftCode(req.user.userId, code);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/gift-codes')
  getGiftCodes() {
    return this.userService.listGiftCodes();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Post('admin/gift-codes/generate')
  generateGiftCode(
    @Body('durationDays') durationDays: number,
    @Body('customCode') customCode?: string,
    @Body('expiresAt') expiresAt?: string
  ) {
    return this.userService.generateGiftCode(+durationDays, customCode, expiresAt);
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Get('admin/subscriptions')
  getSubscriptions() {
    return this.userService.listAllSubscriptions();
  }

  @UseGuards(JwtAuthGuard, AdminGuard)
  @Patch('admin/subscriptions/:id')
  updateSubscription(@Param('id') id: string, @Body() body: any) {
    return this.userService.updateSubscription(+id, body);
  }
}

