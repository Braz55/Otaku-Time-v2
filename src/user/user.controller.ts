import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

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
}
