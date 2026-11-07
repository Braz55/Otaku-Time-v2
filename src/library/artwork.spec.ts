import { artworkUpdateData, resolveArtwork } from './artwork';

describe('artwork (L-15)', () => {
  const catalogo = { capaUrl: 'global-capa', bannerUrl: 'global-banner' };

  it('mostra a capa/banner do catálogo quando não há escolha pessoal', () => {
    expect(resolveArtwork({}, catalogo)).toEqual({
      capaUrl: 'global-capa',
      bannerUrl: 'global-banner',
    });
  });

  it('a escolha pessoal tem prioridade sobre o catálogo', () => {
    expect(
      resolveArtwork(
        { capaPersonalizada: 'minha-capa', bannerPersonalizado: null },
        catalogo,
      ),
    ).toEqual({ capaUrl: 'minha-capa', bannerUrl: 'global-banner' });
  });

  it('converte capaUrl/bannerUrl do pedido em campos da entrada', () => {
    expect(artworkUpdateData({ capaUrl: 'x' })).toEqual({
      capaPersonalizada: 'x',
    });
    expect(artworkUpdateData({ bannerUrl: 'y' })).toEqual({
      bannerPersonalizado: 'y',
    });
    expect(artworkUpdateData({})).toEqual({});
  });

  it('string vazia ou null repõe a imagem do catálogo', () => {
    expect(artworkUpdateData({ capaUrl: '', bannerUrl: null })).toEqual({
      capaPersonalizada: null,
      bannerPersonalizado: null,
    });
  });
});
