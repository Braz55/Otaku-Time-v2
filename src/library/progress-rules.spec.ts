import { BadRequestException } from '@nestjs/common';
import { aplicarRegrasDeProgresso, DadosObra } from './progress-rules';

const AGORA = new Date('2026-11-04T12:00:00Z');

// Anime terminado com 12 episódios
const animeTerminado: DadosObra = {
  terminada: true,
  total: 12,
  ultimoDisponivel: 12,
  limiteLancado: 12,
  limitarAoTotal: true,
};

// Anime em emissão: 24 previstos, 8 já lançados
const animeEmEmissao: DadosObra = {
  terminada: false,
  total: 8,
  ultimoDisponivel: 8,
  limiteLancado: 8,
  limitarAoTotal: true,
};

// Manga terminado com 100 capítulos (contagem pode estar desatualizada)
const mangaTerminado: DadosObra = {
  terminada: true,
  total: 100,
  ultimoDisponivel: 100,
  limiteLancado: null,
  limitarAoTotal: false,
};

describe('aplicarRegrasDeProgresso', () => {
  describe('RN-01: PLANNED passa a WATCHING ao começar', () => {
    it('muda para WATCHING quando o progresso passa de 0', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'PLANNED', progresso: 0 },
        animeTerminado,
        { progresso: 1 },
        AGORA,
      );
      expect(r.status).toBe('WATCHING');
      expect(r.progresso).toBe(1);
    });

    it('mantém PLANNED quando o progresso fica a 0', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'PLANNED', progresso: 0 },
        animeTerminado,
        { progresso: 0 },
        AGORA,
      );
      expect(r.status).toBeUndefined();
    });
  });

  describe('RN-02: completar ao atingir o total de uma obra terminada', () => {
    it('anime: passa a COMPLETED no último episódio', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 11 },
        animeTerminado,
        { progresso: 12 },
        AGORA,
      );
      expect(r.status).toBe('COMPLETED');
      expect(r.progresso).toBe(12);
    });

    it('anime: progresso acima do total fica limitado ao total', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 11 },
        animeTerminado,
        { progresso: 15 },
        AGORA,
      );
      expect(r.status).toBe('COMPLETED');
      expect(r.progresso).toBe(12);
    });

    it('manga: progresso acima do total é aceite e não completa', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 99 },
        mangaTerminado,
        { progresso: 105 },
        AGORA,
      );
      expect(r.status).toBeUndefined();
      expect(r.progresso).toBe(105);
    });

    it('manga: completa no total exato', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 99 },
        mangaTerminado,
        { progresso: 100 },
        AGORA,
      );
      expect(r.status).toBe('COMPLETED');
    });

    it('não completa uma obra em emissão no último episódio lançado', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 7 },
        animeEmEmissao,
        { progresso: 8 },
        AGORA,
      );
      expect(r.status).toBeUndefined();
      expect(r.progresso).toBe(8);
    });

    it('não completa quando o total é desconhecido', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 3 },
        { ...animeTerminado, total: null, limiteLancado: null },
        { progresso: 4 },
        AGORA,
      );
      expect(r.status).toBeUndefined();
    });
  });

  describe('RN-03: recuar numa obra completa volta a WATCHING', () => {
    it('muda COMPLETED para WATCHING quando o progresso desce abaixo do total', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'COMPLETED', progresso: 12 },
        animeTerminado,
        { progresso: 10 },
        AGORA,
      );
      expect(r.status).toBe('WATCHING');
    });
  });

  describe('RN-04: não registar episódios ainda não estreados', () => {
    it('rejeita progresso além do último episódio lançado', () => {
      expect(() =>
        aplicarRegrasDeProgresso(
          { status: 'WATCHING', progresso: 8 },
          animeEmEmissao,
          { progresso: 9 },
          AGORA,
        ),
      ).toThrow(BadRequestException);
    });

    it('não bloqueia quando o limite é desconhecido (manga)', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 50 },
        { ...mangaTerminado, terminada: false },
        { progresso: 500 },
        AGORA,
      );
      expect(r.progresso).toBe(500);
    });
  });

  describe('RN-05: marcar COMPLETED leva o progresso ao último disponível', () => {
    it('obra em emissão: progresso vai para o último episódio lançado', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 3 },
        animeEmEmissao,
        { status: 'COMPLETED' },
        AGORA,
      );
      expect(r.progresso).toBe(8);
    });

    it('sem informação de disponibilidade, mantém o progresso atual', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 3 },
        { ...animeEmEmissao, ultimoDisponivel: null },
        { status: 'COMPLETED' },
        AGORA,
      );
      expect(r.progresso).toBe(3);
    });
  });

  describe('RN-06: sair de DROPPED fica registado', () => {
    it('marca wasDropped ao mudar o estado de uma obra abandonada', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'DROPPED', progresso: 3 },
        animeTerminado,
        { status: 'WATCHING' },
        AGORA,
      );
      expect(r.wasDropped).toBe(true);
    });

    it('não marca wasDropped noutros estados', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'PAUSED', progresso: 3 },
        animeTerminado,
        { status: 'WATCHING' },
        AGORA,
      );
      expect(r.wasDropped).toBeUndefined();
    });
  });

  describe('data do último progresso', () => {
    it('é registada quando o progresso avança', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 3 },
        animeTerminado,
        { progresso: 4 },
        AGORA,
      );
      expect(r.lastProgressUpdate).toBe(AGORA);
    });

    it('não é registada quando o progresso recua', () => {
      const r = aplicarRegrasDeProgresso(
        { status: 'WATCHING', progresso: 3 },
        animeTerminado,
        { progresso: 2 },
        AGORA,
      );
      expect(r.lastProgressUpdate).toBeUndefined();
    });
  });
});
