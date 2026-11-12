import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MediaSource, MediaType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isAnimeSource,
  kindOf,
  parseMediaSource,
  parseMediaType,
  resolveMediaSource,
} from '../rating/media-type';
import { AddListItemDto } from './dto/add-list-item.dto';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

type ListCriteria = {
  genres?: string[];
  tags?: string[];
  mediaTypes?: MediaType[];
} | null;

// Chave única do item: a obra é identificada pela fonte e pela FK do seu tipo (L-23, L-28)
function itemKey(listId: number, fonte: MediaSource, mediaId: number) {
  return isAnimeSource(fonte)
    ? { listId_fonte_animeId: { listId, fonte, animeId: mediaId } }
    : { listId_mangaId: { listId, mangaId: mediaId } };
}

// A API expõe o ID da obra num só campo, calculado a partir da FK preenchida,
// e o tipo (ANIME/MANGA) deduzido da fonte
function withMediaId<
  T extends {
    fonte: MediaSource;
    animeId: number | null;
    mangaId: number | null;
  },
>(item: T) {
  return {
    ...item,
    mediaId: (item.animeId ?? item.mangaId)!,
    mediaType: kindOf(item.fonte),
  };
}

@Injectable()
export class ListService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: number, dto: CreateListDto) {
    const list = await this.prisma.customList.create({
      data: {
        userId,
        name: dto.name?.trim() || 'Nova lista',
        description: dto.description?.trim() || null,
        coverUrl: dto.coverUrl?.trim() || null,
        criteria: dto.criteria ? (dto.criteria as any) : Prisma.JsonNull,
      },
    });
    return this.findOne(userId, list.id);
  }

  async findAll(userId: number) {
    const lists = await this.prisma.customList.findMany({
      where: { userId },
      include: {
        _count: { select: { items: true } },
        items: {
          select: {
            fonte: true,
            animeId: true,
            mangaId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
    return lists.map((list) => ({
      ...list,
      items: list.items.map(withMediaId),
    }));
  }

  async findOne(userId: number, listId: number) {
    const list = await this.prisma.customList.findFirst({
      where: { id: listId, userId },
      include: {
        items: {
          include: { anime: true, manga: true },
          orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
        },
      },
    });
    if (!list) throw new NotFoundException('Lista não encontrada');
    return { ...list, items: list.items.map(withMediaId) };
  }

  async update(userId: number, listId: number, dto: UpdateListDto) {
    await this.assertOwner(userId, listId);
    const data: Prisma.CustomListUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim() || 'Nova lista';
    if (dto.description !== undefined)
      data.description = dto.description?.trim() || null;
    if (dto.coverUrl !== undefined)
      data.coverUrl = dto.coverUrl?.trim() || null;
    if (dto.criteria !== undefined) {
      data.criteria = dto.criteria ? (dto.criteria as any) : Prisma.JsonNull;
    }
    await this.prisma.customList.update({ where: { id: listId }, data });
    return this.findOne(userId, listId);
  }

  async remove(userId: number, listId: number) {
    await this.assertOwner(userId, listId);
    return this.prisma.customList.delete({ where: { id: listId } });
  }

  async addItem(userId: number, listId: number, dto: AddListItemDto) {
    await this.assertOwner(userId, listId);
    const fonte = await resolveMediaSource(this.prisma, dto.mediaId, {
      fonte: dto.fonte,
      mediaType: dto.mediaType,
      format: dto.format,
    });
    await this.addItemAtEnd(listId, fonte, dto.mediaId);
    return this.findOne(userId, listId);
  }

  // fonteOuTipo: a fonte (TMDB_TV, ...) ou, em versões antigas da app, o tipo (ANIME/MANGA)
  async removeItem(
    userId: number,
    listId: number,
    fonteOuTipo: string,
    mediaId: number,
  ) {
    await this.assertOwner(userId, listId);
    const fonte = await this.resolveItemSource(listId, fonteOuTipo, mediaId);
    await this.prisma.customListItem.delete({
      where: itemKey(listId, fonte, mediaId),
    });
    await this.compactPositions(listId);
    return this.findOne(userId, listId);
  }

  async updateOrder(userId: number, listId: number, dto: UpdateOrderDto) {
    await this.assertOwner(userId, listId);
    const listItemIds = new Set(
      (
        await this.prisma.customListItem.findMany({
          where: { listId },
          select: { id: true },
        })
      ).map((i) => i.id),
    );
    await this.prisma.$transaction(
      (dto.items || [])
        .filter((item) => listItemIds.has(item.id))
        .map((item) =>
          this.prisma.customListItem.update({
            where: { id: item.id },
            data: { position: item.position },
          }),
        ),
    );
    await this.compactPositions(listId);
    return this.findOne(userId, listId);
  }

  private async assertOwner(userId: number, listId: number) {
    const list = await this.prisma.customList.findUnique({
      where: { id: listId },
    });
    if (!list) throw new NotFoundException('Lista não encontrada');
    if (list.userId !== userId)
      throw new ForbiddenException('Sem permissão para alterar esta lista');
    return list;
  }

  private async resolveItemSource(
    listId: number,
    fonteOuTipo: string,
    mediaId: number,
  ): Promise<MediaSource> {
    const upper = fonteOuTipo.toUpperCase();
    if ((Object.values(MediaSource) as string[]).includes(upper)) {
      return parseMediaSource(upper)!;
    }
    const mediaType = parseMediaType(upper);
    if (mediaType === MediaType.MANGA) return MediaSource.ANILIST;
    // Anime sem fonte: usa a do item que já está nesta lista (série primeiro)
    const items = await this.prisma.customListItem.findMany({
      where: { listId, animeId: mediaId },
      select: { fonte: true },
    });
    if (items.some((i) => i.fonte === MediaSource.TMDB_TV)) {
      return MediaSource.TMDB_TV;
    }
    return items[0]?.fonte ?? MediaSource.TMDB_TV;
  }

  private async addItemAtEnd(
    listId: number,
    fonte: MediaSource,
    mediaId: number,
  ) {
    const max = await this.prisma.customListItem.aggregate({
      where: { listId },
      _max: { position: true },
    });
    const data: Prisma.CustomListItemUncheckedCreateInput = {
      listId,
      fonte,
      position: (max._max.position ?? 0) + 1,
      ...(isAnimeSource(fonte) ? { animeId: mediaId } : { mangaId: mediaId }),
    };
    return this.prisma.customListItem.upsert({
      where: itemKey(listId, fonte, mediaId),
      update: {},
      create: data,
    });
  }

  private async compactPositions(listId: number) {
    const items = await this.prisma.customListItem.findMany({
      where: { listId },
      orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
    });
    await this.prisma.$transaction(
      items.map((item, index) =>
        this.prisma.customListItem.update({
          where: { id: item.id },
          data: { position: index + 1 },
        }),
      ),
    );
  }
}
