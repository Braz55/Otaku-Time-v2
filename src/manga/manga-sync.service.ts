import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnilistMangaService } from './anilist-manga.service';
import { NotificationService } from '../notification/notification.service';
import { fetchJson, FetchRetryOptions } from '../common/http-client';
import { CircuitOpenError, circuitBreaker } from '../common/circuit-breaker';
import { KeyedMutex } from '../common/keyed-mutex';
import { SyncTransientError, toSyncError } from '../common/sync-errors';
import { syncFailureData, syncSuccessData } from '../common/sync-state';

type ChapterBreakdown = { label: string; chapters: number }[];

export interface ChapterSyncResult {
  latest: number | null;
  error?: string;
  source?: string;
  breakdown?: ChapterBreakdown;
}

const MANGAUPDATES_API = 'https://api.mangaupdates.com/v1';
const MANGADEX_API = 'https://api.mangadex.org';
const MANGADEX_INIT: RequestInit = {
  headers: { 'User-Agent': 'OtakuTimeBot/1.0' },
};
// Timeout de 10s por tentativa; repete uma vez em falhas de rede, 429 e 5xx
const MANGAUPDATES_HTTP: FetchRetryOptions = {
  retries: 2,
  breaker: 'mangaupdates',
};
const MANGADEX_HTTP: FetchRetryOptions = { retries: 2, breaker: 'mangadex' };

const cleanTitle = (s: string) =>
  s
    ? s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .trim()
    : '';

const errorMessage = (err: unknown) =>
  err instanceof Error ? err.message : String(err);

const isNotFound = (err: unknown) =>
  (err as { status?: number } | null)?.status === 404;

@Injectable()
export class MangaSyncService {
  // Uma sincronização de cada vez por manga (agendada, importação e pedido da app)
  private readonly mangaLocks = new KeyedMutex();

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => AnilistMangaService))
    private readonly anilistMangaService: AnilistMangaService,
    private readonly notificationService: NotificationService,
  ) {}

  // PLAN A: Baka-Updates (MangaUpdates)
  // `knownSeriesId` é o ID guardado de uma sincronização anterior: evita a pesquisa por título.
  // `error` vem preenchido quando a fonte falhou (diferente de "não tem capítulos").
  async getLatestChapterFromBakaUpdates(
    title: string,
    mangaObj?: any,
    knownSeriesId?: string | null,
  ): Promise<{
    chapter: number | null;
    breakdown?: ChapterBreakdown;
    seriesId?: string;
    error?: string;
  }> {
    try {
      let seriesId = knownSeriesId || null;
      if (!seriesId) {
        seriesId = await this.findBakaUpdatesSeries(title, mangaObj);
        if (!seriesId) return { chapter: null };
      }

      let detailData: any;
      try {
        detailData = await fetchJson(
          `${MANGAUPDATES_API}/series/${seriesId}`,
          {},
          MANGAUPDATES_HTTP,
        );
      } catch (err) {
        if (knownSeriesId && isNotFound(err)) {
          // O ID guardado deixou de existir: volta a procurar pelo título
          return this.getLatestChapterFromBakaUpdates(title, mangaObj, null);
        }
        throw err;
      }

      if (!detailData?.status) return { chapter: null, seriesId };

      console.log(`[Plan A] Raw status:`, detailData.status);
      const { chapter, breakdown } = this.parseBakaUpdatesStatus(
        detailData.status,
      );

      if (chapter > 0) {
        console.log(`[Plan A] Success for "${title}": ${chapter} chapters.`);
        return { chapter, breakdown, seriesId };
      }

      console.log(
        `[Plan A] Status text mentions Volumes or is inconclusive (returned 0).`,
      );
      return { chapter: null, seriesId };
    } catch (error) {
      console.error('[Plan A] Error:', errorMessage(error));
      return {
        chapter: null,
        error: `Baka-Updates failed (${errorMessage(error)})`,
      };
    }
  }

  // Pesquisa a obra por título no Baka-Updates. Devolve o ID da série ou null se não houver
  // um resultado que corresponda ao título.
  private async findBakaUpdatesSeries(
    title: string,
    mangaObj?: any,
  ): Promise<string | null> {
    console.log(`[Plan A] Searching "${title}" on Baka-Updates...`);

    const search = (limit: number) =>
      fetchJson(
        `${MANGAUPDATES_API}/series/search`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ search: title, limit }),
        },
        MANGAUPDATES_HTTP,
      );

    const searchData = await search(1);
    if (!searchData.results || searchData.results.length === 0) return null;

    let bestRecord = searchData.results[0].record;

    if (bestRecord?.type?.toLowerCase() === 'novel') {
      console.log(
        `[Plan A] "${bestRecord.title}" is a Novel. Searching for Manhwa/Manga adaptation...`,
      );
      const fallbackData = await search(5);
      const nonNovel = (fallbackData.results || []).find(
        (r: any) => r.record?.type?.toLowerCase() !== 'novel',
      );
      if (nonNovel) bestRecord = nonNovel.record;
    }

    const mainTitles = [title, mangaObj?.title?.english, mangaObj?.title?.romaji]
      .filter(Boolean)
      .map(cleanTitle);
    const recTitle = cleanTitle(bestRecord.title);

    const isValid = mainTitles.some((t) => {
      if (recTitle === t) return true;
      if (recTitle.includes(t) || t.includes(recTitle)) {
        return Math.abs(recTitle.length - t.length) <= 5;
      }
      return false;
    });

    if (!isValid) {
      console.log(
        `[Plan A] Ignored result: "${bestRecord.title}" does not match "${title}".`,
      );
      return null;
    }

    console.log(
      `[Plan A] Candidate: "${bestRecord.title}" (Type: ${bestRecord.type})`,
    );
    return String(bestRecord.series_id);
  }

  // Extrai o número de capítulos do texto livre do campo `status` do Baka-Updates
  // (ex.: "15 Chapters (Complete)" ou blocos por temporada). Devolve 0 se for inconclusivo.
  private parseBakaUpdatesStatus(status: string): {
    chapter: number;
    breakdown: ChapterBreakdown;
  } {
    const validLines = status
      .split(/\n/)
      .filter((line: string) => !/(?:novel|original|orig\b)/i.test(line));

    const breakdown: ChapterBreakdown = [];
    for (const line of validLines) {
      const m = line.match(
        /\*\*(.+?)\*\*\s*:?\s*(\d+)\s+Chapters?|^([^:]+):\s*(\d+)\s+Chapters?/i,
      );
      if (m) {
        const rawLabel = (m[1] || m[3]).trim();
        const label = rawLabel.replace(/\*/g, '').replace(/:$/, '').trim();
        breakdown.push({ label, chapters: parseInt(m[2] || m[4]) });
      }
    }

    if (breakdown.length > 0) {
      const sum = breakdown.reduce((acc, item) => acc + item.chapters, 0);
      console.log(`[Plan A] Labeled blocks:`, breakdown, `-> Sum: ${sum}`);
      return { chapter: sum, breakdown };
    }

    const cleanStr = validLines.join(' ');
    const chMatches = [...cleanStr.matchAll(/(\d+)\s+Chapters?/gi)];
    const maxFromCh =
      chMatches.length > 0
        ? Math.max(...chMatches.map((m) => parseInt(m[1])))
        : 0;
    const rangeMatches = [...cleanStr.matchAll(/[-~]\s*(\d+)\b/g)];
    const maxFromRange =
      rangeMatches.length > 0
        ? Math.max(...rangeMatches.map((m) => parseInt(m[1])))
        : 0;
    return { chapter: Math.max(maxFromCh, maxFromRange), breakdown };
  }

  // Sincroniza os capítulos de um manga. Corre uma de cada vez por manga.
  // Com `throwOnFailure` (sincronização agendada) uma falha da fonte lança erro, para não
  // contar como sucesso; sem isso (pedidos da app) vem descrita em `error`.
  async syncLatestChapter(
    anilistId: number,
    options: { throwOnFailure?: boolean } = {},
  ): Promise<ChapterSyncResult> {
    return this.mangaLocks.run(String(anilistId), async () => {
      const existe = await this.prisma.manga.findUnique({
        where: { id: anilistId },
      });

      try {
        const result = await this.runChapterSync(anilistId, existe);
        if (existe) {
          await this.prisma.manga.update({
            where: { id: anilistId },
            data: syncSuccessData(),
          });
        }
        return result;
      } catch (err) {
        const syncError = toSyncError(err);
        // Fornecedor em pausa: a obra não tem culpa, não se regista falha nela
        if (existe && !(syncError instanceof CircuitOpenError)) {
          await this.prisma.manga
            .update({
              where: { id: anilistId },
              data: syncFailureData(syncError, existe.syncFailures),
            })
            .catch((e) =>
              console.error(
                `[Sync] Error recording sync failure for manga ${anilistId}:`,
                e,
              ),
            );
        }
        if (options.throwOnFailure) throw syncError;
        return { latest: null, error: syncError.message };
      }
    });
  }

  private async runChapterSync(
    anilistId: number,
    existe: {
      titulo: string;
      numCapitulosTotal: number | null;
      mangaUpdatesId: string | null;
      mangaDexId: string | null;
    } | null,
  ): Promise<ChapterSyncResult> {
    // Lança SyncNotFoundError se a obra não existe e SyncTransientError se a AniList falhou
    const manga =
      await this.anilistMangaService.fetchAniListMangaById(anilistId);
    const title = manga.title.english || manga.title.romaji;

    let latest: number | null = null;
    let errorMsg: string | undefined;
    let source = 'AniList';
    let breakdown: ChapterBreakdown = [];

    console.log(`[Sync] Consulting Baka-Updates (Plan A) for "${title}"...`);
    const bakaRes = await this.getLatestChapterFromBakaUpdates(
      title,
      manga,
      existe?.mangaUpdatesId,
    );
    if (bakaRes.chapter) {
      latest = bakaRes.chapter;
      breakdown = bakaRes.breakdown || [];
      source = 'Baka-Updates';
    }

    // Numa obra terminada a contagem da AniList é a de referência (pode corrigir para baixo)
    let authoritative = false;
    if (manga.status === 'FINISHED' && manga.chapters && manga.chapters > 0) {
      if (!latest || manga.chapters > latest) {
        console.log(
          `[Sync] AniList has more chapters (${manga.chapters}) than external source (${latest || 0}). Using AniList chapters.`,
        );
        latest = manga.chapters;
        source = 'AniList';
        breakdown = [];
        authoritative = true;
      }
    }

    let mangaDexId: string | undefined;
    if (!latest) {
      console.log(
        `[Sync] Baka-Updates did not provide a valid chapter count for "${title}" and not finished on AniList. Switching to MangaDex (Plan B)...`,
      );
      const mdResult = await this.getLatestChapterFromMangaDex(
        anilistId,
        title,
        manga,
        existe?.mangaDexId,
      );
      latest = mdResult.chapter;
      errorMsg = mdResult.error;
      mangaDexId = mdResult.mangaDexId;
      if (latest) {
        source = 'MangaDex';
      } else if (mdResult.error) {
        // A última fonte disponível falhou: não se sabe se há capítulos novos.
        // Se foi por o MangaDex estar em pausa, a obra é só adiada (não conta como falha).
        const pausedUntil = circuitBreaker('mangadex').retryAt;
        if (pausedUntil) throw new CircuitOpenError('mangadex', pausedUntil);
        throw new SyncTransientError(
          [bakaRes.error, mdResult.error].filter(Boolean).join('; '),
        );
      }
    }

    if (!existe) {
      if (latest) {
        console.log(
          `[Sync] Manga "${title}" (ID ${anilistId}) is an external item not saved in local DB. Progress obtained: ${latest} (${source})`,
        );
      }
      return { latest, error: errorMsg, source, breakdown };
    }

    // IDs das fontes: guardados para a próxima sincronização não repetir a pesquisa por título
    const updateData: any = {};
    if (bakaRes.seriesId && bakaRes.seriesId !== existe.mangaUpdatesId) {
      updateData.mangaUpdatesId = bakaRes.seriesId;
    }
    if (mangaDexId && mangaDexId !== existe.mangaDexId) {
      updateData.mangaDexId = mangaDexId;
    }

    if (latest) {
      const oldLatest = existe.numCapitulosTotal || 0;

      if (latest > oldLatest) {
        await this.advanceChapterTotal(anilistId, existe.titulo, latest);
      }

      // O total nunca desce por uma fonte dar um número mais baixo (as fontes alternam e o
      // match por título pode falhar). Só a contagem final da AniList corrige para baixo.
      const total = authoritative ? latest : Math.max(oldLatest, latest);
      updateData.numCapitulosTotal = total;
      updateData.statusLancamento = manga.status;
      updateData.proximoCapituloNumero =
        manga.status === 'RELEASING' ? total + 1 : null;
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.manga.update({
        where: { id: anilistId },
        data: updateData,
      });
    }

    return { latest, error: errorMsg, source, breakdown };
  }

  // Há um capítulo novo. Numa só transação: o total avança, quem tinha a obra como COMPLETED
  // volta a "A ler" e quem a está a ler é avisado. O total só avança se ainda estiver abaixo
  // do novo valor, e essa condição vai no próprio UPDATE: se duas execuções chegarem aqui ao
  // mesmo tempo, só uma "ganha" e as notificações saem uma única vez.
  private async advanceChapterTotal(
    mangaId: number,
    titulo: string,
    latest: number,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const advanced = await tx.manga.updateMany({
        where: {
          id: mangaId,
          OR: [
            { numCapitulosTotal: null },
            { numCapitulosTotal: { lt: latest } },
          ],
        },
        data: { numCapitulosTotal: latest },
      });
      if (advanced.count === 0) return;

      const reopened = await tx.userManga.updateMany({
        where: { mangaId, status: 'COMPLETED', capAtual: { lt: latest } },
        data: { status: 'WATCHING', lastProgressUpdate: new Date() },
      });
      if (reopened.count > 0) {
        console.log(
          `[AutoTransition] Moved ${reopened.count} tracking(s) of manga "${titulo}" (${mangaId}) from COMPLETED to WATCHING because new chapters were detected (up to ${latest}).`,
        );
      }

      const readers = await tx.userManga.findMany({
        where: { mangaId, status: 'WATCHING' },
        select: { userId: true },
      });
      await this.notificationService.replaceMany(
        tx,
        readers.map((um) => ({
          userId: um.userId,
          title: 'Novo capítulo de Mangá!',
          message: `O capítulo ${latest} de "${titulo}" foi lançado!`,
        })),
        'MANGA',
        { fonte: 'ANILIST', id: mangaId },
      );
    });
  }

  // PLAN B: MangaDex
  // `knownMangaDexId` é o ID guardado de uma sincronização anterior. O ID devolvido só vem
  // preenchido quando a correspondência é exata (ligação ao ID da AniList).
  async getLatestChapterFromMangaDex(
    anilistId: number,
    title: string,
    mangaObj?: any,
    knownMangaDexId?: string | null,
  ): Promise<{ chapter: number | null; error?: string; mangaDexId?: string }> {
    try {
      let match: any = null;
      let exact = false;

      if (knownMangaDexId) {
        try {
          const known = await fetchJson(
            `${MANGADEX_API}/manga/${knownMangaDexId}`,
            MANGADEX_INIT,
            MANGADEX_HTTP,
          );
          match = known?.data ?? null;
          exact = !!match;
        } catch (err) {
          // Um 404 quer dizer que o ID guardado deixou de existir: procura-se outra vez
          if (!isNotFound(err)) throw err;
        }
      }

      if (!match) {
        ({ match, exact } = await this.findMangaDexManga(
          anilistId,
          title,
          mangaObj,
        ));
      }
      if (!match) return { chapter: null };

      const mangaDexId: string | undefined = exact ? match.id : undefined;

      console.log(
        `[Plan B] Fetching latest chapter feed and metadata for MangaDex ID: ${match.id}...`,
      );

      let metaLastChapter = 0;
      if (match.attributes?.lastChapter) {
        const parsed = parseFloat(match.attributes.lastChapter);
        if (!isNaN(parsed) && parsed > 0) {
          metaLastChapter = parsed;
          console.log(
            `[Plan B] Found official lastChapter attribute in MangaDex metadata: ${metaLastChapter}`,
          );
        }
      }

      let feedData: any;
      try {
        feedData = await fetchJson(
          `${MANGADEX_API}/manga/${match.id}/feed?limit=10&order[chapter]=desc`,
          MANGADEX_INIT,
          MANGADEX_HTTP,
        );
      } catch (err) {
        console.error(`[Plan B] MangaDex feed error: ${errorMessage(err)}`);
        return {
          chapter: metaLastChapter > 0 ? metaLastChapter : null,
          error: this.mangaDexErrorMessage(err),
          mangaDexId,
        };
      }

      let feedMaxChapter = 0;
      if (feedData.data && feedData.data.length > 0) {
        const chapters = feedData.data
          .map((item: any) => parseFloat(item.attributes.chapter))
          .filter((ch: any) => !isNaN(ch) && ch > 0);

        if (chapters.length > 0) {
          feedMaxChapter = Math.max(...chapters);
          console.log(
            `[Plan B] Found max chapter in MangaDex feed (across all languages): ${feedMaxChapter}`,
          );
        }
      }

      const finalChapter = Math.max(metaLastChapter, feedMaxChapter);
      if (finalChapter > 0) {
        console.log(
          `[Plan B] Success for "${title}": Chapter ${finalChapter} found on MangaDex.`,
        );
        return { chapter: finalChapter, mangaDexId };
      }

      console.log(
        `[Plan B] MangaDex returned no valid chapter number in metadata or feed for "${title}".`,
      );
      return { chapter: null, mangaDexId };
    } catch (error) {
      console.error('[Plan B] Error consulting MangaDex:', errorMessage(error));
      return { chapter: null, error: this.mangaDexErrorMessage(error) };
    }
  }

  // Pesquisa a obra no MangaDex: primeiro pela ligação ao ID da AniList (exata), depois por
  // correspondência de título.
  private async findMangaDexManga(
    anilistId: number,
    title: string,
    mangaObj?: any,
  ): Promise<{ match: any; exact: boolean }> {
    console.log(
      `[Plan B] Searching "${title}" on MangaDex (AniList ID: ${anilistId})...`,
    );
    const data = await fetchJson(
      `${MANGADEX_API}/manga?title=${encodeURIComponent(title)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`,
      MANGADEX_INIT,
      MANGADEX_HTTP,
    );

    if (!data.data || data.data.length === 0) {
      console.log(`[Plan B] No results found on MangaDex for "${title}".`);
      return { match: null, exact: false };
    }

    const nameOf = (m: any) =>
      m.attributes.title?.en ||
      m.attributes.title?.['ja-ro'] ||
      m.attributes.title?.ja ||
      'Unknown';

    const byId = data.data.find(
      (m: any) => m.attributes.links?.al == anilistId.toString(),
    );
    if (byId) {
      console.log(
        `[Plan B] Found exact AniList ID match on MangaDex: "${nameOf(byId)}" (ID: ${byId.id})`,
      );
      return { match: byId, exact: true };
    }

    const mainTitles = [title, mangaObj?.title?.english, mangaObj?.title?.romaji]
      .filter(Boolean)
      .map(cleanTitle);

    const byTitle = data.data.find((m: any) => {
      const mdTitles = [
        m.attributes.title?.en,
        m.attributes.title?.['ja-ro'],
        m.attributes.title?.ja,
        ...(m.attributes.altTitles || []).map((t: any) => Object.values(t)[0]),
      ]
        .filter(Boolean)
        .map((t) => cleanTitle(t as string));

      return mainTitles.some((mt) =>
        mdTitles.some(
          (mdt) =>
            mdt === mt ||
            (mdt.includes(mt) && Math.abs(mdt.length - mt.length) <= 5),
        ),
      );
    });

    if (byTitle) {
      console.log(
        `[Plan B] Found title fallback match on MangaDex: "${nameOf(byTitle)}" (ID: ${byTitle.id})`,
      );
    } else {
      console.log(
        `[Plan B] All candidates rejected: No AniList ID or Title match for "${title}".`,
      );
    }
    return { match: byTitle ?? null, exact: false };
  }

  private mangaDexErrorMessage(err: unknown): string {
    const status = (err as { status?: number } | null)?.status;
    if (status === 502 || status === 503 || status === 504) {
      return `MangaDex servers offline (Error ${status})`;
    }
    if (status) return `MangaDex failed (Error ${status})`;
    return 'Error connecting to MangaDex';
  }
}
