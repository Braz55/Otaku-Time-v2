import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { MediaType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AddListItemDto } from './dto/add-list-item.dto';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { UpdateOrderDto } from './dto/update-order.dto';

type ListCriteria = {
  genres?: string[];
  tags?: string[];
  mediaTypes?: MediaType[];
} | null;

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
        isPublic: Boolean(dto.isPublic),
        criteria: this.normalizeCriteria(dto.criteria),
      },
    });
    await this.syncCriteriaItems(userId, list.id);
    return this.findOne(userId, list.id);
  }

  async findAll(userId: number) {
    return this.prisma.customList.findMany({
      where: { userId },
      include: { _count: { select: { items: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findOne(userId: number, listId: number) {
    const list = await this.prisma.customList.findFirst({
      where: { id: listId, OR: [{ userId }, { isPublic: true }] },
      include: {
        items: {
          include: { anime: true, manga: true },
          orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
        },
      },
    });
    if (!list) throw new NotFoundException('Lista não encontrada');
    return list;
  }

  async update(userId: number, listId: number, dto: UpdateListDto) {
    await this.assertOwner(userId, listId);
    const data: Prisma.CustomListUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim() || 'Nova lista';
    if (dto.description !== undefined) data.description = dto.description?.trim() || null;
    if (dto.coverUrl !== undefined) data.coverUrl = dto.coverUrl?.trim() || null;
    if (dto.isPublic !== undefined) data.isPublic = Boolean(dto.isPublic);
    if (dto.criteria !== undefined) data.criteria = this.normalizeCriteria(dto.criteria);
    await this.prisma.customList.update({ where: { id: listId }, data });
    if (dto.criteria !== undefined) await this.syncCriteriaItems(userId, listId);
    return this.findOne(userId, listId);
  }

  async remove(userId: number, listId: number) {
    await this.assertOwner(userId, listId);
    return this.prisma.customList.delete({ where: { id: listId } });
  }

  async addItem(userId: number, listId: number, dto: AddListItemDto) {
    await this.assertOwner(userId, listId);
    return this.addItemAtEnd(listId, dto.anilistMediaId, dto.mediaType);
  }

  async removeItem(userId: number, listId: number, mediaType: MediaType, mediaId: number) {
    await this.assertOwner(userId, listId);
    await this.prisma.customListItem.delete({
      where: { listId_anilistMediaId_mediaType: { listId, anilistMediaId: mediaId, mediaType } },
    });
    await this.compactPositions(listId);
    return this.findOne(userId, listId);
  }

  async updateOrder(userId: number, listId: number, dto: UpdateOrderDto) {
    await this.assertOwner(userId, listId);
    const listItemIds = new Set(
      (await this.prisma.customListItem.findMany({ where: { listId }, select: { id: true } })).map(i => i.id),
    );
    await this.prisma.$transaction(
      (dto.items || [])
        .filter(item => listItemIds.has(item.id))
        .map(item => this.prisma.customListItem.update({
          where: { id: item.id },
          data: { position: item.position },
        })),
    );
    await this.compactPositions(listId);
    return this.findOne(userId, listId);
  }

  async checkAndAddToDynamicLists(userId: number, mediaId: number, mediaType: MediaType) {
    const lists = await this.prisma.customList.findMany({
      where: { userId, criteria: { not: Prisma.JsonNull } },
    });
    for (const list of lists) {
      const criteria = list.criteria as ListCriteria;
      if (await this.mediaMatchesCriteria(mediaId, mediaType, criteria)) {
        await this.addItemAtEnd(list.id, mediaId, mediaType);
      }
    }
  }

  private async assertOwner(userId: number, listId: number) {
    const list = await this.prisma.customList.findUnique({ where: { id: listId } });
    if (!list) throw new NotFoundException('Lista não encontrada');
    if (list.userId !== userId) throw new ForbiddenException('Sem permissão para alterar esta lista');
    return list;
  }

  private normalizeCriteria(criteria: CreateListDto['criteria']): Prisma.InputJsonValue | typeof Prisma.JsonNull {
    if (!criteria) return Prisma.JsonNull;
    const genres = [...new Set((criteria.genres || []).map(v => v.trim()).filter(Boolean))];
    const tags = [...new Set((criteria.tags || []).map(v => v.trim()).filter(Boolean))];
    const mediaTypes = [...new Set((criteria.mediaTypes || []).filter(v => v === 'ANIME' || v === 'MANGA'))];
    if (!genres.length && !tags.length) return Prisma.JsonNull;
    return { genres, tags, mediaTypes };
  }

  private async addItemAtEnd(listId: number, anilistMediaId: number, mediaType: MediaType) {
    const max = await this.prisma.customListItem.aggregate({
      where: { listId },
      _max: { position: true },
    });
    const data: Prisma.CustomListItemCreateInput = {
      list: { connect: { id: listId } },
      anilistMediaId,
      mediaType,
      position: (max._max.position ?? 0) + 1,
      ...(mediaType === 'ANIME'
        ? { anime: { connect: { id: anilistMediaId } } }
        : { manga: { connect: { id: anilistMediaId } } }),
    };
    return this.prisma.customListItem.upsert({
      where: { listId_anilistMediaId_mediaType: { listId, anilistMediaId, mediaType } },
      update: {},
      create: data,
    });
  }

  private async syncCriteriaItems(userId: number, listId: number) {
    const list = await this.prisma.customList.findUnique({ where: { id: listId } });
    const criteria = list?.criteria as ListCriteria;
    if (!criteria) return;

    const [animes, mangas] = await Promise.all([
      !criteria.mediaTypes?.length || criteria.mediaTypes.includes('ANIME')
        ? this.prisma.userAnime.findMany({ where: { userId }, include: { anime: true } })
        : Promise.resolve([]),
      !criteria.mediaTypes?.length || criteria.mediaTypes.includes('MANGA')
        ? this.prisma.userManga.findMany({ where: { userId }, include: { manga: true } })
        : Promise.resolve([]),
    ]);

    for (const item of animes) {
      if (this.generosMatch(item.anime.generos, criteria)) await this.addItemAtEnd(listId, item.animeId, 'ANIME');
    }
    for (const item of mangas) {
      if (this.generosMatch(item.manga.generos, criteria)) await this.addItemAtEnd(listId, item.mangaId, 'MANGA');
    }
  }

  private async mediaMatchesCriteria(mediaId: number, mediaType: MediaType, criteria: ListCriteria) {
    if (!criteria) return false;
    if (criteria.mediaTypes?.length && !criteria.mediaTypes.includes(mediaType)) return false;
    const media = mediaType === 'ANIME'
      ? await this.prisma.anime.findUnique({ where: { id: mediaId }, select: { generos: true } })
      : await this.prisma.manga.findUnique({ where: { id: mediaId }, select: { generos: true } });
    return this.generosMatch(media?.generos, criteria);
  }

  private generosMatch(generos: Prisma.JsonValue | null | undefined, criteria: ListCriteria) {
    const wanted = [...(criteria?.genres || []), ...(criteria?.tags || [])].map(v => v.toLowerCase());
    if (!wanted.length) return Boolean(criteria?.mediaTypes?.length);
    if (!generos) return false;
    if (typeof generos === 'string') return wanted.some(w => generos.toLowerCase().includes(w));
    if (typeof generos === 'object' && !Array.isArray(generos)) {
      return Object.keys(generos).some(key => wanted.includes(key.toLowerCase()));
    }
    return false;
  }

  private async compactPositions(listId: number) {
    const items = await this.prisma.customListItem.findMany({
      where: { listId },
      orderBy: [{ position: 'asc' }, { addedAt: 'asc' }],
    });
    await this.prisma.$transaction(
      items.map((item, index) => this.prisma.customListItem.update({
        where: { id: item.id },
        data: { position: index + 1 },
      })),
    );
  }
}
