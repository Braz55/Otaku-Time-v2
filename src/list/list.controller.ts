import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddListItemDto } from './dto/add-list-item.dto';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { ListService } from './list.service';

@UseGuards(JwtAuthGuard)
@Controller('lists')
export class ListController {
  constructor(private readonly listService: ListService) {}

  @Post()
  create(@Request() req, @Body() dto: CreateListDto) {
    return this.listService.create(req.user.userId, dto);
  }

  @Get()
  findAll(@Request() req) {
    return this.listService.findAll(req.user.userId);
  }

  @Get(':id')
  findOne(@Request() req, @Param('id') id: string) {
    return this.listService.findOne(req.user.userId, +id);
  }

  @Patch(':id')
  update(@Request() req, @Param('id') id: string, @Body() dto: UpdateListDto) {
    return this.listService.update(req.user.userId, +id, dto);
  }

  @Delete(':id')
  remove(@Request() req, @Param('id') id: string) {
    return this.listService.remove(req.user.userId, +id);
  }

  @Post(':id/items')
  addItem(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AddListItemDto,
  ) {
    return this.listService.addItem(req.user.userId, +id, dto);
  }

  // :fonte é a fonte (TMDB_TV, TMDB_MOVIE, ANILIST); ANIME/MANGA continua aceite (versões antigas)
  @Delete(':id/items/:fonte/:mediaId')
  removeItem(
    @Request() req,
    @Param('id') id: string,
    @Param('fonte') fonte: string,
    @Param('mediaId') mediaId: string,
  ) {
    return this.listService.removeItem(req.user.userId, +id, fonte, +mediaId);
  }

  @Patch(':id/items/order')
  updateOrder(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.listService.updateOrder(req.user.userId, +id, dto);
  }
}
