import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MangaService } from './manga.service';
import { AnilistMangaService } from './anilist-manga.service';

@Injectable()
export class MangaSyncService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => MangaService))
    private readonly mangaService: MangaService,
    @Inject(forwardRef(() => AnilistMangaService))
    private readonly anilistMangaService: AnilistMangaService,
  ) {}

  // PLAN A: Baka-Updates (MangaUpdates)
  async getLatestChapterFromBakaUpdates(
    title: string,
    mangaObj?: any,
  ): Promise<{
    chapter: number | null;
    breakdown?: { label: string; chapters: number }[];
  }> {
    try {
      console.log(`[Plan A] Searching "${title}" on Baka-Updates...`);

      const searchRes = await fetch(
        'https://api.mangaupdates.com/v1/series/search',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ search: title, limit: 1 }),
        },
      );
      const searchData = await searchRes.json();

      if (!searchData.results || searchData.results.length === 0)
        return { chapter: null };

      let bestRecord = searchData.results[0].record;

      if (bestRecord?.type?.toLowerCase() === 'novel') {
        console.log(
          `[Plan A] "${bestRecord.title}" is a Novel. Searching for Manhwa/Manga adaptation...`,
        );
        const fallbackRes = await fetch(
          'https://api.mangaupdates.com/v1/series/search',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ search: title, limit: 5 }),
          },
        );
        const fallbackData = await fallbackRes.json();
        if (fallbackData.results) {
          const nonNovel = fallbackData.results.find(
            (r: any) => r.record?.type?.toLowerCase() !== 'novel',
          );
          if (nonNovel) bestRecord = nonNovel.record;
        }
      }

      const clean = (s: string) =>
        s
          ? s
              .toLowerCase()
              .replace(/[^\w\s]/g, '')
              .trim()
          : '';
      const mainTitles = [
        title,
        mangaObj?.title?.english,
        mangaObj?.title?.romaji,
      ]
        .filter(Boolean)
        .map(clean);
      const recTitle = clean(bestRecord.title);

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
        return { chapter: null };
      }

      console.log(
        `[Plan A] Candidate: "${bestRecord.title}" (Type: ${bestRecord.type})`,
      );

      const seriesId = bestRecord.series_id;
      const detailRes = await fetch(
        `https://api.mangaupdates.com/v1/series/${seriesId}`,
      );
      const detailData = await detailRes.json();

      if (!detailData?.status) return { chapter: null };

      console.log(`[Plan A] Raw status:`, detailData.status);

      const rawLines = detailData.status.split(/\n/);
      const validLines = rawLines.filter(
        (line: string) => !/(?:novel|original|orig\b)/i.test(line),
      );

      const breakdown: { label: string; chapters: number }[] = [];
      for (const line of validLines) {
        const m = line.match(
          /\*\*(.+?)\*\*\s*:?\s*(\d+)\s+Chapters?|^([^:]+):\s*(\d+)\s+Chapters?/i,
        );
        if (m) {
          const rawLabel = (m[1] || m[3]).trim();
          const label = rawLabel.replace(/\*/g, '').replace(/:$/, '').trim();
          const ch = parseInt(m[2] || m[4]);
          breakdown.push({ label, chapters: ch });
        }
      }

      let result = 0;

      if (breakdown.length > 0) {
        result = breakdown.reduce((acc, item) => acc + item.chapters, 0);
        console.log(`[Plan A] Labeled blocks:`, breakdown, `-> Sum: ${result}`);
      } else {
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
        result = Math.max(maxFromCh, maxFromRange);
        if (result === 0) {
          console.log(
            `[Plan A] Status text mentions Volumes or is inconclusive (returned 0).`,
          );
        } else {
          console.log(
            `[Plan A] No labeled blocks, numeric fallback: ${result}`,
          );
        }
      }

      if (result > 0) {
        console.log(`[Plan A] Success for "${title}": ${result} chapters.`);
        return { chapter: result, breakdown };
      }

      return { chapter: null };
    } catch (error) {
      console.error('[Plan A] Error:', error);
      return { chapter: null };
    }
  }

  async syncLatestChapter(anilistId: number): Promise<{
    latest: number | null;
    error?: string;
    source?: string;
    breakdown?: { label: string; chapters: number }[];
  }> {
    const manga = await this.anilistMangaService.searchAniListById(anilistId);
    if (!manga) return { latest: null };
    const title = manga.title.english || manga.title.romaji;

    let latest: number | null = null;
    let errorMsg: string | undefined;
    let source = 'AniList';
    let breakdown: { label: string; chapters: number }[] = [];

    console.log(`[Sync] Consulting Baka-Updates (Plan A) for "${title}"...`);
    const bakaRes = await this.getLatestChapterFromBakaUpdates(title, manga);
    if (bakaRes && bakaRes.chapter) {
      latest = bakaRes.chapter;
      breakdown = bakaRes.breakdown || [];
      source = 'Baka-Updates';
    }

    if (manga.status === 'FINISHED' && manga.chapters && manga.chapters > 0) {
      if (!latest || manga.chapters > latest) {
        console.log(
          `[Sync] AniList has more chapters (${manga.chapters}) than external source (${latest || 0}). Using AniList chapters.`,
        );
        latest = manga.chapters;
        source = 'AniList';
        breakdown = [];
      }
    }

    if (!latest) {
      console.log(
        `[Sync] Baka-Updates did not provide a valid chapter count for "${title}" (returned 0) and not finished on AniList. Switching to MangaDex (Plan B)...`,
      );
      const mdResult = await this.getLatestChapterFromMangaDex(
        anilistId,
        title,
        manga,
      );
      latest = mdResult.chapter;
      errorMsg = mdResult.error;
      if (latest) {
        source = 'MangaDex';
      }
    }

    if (latest) {
      const existe = await this.prisma.manga.findUnique({
        where: { id: anilistId },
      });
      if (existe) {
        const oldLatest = existe.numCapitulosTotal || 0;
        if (latest > oldLatest) {
          const userMangas = await this.prisma.userManga.findMany({
            where: {
              mangaId: anilistId,
              status: 'WATCHING',
            },
          });

          for (const um of userMangas) {
            await this.prisma.notification.create({
              data: {
                userId: um.userId,
                title: 'Novo capítulo de Mangá!',
                message: `O capítulo ${latest} de "${existe.titulo}" foi lançado!`,
                type: 'MANGA',
                mediaId: anilistId,
              },
            });
          }
        }

        const updateData: any = { numCapitulosTotal: latest };
        if (existe.statusLancamento === 'RELEASING') {
          updateData.proximoCapituloNumero = latest + 1;
        }
        await this.prisma.manga.update({
          where: { id: anilistId },
          data: updateData,
        });
      } else {
        console.log(
          `[Sync] Manga "${title}" (ID ${anilistId}) is an external item not saved in local DB. Progress obtained: ${latest} (${source})`,
        );
      }
    }

    return { latest, error: errorMsg, source, breakdown };
  }

  async getLatestChapterFromMangaDex(
    anilistId: number,
    title: string,
    mangaObj?: any,
  ): Promise<{ chapter: number | null; error?: string }> {
    try {
      console.log(
        `[Plan B] Searching "${title}" on MangaDex (AniList ID: ${anilistId})...`,
      );
      const mdUrl = `https://api.mangadex.org/manga?title=${encodeURIComponent(title)}&limit=10&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
      const response = await fetch(mdUrl, {
        headers: { 'User-Agent': 'OtakuTimeBot/1.0' },
      });

      if (!response.ok) {
        console.error(`[Plan B] MangaDex HTTP Error: ${response.status}`);
        if (
          response.status === 503 ||
          response.status === 502 ||
          response.status === 504
        ) {
          return {
            chapter: null,
            error: `MangaDex servers offline (Error ${response.status})`,
          };
        }
        return {
          chapter: null,
          error: `MangaDex failed (Error ${response.status})`,
        };
      }

      const data = await response.json();

      if (!data.data || data.data.length === 0) {
        console.log(`[Plan B] No results found on MangaDex for "${title}".`);
        return { chapter: null };
      }

      console.log(
        `[Plan B] MangaDex returned ${data.data.length} candidates. Checking AniList ID (${anilistId}) or Title match...`,
      );

      let match = data.data.find(
        (m: any) => m.attributes.links?.al == anilistId.toString(),
      );

      if (match) {
        console.log(
          `[Plan B] Found exact AniList ID match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`,
        );
      } else {
        console.log(
          `[Plan B] No direct AniList ID match found in links. Attempting title fallback match...`,
        );
        const clean = (s: string) =>
          s
            ? s
                .toLowerCase()
                .replace(/[^\w\s]/g, '')
                .trim()
            : '';
        const mainTitles = [
          title,
          mangaObj?.title?.english,
          mangaObj?.title?.romaji,
        ]
          .filter(Boolean)
          .map(clean);

        match = data.data.find((m: any) => {
          const mdTitles = [
            m.attributes.title?.en,
            m.attributes.title?.['ja-ro'],
            m.attributes.title?.ja,
            ...(m.attributes.altTitles || []).map(
              (t: any) => Object.values(t)[0],
            ),
          ]
            .filter(Boolean)
            .map((t) => clean(t as string));

          return mainTitles.some((mt) =>
            mdTitles.some(
              (mdt) =>
                mdt === mt ||
                (mdt.includes(mt) && Math.abs(mdt.length - mt.length) <= 5),
            ),
          );
        });

        if (match) {
          console.log(
            `[Plan B] Found title fallback match on MangaDex: "${match.attributes.title?.en || match.attributes.title?.['ja-ro'] || match.attributes.title?.ja || 'Unknown'}" (ID: ${match.id})`,
          );
        } else {
          console.log(
            `[Plan B] All candidates rejected: No AniList ID or Title match for "${title}".`,
          );
        }
      }

      if (match) {
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

        const feedRes = await fetch(
          `https://api.mangadex.org/manga/${match.id}/feed?limit=10&order[chapter]=desc`,
          {
            headers: { 'User-Agent': 'OtakuTimeBot/1.0' },
          },
        );

        if (!feedRes.ok) {
          console.error(`[Plan B] MangaDex feed HTTP Error: ${feedRes.status}`);
          if (
            feedRes.status === 503 ||
            feedRes.status === 502 ||
            feedRes.status === 504
          ) {
            return {
              chapter: metaLastChapter > 0 ? metaLastChapter : null,
              error: `MangaDex servers offline (Error ${feedRes.status})`,
            };
          }
          return {
            chapter: metaLastChapter > 0 ? metaLastChapter : null,
            error: `MangaDex failed (Error ${feedRes.status})`,
          };
        }

        const feedData = await feedRes.json();
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
          return { chapter: finalChapter };
        } else {
          console.log(
            `[Plan B] MangaDex returned no valid chapter number in metadata or feed for "${title}".`,
          );
        }
      }
      return { chapter: null };
    } catch (error) {
      console.error('[Plan B] Error consulting MangaDex:', error);
      return { chapter: null, error: 'Error connecting to MangaDex' };
    }
  }
}
