import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { MediaSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CalendarService } from './calendar.service';
import { SyncTransientError } from '../common/sync-errors';
import { animeKey } from '../rating/media-type';

/** Um episódio tal como veio da fonte (TMDB), já normalizado. */
export interface FetchedEpisode {
  season: number;
  episodeNumber: number;
  globalEpisodeNumber: number | null;
  name: string | null;
  airDate: Date | null;
  stillPath: string | null;
}

type Tx = Prisma.TransactionClient;

const DAY_MS = 24 * 60 * 60 * 1000;
// Na passagem das listas antigas para a tabela, um episódio estreado há mais tempo do que isto
// fica como já tratado, para não sair uma notificação atrasada de um episódio antigo.
const BACKFILL_STALE_MS = 7 * DAY_MS;
// As escritas de uma obra longa (centenas de episódios) precisam de mais do que os 5s por defeito
const TX_OPTIONS = { timeout: 30_000, maxWait: 10_000 };

const keyOf = (ep: { season: number; episodeNumber: number }) =>
  `${ep.season}-${ep.episodeNumber}`;

const sameInstant = (a: Date | null, b: Date | null) =>
  (a?.getTime() ?? null) === (b?.getTime() ?? null);

/** Formato de cada episódio em Anime.episodesList (a cópia de leitura). */
function toSnapshot(ep: FetchedEpisode) {
  return {
    season: ep.season,
    episodeNumber: ep.episodeNumber,
    globalEpisodeNumber: ep.globalEpisodeNumber,
    name: ep.name,
    airDate: ep.airDate ? ep.airDate.toISOString() : null,
    stillPath: ep.stillPath,
  };
}

/**
 * Lê uma lista de episódios no formato antigo (JSON em Anime.episodesList, que também guardava
 * a marca `notified`). Tolera entradas incompletas e nomes de campos de versões anteriores.
 */
export function parseLegacyEpisodes(
  list: unknown,
): (FetchedEpisode & { notified: boolean })[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const result: (FetchedEpisode & { notified: boolean })[] = [];

  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const ep = raw as Record<string, any>;
    const season = Number(ep.season ?? ep.season_number);
    const episodeNumber = Number(
      ep.episodeNumber ?? ep.episode ?? ep.episode_number,
    );
    if (!Number.isInteger(season) || !Number.isInteger(episodeNumber)) continue;

    const key = keyOf({ season, episodeNumber });
    if (seen.has(key)) continue;
    seen.add(key);

    const rawDate = ep.airDate ?? ep.air_date;
    const parsed = rawDate ? new Date(rawDate) : null;
    const global = Number(ep.globalEpisodeNumber);

    result.push({
      season,
      episodeNumber,
      globalEpisodeNumber:
        ep.globalEpisodeNumber != null && Number.isInteger(global)
          ? global
          : null,
      name: typeof ep.name === 'string' ? ep.name : null,
      airDate: parsed && !isNaN(parsed.getTime()) ? parsed : null,
      stillPath: typeof ep.stillPath === 'string' ? ep.stillPath : null,
      notified: !!ep.notified,
    });
  }
  return result;
}

/**
 * Guarda os episódios de cada anime na tabela Episode (uma linha por episódio) e trata o que
 * acontece quando um episódio estreia. Todas as escritas sobre uma obra correm numa transação
 * com um lock da própria base de dados, por isso são atómicas e não se atropelam, mesmo com
 * mais do que uma instância do servidor.
 */
@Injectable()
export class EpisodeStoreService implements OnApplicationBootstrap {
  private readonly logger = new Logger(EpisodeStoreService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly calendarService: CalendarService,
  ) {}

  onApplicationBootstrap() {
    // Em background: não atrasa o arranque. É idempotente, por isso pode correr em cada arranque.
    this.backfillFromJson().catch((err) =>
      this.logger.error('Error backfilling the Episode table:', err),
    );
  }

  // Lock da obra até ao fim da transação. Quem pedir o mesmo lock espera.
  private lockAnime(tx: Tx, fonte: MediaSource, animeId: number) {
    const key = `anime:${fonte}:${animeId}`;
    return tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
  }

  /**
   * Aplica a lista completa de episódios vinda da fonte: cria os novos, atualiza os que
   * mudaram e apaga os que deixaram de existir. A cópia de leitura só é regravada se houve
   * alterações. Na mesma transação faz as transições de estado e as notificações.
   */
  async applyEpisodes(
    fonte: MediaSource,
    animeId: number,
    titulo: string,
    fetchedEpisodes: FetchedEpisode[],
  ): Promise<{ total: number; changed: boolean; notificationsSent: number }> {
    // A fonte não devia repetir episódios; se repetir, fica o primeiro
    const fetched: FetchedEpisode[] = [];
    const fetchedKeys = new Set<string>();
    for (const ep of fetchedEpisodes) {
      const key = keyOf(ep);
      if (fetchedKeys.has(key)) continue;
      fetchedKeys.add(key);
      fetched.push(ep);
    }

    return this.prisma.$transaction(async (tx) => {
      await this.lockAnime(tx, fonte, animeId);

      const existing = await tx.episode.findMany({
        where: { animeFonte: fonte, animeId },
      });
      if (existing.length > 0 && fetched.length === 0) {
        throw new SyncTransientError(
          `A fonte devolveu zero episódios para uma obra que tinha ${existing.length}; lista não alterada`,
        );
      }

      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Primeira vez que a obra passa pela tabela: as marcas de "já notificado" vêm da lista
      // antiga, se existir. Sem lista antiga é a primeira sincronização da obra, e tudo o que
      // estreou antes de hoje conta como já tratado.
      let legacyNotified: Map<string, boolean> | null = null;
      if (existing.length === 0) {
        const anime = await tx.anime.findUnique({
          where: animeKey(fonte, animeId),
          select: { episodesList: true },
        });
        legacyNotified = new Map(
          parseLegacyEpisodes(anime?.episodesList).map((ep) => [
            keyOf(ep),
            ep.notified,
          ]),
        );
      }
      const firstSync = legacyNotified !== null && legacyNotified.size === 0;

      const existingByKey = new Map(existing.map((ep) => [keyOf(ep), ep]));
      const toCreate: Prisma.EpisodeCreateManyInput[] = [];
      const toUpdate: FetchedEpisode[] = [];

      for (const ep of fetched) {
        const key = keyOf(ep);
        const current = existingByKey.get(key);
        if (!current) {
          const notified =
            legacyNotified?.get(key) ??
            (firstSync && !!ep.airDate && ep.airDate < today);
          toCreate.push({
            animeFonte: fonte,
            animeId,
            ...ep,
            notifiedAt: notified ? now : null,
          });
        } else if (
          current.globalEpisodeNumber !== ep.globalEpisodeNumber ||
          current.name !== ep.name ||
          current.stillPath !== ep.stillPath ||
          !sameInstant(current.airDate, ep.airDate)
        ) {
          toUpdate.push(ep);
        }
      }
      const toDelete = existing.filter((ep) => !fetchedKeys.has(keyOf(ep)));

      if (toCreate.length > 0) {
        await tx.episode.createMany({ data: toCreate });
      }
      for (const ep of toUpdate) {
        await tx.episode.update({
          where: {
            animeFonte_animeId_season_episodeNumber: {
              animeFonte: fonte,
              animeId,
              season: ep.season,
              episodeNumber: ep.episodeNumber,
            },
          },
          data: {
            globalEpisodeNumber: ep.globalEpisodeNumber,
            name: ep.name,
            airDate: ep.airDate,
            stillPath: ep.stillPath,
          },
        });
      }
      if (toDelete.length > 0) {
        await tx.episode.deleteMany({
          where: {
            animeFonte: fonte,
            animeId,
            OR: toDelete.map((ep) => ({
              season: ep.season,
              episodeNumber: ep.episodeNumber,
            })),
          },
        });
      }

      const changed =
        toCreate.length + toUpdate.length + toDelete.length > 0;
      const snapshot = fetched.map(toSnapshot);

      if (changed || existing.length === 0) {
        const aired = fetched.filter(
          (ep) => ep.season > 0 && ep.airDate && ep.airDate <= now,
        );
        await tx.anime.update({
          where: animeKey(fonte, animeId),
          data: {
            episodesList: snapshot,
            numEpisodiosAired: aired.length,
            ultimoEpisodioEstreadoData:
              aired.length > 0
                ? new Date(Math.max(...aired.map((ep) => ep.airDate!.getTime())))
                : null,
          },
        });
      }

      await this.calendarService.autoTransitionPlannedToWatching(
        fonte,
        animeId,
        snapshot,
        titulo,
        tx,
      );
      const notificationsSent = await this.processAiredInTx(
        tx,
        fonte,
        animeId,
        titulo,
        now,
      );

      return { total: fetched.length, changed, notificationsSent };
    }, TX_OPTIONS);
  }

  /** Trata os episódios de uma obra que estrearam entretanto (cron de notificações). */
  async processAired(
    fonte: MediaSource,
    animeId: number,
  ): Promise<{ notificationsSent: number }> {
    return this.prisma.$transaction(async (tx) => {
      await this.lockAnime(tx, fonte, animeId);
      const anime = await tx.anime.findUnique({
        where: animeKey(fonte, animeId),
        select: { titulo: true },
      });
      if (!anime) return { notificationsSent: 0 };
      const notificationsSent = await this.processAiredInTx(
        tx,
        fonte,
        animeId,
        anime.titulo,
        new Date(),
      );
      return { notificationsSent };
    }, TX_OPTIONS);
  }

  /** As obras com episódios já estreados cuja estreia ainda não foi tratada. */
  async findAnimesWithPendingAired(now: Date = new Date()) {
    return this.prisma.episode.findMany({
      where: { notifiedAt: null, airDate: { lte: now } },
      distinct: ['animeFonte', 'animeId'],
      select: { animeFonte: true, animeId: true },
    });
  }

  // Dentro da transação e do lock da obra: reabre quem a tinha como COMPLETED, cria as
  // notificações e marca os episódios como tratados. Ou acontece tudo, ou nada: um episódio
  // nunca fica marcado sem a notificação ter sido criada, nem é notificado duas vezes.
  // Devolve quantos episódios (sem contar especiais) estrearam.
  private async processAiredInTx(
    tx: Tx,
    fonte: MediaSource,
    animeId: number,
    titulo: string,
    now: Date,
  ): Promise<number> {
    const airedWhere = {
      animeFonte: fonte,
      animeId,
      season: { gt: 0 },
      airDate: { lte: now },
    };
    const aired = await tx.episode.aggregate({
      where: airedWhere,
      _count: { _all: true },
      _max: { airDate: true },
    });
    const airedCount = aired._count._all;

    // Quem tinha a obra como COMPLETED volta a "A ver" quando há episódios estreados por ver.
    // Só contam os já estreados (os anunciados não reabrem a obra) e a condição vai no próprio
    // UPDATE, para não passar por cima de uma alteração feita pelo utilizador entretanto.
    if (airedCount > 0) {
      const reopened = await tx.userAnime.updateMany({
        where: {
          animeFonte: fonte,
          animeId,
          status: 'COMPLETED',
          epAtual: { lt: airedCount },
        },
        data: { status: 'WATCHING', lastProgressUpdate: now },
      });
      if (reopened.count > 0) {
        this.logger.log(
          `[AutoTransition] Moved ${reopened.count} tracking(s) of anime "${titulo}" (${animeId}) from COMPLETED to WATCHING because new episodes aired (${airedCount} aired).`,
        );
      }
    }

    const pendingWhere = {
      animeFonte: fonte,
      animeId,
      notifiedAt: null,
      airDate: { lte: now },
    };
    const pending = await tx.episode.findMany({
      where: pendingWhere,
      orderBy: [{ season: 'asc' }, { episodeNumber: 'asc' }],
      select: { season: true, episodeNumber: true },
    });
    if (pending.length === 0) return 0;

    // Os especiais (temporada 0) ficam marcados mas não geram notificação
    const toNotify = pending.filter((ep) => ep.season > 0);
    if (toNotify.length > 0) {
      const watchers = await tx.userAnime.findMany({
        where: { animeFonte: fonte, animeId, status: 'WATCHING' },
        select: { userId: true, user: { select: { preferences: true } } },
      });

      const notifications: { userId: number; title: string; message: string }[] =
        [];
      for (const ua of watchers) {
        const prefs = ua.user?.preferences as any;
        const notifyWeeklyEpisodes = prefs?.notifyWeeklyEpisodes !== false;
        // Cada notificação substitui a anterior da mesma obra, por isso basta uma por
        // utilizador: a do episódio mais recente que ele quer receber.
        const ep = [...toNotify]
          .reverse()
          .find((e) => e.episodeNumber === 1 || notifyWeeklyEpisodes);
        if (!ep) continue;

        const isPremiere = ep.episodeNumber === 1;
        notifications.push({
          userId: ua.userId,
          title: isPremiere
            ? 'Estreia de Nova Temporada / Série!'
            : 'Novo episódio de Série/Anime!',
          message: isPremiere
            ? `O 1º episódio da Temporada ${ep.season} de "${titulo}" estreou!`
            : `O episódio ${ep.episodeNumber} da Temporada ${ep.season} de "${titulo}" estreou!`,
        });
      }
      await this.notificationService.replaceMany(tx, notifications, 'ANIME', {
        fonte,
        id: animeId,
      });
    }

    await tx.episode.updateMany({
      where: pendingWhere,
      data: { notifiedAt: now },
    });
    await tx.anime.update({
      where: animeKey(fonte, animeId),
      data: {
        numEpisodiosAired: airedCount,
        ultimoEpisodioEstreadoData: aired._max.airDate,
      },
    });

    return toNotify.length;
  }

  /**
   * Cria as linhas da tabela Episode das obras que ainda só têm a lista antiga em JSON.
   * Não toca em obras que já têm linhas, por isso pode correr as vezes que for preciso.
   */
  async backfillFromJson(): Promise<number> {
    const candidates = await this.prisma.anime.findMany({
      where: { fonte: MediaSource.TMDB_TV, episodes: { none: {} } },
      select: { fonte: true, id: true },
    });

    let filled = 0;
    for (const { fonte, id } of candidates) {
      try {
        const done = await this.prisma.$transaction(async (tx) => {
          await this.lockAnime(tx, fonte, id);
          // Outra escrita pode ter criado as linhas entretanto
          const count = await tx.episode.count({
            where: { animeFonte: fonte, animeId: id },
          });
          if (count > 0) return false;

          const anime = await tx.anime.findUnique({
            where: animeKey(fonte, id),
            select: { episodesList: true },
          });
          const legacy = parseLegacyEpisodes(anime?.episodesList);
          if (legacy.length === 0) return false;

          const now = new Date();
          const staleBefore = now.getTime() - BACKFILL_STALE_MS;
          await tx.episode.createMany({
            data: legacy.map(({ notified, ...ep }) => ({
              animeFonte: fonte,
              animeId: id,
              ...ep,
              notifiedAt:
                notified || (ep.airDate && ep.airDate.getTime() < staleBefore)
                  ? now
                  : null,
            })),
            skipDuplicates: true,
          });
          return true;
        }, TX_OPTIONS);
        if (done) filled++;
      } catch (err) {
        this.logger.error(
          `Error backfilling episodes of anime ${fonte}:${id}:`,
          err,
        );
      }
    }

    if (filled > 0) {
      this.logger.log(
        `Episode table backfilled from the JSON lists of ${filled} anime(s).`,
      );
    }
    return filled;
  }
}
