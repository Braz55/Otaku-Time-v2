import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let userService: UserService;
  let jwtService: JwtService;

  const mockUser = {
    id: 1,
    email: 'test@example.com',
    password: 'hashedpassword',
    nome: 'Test User',
    tokenVersion: 1,
    preferredLanguage: 'pt',
    theme: 'dark',
    showAdultContent: false,
    tipoConta: 'free',
    iconUrl: null,
    bannerUrl: null,
    preferences: null,
  };

  const mockUserService = {
    findByEmail: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userService = module.get<UserService>(UserService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateUser', () => {
    it('should return user info without password if password is valid', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await service.validateUser('test@example.com', 'correctpassword');

      expect(result).toEqual({
        id: mockUser.id,
        email: mockUser.email,
        nome: mockUser.nome,
        tokenVersion: mockUser.tokenVersion,
        preferredLanguage: mockUser.preferredLanguage,
        theme: mockUser.theme,
        showAdultContent: mockUser.showAdultContent,
        tipoConta: mockUser.tipoConta,
        iconUrl: mockUser.iconUrl,
        bannerUrl: mockUser.bannerUrl,
        preferences: mockUser.preferences,
      });
      expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', mockUser.password);
    });

    it('should return null if user is not found', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);

      const result = await service.validateUser('notfound@example.com', 'password');

      expect(result).toBeNull();
    });

    it('should return null if password compare fails', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      const result = await service.validateUser('test@example.com', 'wrongpassword');

      expect(result).toBeNull();
    });
  });

  describe('login', () => {
    it('should sign access/refresh tokens and return user and token info', async () => {
      mockJwtService.sign
        .mockReturnValueOnce('access_token_val')
        .mockReturnValueOnce('refresh_token_val');

      const result = await service.login(mockUser);

      expect(result).toEqual({
        access_token: 'access_token_val',
        refresh_token: 'refresh_token_val',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          nome: mockUser.nome,
          preferredLanguage: mockUser.preferredLanguage,
          theme: mockUser.theme,
          showAdultContent: mockUser.showAdultContent,
          tipoConta: mockUser.tipoConta,
          iconUrl: mockUser.iconUrl,
          bannerUrl: mockUser.bannerUrl,
          preferences: mockUser.preferences,
        },
      });
      expect(mockJwtService.sign).toHaveBeenCalledTimes(2);
    });
  });

  describe('refresh', () => {
    it('should return new access/refresh tokens if refresh token is valid and tokenVersion matches', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, email: 'test@example.com', tokenVersion: 1 });
      mockUserService.findOne.mockResolvedValue(mockUser);
      mockJwtService.sign
        .mockReturnValueOnce('new_access_token')
        .mockReturnValueOnce('new_refresh_token');

      const result = await service.refresh('valid_refresh_token');

      expect(result).toEqual({
        access_token: 'new_access_token',
        refresh_token: 'new_refresh_token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          nome: mockUser.nome,
          preferredLanguage: mockUser.preferredLanguage,
          theme: mockUser.theme,
          showAdultContent: mockUser.showAdultContent,
          tipoConta: mockUser.tipoConta,
          iconUrl: mockUser.iconUrl,
          bannerUrl: mockUser.bannerUrl,
          preferences: mockUser.preferences,
        },
      });
      expect(mockJwtService.verify).toHaveBeenCalledWith('valid_refresh_token');
      expect(userService.findOne).toHaveBeenCalledWith(1);
    });

    it('should throw UnauthorizedException if jwt verify fails', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(service.refresh('invalid_token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 999, email: 'test@example.com', tokenVersion: 1 });
      mockUserService.findOne.mockResolvedValue(null);

      await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if tokenVersion has changed', async () => {
      mockJwtService.verify.mockReturnValue({ sub: 1, email: 'test@example.com', tokenVersion: 1 });
      // user in DB has different token version (e.g., sessions invalidated)
      mockUserService.findOne.mockResolvedValue({
        ...mockUser,
        tokenVersion: 2,
      });

      await expect(service.refresh('token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('register', () => {
    it('should create user and call login if email is not taken', async () => {
      mockUserService.findByEmail.mockResolvedValue(null);
      mockUserService.create.mockResolvedValue(mockUser);
      mockJwtService.sign
        .mockReturnValueOnce('access_token_val')
        .mockReturnValueOnce('refresh_token_val');

      const dto = { email: 'test@example.com', password: 'password', nome: 'Test' };
      const result = await service.register(dto);

      expect(userService.findByEmail).toHaveBeenCalledWith('test@example.com');
      expect(userService.create).toHaveBeenCalledWith(dto);
      expect(result.access_token).toBe('access_token_val');
      expect(result.refresh_token).toBe('refresh_token_val');
    });

    it('should throw UnauthorizedException if email already exists', async () => {
      mockUserService.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register({ email: 'test@example.com', password: 'password' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
