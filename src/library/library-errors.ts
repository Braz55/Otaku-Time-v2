import { ConflictException } from '@nestjs/common';

/**
 * Cria a entrada na biblioteca e traduz a violação do índice único (userId, obraId)
 * num 409. Cobre o caso de dois pedidos simultâneos (duplo clique) passarem ambos
 * a verificação "já está na biblioteca" (L-11/L-12).
 */
export async function createLibraryEntry<T>(
  create: Promise<T>,
  mensagem: string,
): Promise<T> {
  try {
    return await create;
  } catch (err: any) {
    if (err?.code === 'P2002') {
      throw new ConflictException(mensagem);
    }
    throw err;
  }
}
