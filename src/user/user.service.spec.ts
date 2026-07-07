import { Test, TestingModule } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

describe('UserService', () => {
  let service: UserService;
  let prisma: PrismaService;

  const mockTransactionClient = {
    giftCode: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    userSubscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  };

  const mockPrismaService = {
    $transaction: jest.fn(),
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    anime: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    manga: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    userRating: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    userAnime: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    userManga: {
      groupBy: jest.fn().mockResolvedValue([]),
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

  describe('findAll', () => {
    it('should omit password field', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        omit: {
          password: true,
        },
      });
    });
  });

  describe('findOne', () => {
    it('should omit password field', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 1 });
      await service.findOne(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: {
          password: true,
        },
      });
    });
  });

  describe('getUserProfile', () => {
    it('should omit password and email fields', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: 1,
        statistics: {},
        subscription: null,
        topFavorites: [],
        achievements: [],
      });
      await service.getUserProfile(1);
      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        omit: {
          password: true,
          email: true,
        },
        include: expect.any(Object),
      });
    });
  });

  describe('redeemGiftCode', () => {
    const userId = 1;
    const giftCodeStr = 'GIFT-123';
    const mockGiftCode = {
      id: 1,
      code: 'GIFT-123',
      durationDays: 30,
      isUsed: false,
      expiresAt: null,
    };

    beforeEach(() => {
      mockPrismaService.$transaction.mockImplementation((cb) => cb(mockTransactionClient));
    });

    it('should successfully redeem a gift code for a user without active subscription', async () => {
      mockTransactionClient.giftCode.findUnique.mockResolvedValue(mockGiftCode);
      mockTransactionClient.giftCode.updateMany.mockResolvedValue({ count: 1 });
      mockTransactionClient.userSubscription.findUnique.mockResolvedValue(null);
      mockTransactionClient.userSubscription.upsert.mockResolvedValue({});
      mockTransactionClient.user.update.mockResolvedValue({});

      const result = await service.redeemGiftCode(userId, giftCodeStr);

      expect(result.success).toBe(true);
      expect(result.message).toContain('30 dias');
      expect(mockTransactionClient.giftCode.findUnique).toHaveBeenCalledWith({
        where: { code: 'GIFT-123' },
      });
      expect(mockTransactionClient.giftCode.updateMany).toHaveBeenCalledWith({
        where: { code: 'GIFT-123', isUsed: false },
        data: expect.objectContaining({
          isUsed: true,
          redeemedByUserId: userId,
          redeemedAt: expect.any(Date),
        }),
      });
      expect(mockTransactionClient.userSubscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId },
          update: expect.objectContaining({
            status: 'ACTIVE',
            planType: 'PREMIUM',
          }),
        }),
      );
      expect(mockTransactionClient.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { tipoConta: 'pro' },
      });
    });

    it('should extend existing subscription end date if it is currently active', async () => {
      const activeSubEnd = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // 5 days from now
      mockTransactionClient.giftCode.findUnique.mockResolvedValue(mockGiftCode);
      mockTransactionClient.giftCode.updateMany.mockResolvedValue({ count: 1 });
      mockTransactionClient.userSubscription.findUnique.mockResolvedValue({
        userId,
        status: 'ACTIVE',
        currentPeriodEnd: activeSubEnd,
      });
      mockTransactionClient.userSubscription.upsert.mockResolvedValue({});
      mockTransactionClient.user.update.mockResolvedValue({});

      const result = await service.redeemGiftCode(userId, giftCodeStr);

      expect(result.success).toBe(true);
      const expectedEnd = new Date(activeSubEnd.getTime() + 30 * 24 * 60 * 60 * 1000);
      expect(result.currentPeriodEnd.getTime()).toBeCloseTo(expectedEnd.getTime(), -2);
    });

    it('should throw BadRequestException if code is invalid (not found)', async () => {
      mockTransactionClient.giftCode.findUnique.mockResolvedValue(null);

      await expect(service.redeemGiftCode(userId, giftCodeStr)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if code is already used', async () => {
      mockTransactionClient.giftCode.findUnique.mockResolvedValue({
        ...mockGiftCode,
        isUsed: true,
      });

      await expect(service.redeemGiftCode(userId, giftCodeStr)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if code is expired', async () => {
      mockTransactionClient.giftCode.findUnique.mockResolvedValue({
        ...mockGiftCode,
        expiresAt: new Date(Date.now() - 10000), // expired 10s ago
      });

      await expect(service.redeemGiftCode(userId, giftCodeStr)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if updateMany returns count 0 (race condition simulated)', async () => {
      mockTransactionClient.giftCode.findUnique.mockResolvedValue(mockGiftCode);
      mockTransactionClient.giftCode.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.redeemGiftCode(userId, giftCodeStr)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
