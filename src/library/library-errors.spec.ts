import { ConflictException } from '@nestjs/common';
import { createLibraryEntry } from './library-errors';

describe('createLibraryEntry (L-11/L-12)', () => {
  it('devolve a entrada criada', async () => {
    await expect(createLibraryEntry(Promise.resolve({ id: 1 }), 'dup')).resolves.toEqual({ id: 1 });
  });

  it('traduz a violação do índice único (pedidos simultâneos) num 409', async () => {
    const erroPrisma = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    await expect(createLibraryEntry(Promise.reject(erroPrisma), 'Já está na biblioteca.')).rejects.toEqual(
      new ConflictException('Já está na biblioteca.'),
    );
  });

  it('deixa passar outros erros', async () => {
    const outro = new Error('ligação perdida');
    await expect(createLibraryEntry(Promise.reject(outro), 'dup')).rejects.toBe(outro);
  });
});
