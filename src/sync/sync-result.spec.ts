import { decidirEstadoSync, descreverSync, SyncOutcome } from './sync-result';

const falha = (id: number) => ({ id, titulo: `Obra ${id}`, erro: 'boom' });

describe('sync-result (L-22)', () => {
  it('SUCCESS quando nenhuma obra falha', () => {
    expect(decidirEstadoSync({ total: 3, sincronizadas: 3, falhas: [] })).toBe('SUCCESS');
  });

  it('SUCCESS quando não havia obras para sincronizar', () => {
    expect(decidirEstadoSync({ total: 0, sincronizadas: 0, falhas: [] })).toBe('SUCCESS');
  });

  it('PARTIAL quando só algumas obras falham', () => {
    expect(
      decidirEstadoSync({ total: 3, sincronizadas: 2, falhas: [falha(1)] }),
    ).toBe('PARTIAL');
  });

  it('FAILED quando todas as obras falham', () => {
    expect(
      decidirEstadoSync({ total: 2, sincronizadas: 0, falhas: [falha(1), falha(2)] }),
    ).toBe('FAILED');
  });

  it('descreve as falhas nos detalhes, com limite', () => {
    const falhas = Array.from({ length: 12 }, (_, i) => falha(i + 1));
    const outcome: SyncOutcome = { total: 20, sincronizadas: 8, falhas };
    const msg = descreverSync('[ANIME_ACTIVE]', 'animes', outcome);
    expect(msg).toContain('[ANIME_ACTIVE] Synced 8/20 animes.');
    expect(msg).toContain('12 failed');
    expect(msg).toContain('"Obra 10" (10): boom');
    expect(msg).not.toContain('"Obra 11"');
    expect(msg).toContain('(+2 more)');
  });

  it('sem falhas não acrescenta lista', () => {
    expect(
      descreverSync('[MANGA_FULL]', 'mangas', { total: 5, sincronizadas: 5, falhas: [] }),
    ).toBe('[MANGA_FULL] Synced 5/5 mangas.');
  });
});
