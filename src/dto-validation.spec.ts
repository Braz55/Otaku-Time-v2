import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUserDto } from './user/dto/create-user.dto';
import { UpdateProfileDto } from './user/dto/update-profile.dto';
import { UpdateAnimeDto } from './anime/dto/update-anime.dto';
import { UpdateMangaDto } from './manga/dto/update-manga.dto';
import {
  COMMENT_MAX_LENGTH,
  CreateCommentDto,
} from './comment/dto/comment.dto';

// Validações de entrada exigidas pela especificação (RNF-10, RF-25, RF-49)
async function errosDe<T extends object>(cls: new () => T, dados: object) {
  const erros = await validate(plainToInstance(cls, dados));
  return erros.map((e) => e.property);
}

describe('Validação de DTOs', () => {
  describe('RNF-10: password com pelo menos 8 caracteres', () => {
    const base = { nome: 'Ana', email: 'ana@example.com' };

    it('rejeita no registo uma password com 7 caracteres', async () => {
      expect(
        await errosDe(CreateUserDto, { ...base, password: '1234567' }),
      ).toContain('password');
    });

    it('aceita no registo uma password com 8 caracteres', async () => {
      expect(
        await errosDe(CreateUserDto, { ...base, password: '12345678' }),
      ).toEqual([]);
    });

    it('rejeita ao alterar o perfil uma nova password curta', async () => {
      expect(
        await errosDe(UpdateProfileDto, {
          password: 'curta',
          currentPassword: 'qualquer',
        }),
      ).toContain('password');
    });
  });

  describe('RF-25: prioridade entre 1 e 10', () => {
    it.each([0, 11])('rejeita prioridade %i em anime e manga', async (p) => {
      expect(await errosDe(UpdateAnimeDto, { prioridade: p })).toContain(
        'prioridade',
      );
      expect(await errosDe(UpdateMangaDto, { prioridade: p })).toContain(
        'prioridade',
      );
    });

    it.each([1, 10])('aceita prioridade %i', async (p) => {
      expect(await errosDe(UpdateAnimeDto, { prioridade: p })).toEqual([]);
      expect(await errosDe(UpdateMangaDto, { prioridade: p })).toEqual([]);
    });
  });

  describe('RF-49: comentários com tamanho máximo', () => {
    it('aceita um comentário no limite', async () => {
      expect(
        await errosDe(CreateCommentDto, {
          mediaId: 1,
          text: 'a'.repeat(COMMENT_MAX_LENGTH),
        }),
      ).toEqual([]);
    });

    it('rejeita um comentário acima do limite', async () => {
      expect(
        await errosDe(CreateCommentDto, {
          mediaId: 1,
          text: 'a'.repeat(COMMENT_MAX_LENGTH + 1),
        }),
      ).toContain('text');
    });
  });
});
