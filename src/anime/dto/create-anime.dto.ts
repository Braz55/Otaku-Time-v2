export class CreateAnimeDto {
  titulo!: string;
  statusLancamento!: string;
  generos!: any;
  userId!: number;

  // Campos opcionais (com ?) não precisam do !
  capaUrl?: string;
  descricao?: string;
  dataLancamento?: Date;
  numTemporadas?: number;
  numEpisodiosTotal?: number;
  statusVisualizacao?: string;
  epAtual?: number;
  temporada?: string;
  ano?: number;
}
