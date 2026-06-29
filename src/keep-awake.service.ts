import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

@Injectable()
export class KeepAwakeService implements OnModuleDestroy {
  private readonly logger = new Logger(KeepAwakeService.name);
  private pingInterval?: NodeJS.Timeout;
  private pingsCount = 0;
  private readonly MAX_PINGS = 12; // 12 pings * 10 mins = 2 horas
  private baseUrl: string | null = null;

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

    // Se já estiver a correr, não faz nada para evitar prolongar desnecessariamente o tempo ativo
    if (this.pingInterval) {
      return;
    }

    this.logger.log(
      `A iniciar janela de 2 horas de Self-Ping utilizando URL: ${this.baseUrl}`,
    );
    this.pingsCount = 0;

    // A cada 10 minutos (600000 milissegundos)
    this.pingInterval = setInterval(async () => {
      this.pingsCount++;

      const pingUrl = `${this.baseUrl}/health`;
      try {
        await fetch(pingUrl, {
          headers: {
            'x-self-ping': 'true',
          },
        });
        this.logger.log(
          `Self-Ping ${this.pingsCount}/${this.MAX_PINGS} executado com sucesso.`,
        );
      } catch (error: any) {
        this.logger.error(
          `Erro no Self-Ping para ${pingUrl}: ${error.message}`,
        );
      }

      // Desliga-se ao fim de 2 horas (12 pings)
      if (this.pingsCount >= this.MAX_PINGS) {
        const interval = this.pingInterval;
        if (interval) {
          clearInterval(interval);
          this.pingInterval = undefined;
        }
        this.logger.log('Janela de 2 horas terminada. O servidor pode dormir.');
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
