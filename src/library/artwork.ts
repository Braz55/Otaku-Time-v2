// Capa e banner personalizados (L-15): a escolha do utilizador fica na sua entrada
// (UserAnime/UserManga) e só se mostra a do catálogo global quando não há escolha.

interface PersonalArtwork {
  capaPersonalizada?: string | null;
  bannerPersonalizado?: string | null;
}

interface CatalogArtwork {
  capaUrl?: string | null;
  bannerUrl?: string | null;
}

/** Capa/banner a mostrar: a pessoal, se existir; senão a do catálogo. */
export function resolveArtwork(entry: PersonalArtwork, catalog: CatalogArtwork) {
  return {
    capaUrl: entry.capaPersonalizada || catalog.capaUrl || null,
    bannerUrl: entry.bannerPersonalizado || catalog.bannerUrl || null,
  };
}

/**
 * Converte `capaUrl`/`bannerUrl` de um pedido de atualização nos campos da entrada.
 * Uma string vazia ou null repõe a imagem do catálogo.
 */
export function artworkUpdateData(dto: CatalogArtwork): PersonalArtwork {
  const data: PersonalArtwork = {};
  if (dto.capaUrl !== undefined) data.capaPersonalizada = dto.capaUrl || null;
  if (dto.bannerUrl !== undefined) data.bannerPersonalizado = dto.bannerUrl || null;
  return data;
}
