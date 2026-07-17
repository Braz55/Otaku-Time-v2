import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class KeepAwakeService implements OnModuleDestroy {
  private readonly logger = new Logger(KeepAwakeService.name);
  private pingInterval?: NodeJS.Timeout;
  private pingsCount = 0;
  private readonly MAX_PINGS = 12; // 12 pings * 10 mins = 2 horas de buffer
  private baseUrl: string | null = null;
  private lastUserActivity = 0;
  private readonly bootstrappedAt = Date.now();

  recordUserActivity() {
    this.lastUserActivity = Date.now();
  }

  isUserActiveRecently(windowMs = 7200000): boolean { // 2 horas por defeito
    const now = Date.now();
    // Tolerância de 10 minutos após inicialização para tarefas de bootstrap
    if (now - this.bootstrappedAt < 600000) {
      return true;
    }
    return now - this.lastUserActivity < windowMs;
  }

  private isWithinActiveHours(): boolean {
    const timezone = process.env.AWAKE_TIMEZONE || 'Europe/Lisbon';
    const startHour = parseInt(process.env.AWAKE_START_HOUR || '7', 10);
    const endHour = parseInt(process.env.AWAKE_END_HOUR || '2', 10); // 2 significa 2 AM

    const now = new Date();
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      });
      const currentHour = parseInt(formatter.format(now), 10);

      if (startHour === endHour) {
        return true; // Se forem iguais, assume-se ativo 24/7
      }

      if (startHour < endHour) {
        return currentHour >= startHour && currentHour < endHour;
      }

      // Trata períodos que atravessam a meia-noite (ex: das 8 às 0/24 ou das 18 às 2)
      const normalizedEnd = endHour === 0 ? 24 : endHour;
      if (startHour < normalizedEnd) {
        return currentHour >= startHour && currentHour < normalizedEnd;
      }

      return currentHour >= startHour || currentHour < endHour;
    } catch (e: any) {
      this.logger.error(
        `Erro ao formatar hora para timezone ${timezone}: ${e.message}. Defaulting to true.`,
      );
      return true; // Fallback para evitar adormecer em caso de erro de configuração
    }
  }

  startAwakeWindow(detectedBaseUrl: string) {
    // Prefer environment variable if set, otherwise use the dynamically detected base URL
    const envUrl = process.env.RENDER_URL;
    this.baseUrl = envUrl || detectedBaseUrl;

    // Check if we are running locally to avoid unnecessary timers
    if (
      this.baseUrl.includes('localhost') ||
      this.baseUrl.includes('127.0.0.1')
    ) {
      return;
    }

    // Se já estiver a correr, e for fora das horas ativas, reiniciamos o contador para dar mais 2 horas a partir do último pedido
    if (this.pingInterval) {
      if (!this.isWithinActiveHours()) {
        this.logger.log(
          'Pedido recebido fora de horas ativas com ping ativo. Reiniciando janela de inatividade para mais 2 horas.',
        );
        this.pingsCount = 0;
      }
      return;
    }

    const active = this.isWithinActiveHours();
    const mode = active ? 'Horas Ativas (Contínuo)' : 'Horas de Inatividade (Buffer de 2h)';
    this.logger.log(
      `A iniciar Self-Ping utilizando URL: ${this.baseUrl} [Modo: ${mode}]`,
    );
    this.pingsCount = 0;

    // A cada 10 minutos (600000 milissegundos)
    this.pingInterval = setInterval(async () => {
      const currentlyActive = this.isWithinActiveHours();

      if (currentlyActive) {
        this.pingsCount = 0; // Reinicia o contador para que o limite só conte quando sairmos das horas ativas
      } else {
        this.pingsCount++;
      }

      const pingUrl = `${this.baseUrl}/health`;
      try {
        await fetch(pingUrl, {
          headers: {
            'x-self-ping': 'true',
          },
        });
        const currentMode = currentlyActive
          ? 'Horas Ativas'
          : `Modo Noturno/Buffer (${this.pingsCount}/${this.MAX_PINGS})`;
        this.logger.log(
          `Self-Ping executado com sucesso [${currentMode}].`,
        );
      } catch (error: any) {
        this.logger.error(
          `Erro no Self-Ping para ${pingUrl}: ${error.message}`,
        );
      }

      // Para de pingar se tiver atingido o limite do buffer fora das horas ativas
      if (!currentlyActive && this.pingsCount >= this.MAX_PINGS) {
        const interval = this.pingInterval;
        if (interval) {
          clearInterval(interval);
          this.pingInterval = undefined;
        }
        this.logger.log(
          'Janela de atividade expirou fora das horas ativas. O servidor pode dormir.',
        );
      }
    }, 600000);
  }

  onModuleDestroy() {
    const interval = this.pingInterval;
    if (interval) {
      clearInterval(interval);
      this.pingInterval = undefined;
    }
  }
}
