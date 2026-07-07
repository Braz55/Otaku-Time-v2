import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('update', () => {
    it('should explicitly map only whitelisted fields and ignore extra fields', async () => {
      const userId = 1;
      const updateDto = {
        nome: 'New Name',
        tipoConta: 'ADMIN',
        tokenVersion: 999,
        nonExistentField: 'value',
      } as any;

      mockPrismaService.user.update.mockResolvedValue({
        id: userId,
        nome: 'New Name',
      });

      await service.update(userId, updateDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: {
          nome: 'New Name',
        },
      });
    });

    it('should allow changing password when currentPassword matches', async () => {
      const userId = 1;
      const updateDto = {
        password: 'new-password',
        currentPassword: 'old-password',
      };

      const hashedPassword = await bcrypt.hash('old-password', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        password: hashedPassword,
        tokenVersion: 1,
      });

      mockPrismaService.user.update.mockResolvedValue({ id: userId });

      await service.update(userId, updateDto);

      expect(mockPrismaService.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: expect.objectContaining({
          password: expect.any(String),
          tokenVersion: 2,
        }),
      });
    });

    it('should throw BadRequestException if currentPassword is missing when updating password', async () => {
      const userId = 1;
      const updateDto = {
        password: 'new-password',
      };

      await expect(service.update(userId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if currentPassword is incorrect', async () => {
      const userId = 1;
      const updateDto = {
        password: 'new-password',
        currentPassword: 'wrong-password',
      };

      const hashedPassword = await bcrypt.hash('old-password', 10);
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: userId,
        password: hashedPassword,
        tokenVersion: 1,
      });

      await expect(service.update(userId, updateDto)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
