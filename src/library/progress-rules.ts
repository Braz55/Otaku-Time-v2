import { BadRequestException } from '@nestjs/common';
import { TrackingStatus } from '@prisma/client';

// Regras de negócio do progresso (RN-01 a RN-06 em documentacao/03-requisitos.md),
// partilhadas por anime (episódios) e manga (capítulos).
// Funções puras: não acedem à base de dados, por isso são fáceis de testar.

export interface EstadoAtual {
  status: TrackingStatus;
  progresso: number;
}

export interface DadosObra {
  // A obra terminou e o progresso pode completar automaticamente ao atingir o total (RN-02)
  terminada: boolean;
  // Total de episódios/capítulos disponíveis; null ou 0 quando desconhecido
  total: number | null;
  // Último episódio/capítulo lançado, para marcar como COMPLETED uma obra em emissão (RN-05)
  ultimoDisponivel: number | null;
  // Limite de progresso para obras não terminadas (RN-04); null quando não deve bloquear
  limiteLancado: number | null;
  // true: ao atingir o total o progresso fica igual ao total.
  // false: progresso acima do total é aceite (a contagem de capítulos de manga costuma estar desatualizada)
  limitarAoTotal: boolean;
}

export interface Alteracao {
  status?: TrackingStatus;
  progresso?: number;
}

export interface Resultado {
  status?: TrackingStatus;
  progresso?: number;
  wasDropped?: boolean;
  lastProgressUpdate?: Date;
}

export function aplicarRegrasDeProgresso(
  atual: EstadoAtual,
  obra: DadosObra,
  alteracao: Alteracao,
  agora: Date = new Date(),
): Resultado {
  const resultado: Resultado = {};

  // RN-06: sair de DROPPED fica registado no histórico
  if (alteracao.status !== undefined && atual.status === 'DROPPED') {
    resultado.wasDropped = true;
  }

  // RN-05: marcar como COMPLETED coloca o progresso no último disponível
  if (alteracao.status === 'COMPLETED') {
    resultado.progresso = obra.ultimoDisponivel || atual.progresso;
  }

  if (alteracao.progresso !== undefined) {
    const p = alteracao.progresso;

    // RN-04: não é possível registar episódios que ainda não estrearam
    if (
      !obra.terminada &&
      obra.limiteLancado !== null &&
      p > obra.limiteLancado
    ) {
      throw new BadRequestException(
        'Não é possível marcar episódios que ainda não estrearam.',
      );
    }

    resultado.progresso = p;

    // RN-01: começar a ver/ler uma obra planeada
    if (atual.status === 'PLANNED' && p > 0) resultado.status = 'WATCHING';

    // RN-03: recuar numa obra completa volta a "a ver"
    if (atual.status === 'COMPLETED' && obra.total && p < obra.total) {
      resultado.status = 'WATCHING';
    }

    // RN-02: atingir o total de uma obra terminada completa-a
    const atingiuTotal = obra.limitarAoTotal
      ? p >= obra.total!
      : p === obra.total;
    if (obra.terminada && obra.total && atingiuTotal) {
      resultado.status = 'COMPLETED';
      resultado.progresso = obra.total;
    }
  }

  if (
    resultado.progresso !== undefined &&
    resultado.progresso > atual.progresso
  ) {
    resultado.lastProgressUpdate = agora;
  }

  return resultado;
}
