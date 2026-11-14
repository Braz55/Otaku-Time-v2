/**
 * Exclusão mútua por chave, dentro do processo: as funções com a mesma chave correm uma de
 * cada vez, pela ordem de chegada. Serve para serializar as escritas sobre a mesma obra
 * (sincronização agendada, refresh manual e cron de notificações).
 * Não é reentrante: quem já tem a chave não a pode pedir outra vez.
 */
export class KeyedMutex {
  private readonly tails = new Map<string, Promise<void>>();

  async run<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    const result = previous.then(fn);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tails.set(key, tail);
    try {
      return await result;
    } finally {
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}
