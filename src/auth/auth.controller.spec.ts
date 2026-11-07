import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';
import { Response, Request } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthResult = {
    access_token: 'mock_access_token',
    refresh_token: 'mock_refresh_token',
    user: {
      id: 1,
      email: 'test@example.com',
      nome: 'Test',
      tipoConta: 'free',
    },
  };

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
    refresh: jest.fn(),
  };

  const webReq = { headers: {} } as any as Request;
  const androidReq = { headers: { 'x-client': 'android' } } as any as Request;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should validate user, login user, set cookies, and return result', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const mockUser = { id: 1, email: 'test@example.com' };
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      mockAuthService.validateUser.mockResolvedValue(mockUser);
      mockAuthService.login.mockResolvedValue(mockAuthResult);

      const result = await controller.login(loginDto, webReq, mockRes);

      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(authService.login).toHaveBeenCalledWith(mockUser);
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(mockRes.cookie).toHaveBeenNthCalledWith(
        1,
        'otaku_access_token',
        'mock_access_token',
        expect.any(Object),
      );
      expect(mockRes.cookie).toHaveBeenNthCalledWith(
        2,
        'otaku_refresh_token',
        'mock_refresh_token',
        expect.any(Object),
      );
      // Na web os tokens ficam só nos cookies HttpOnly (L-08)
      expect(result).toEqual({ user: mockAuthResult.user });
    });

    it('should return the tokens in the body only for the Android app', async () => {
      const loginDto = { email: 'test@example.com', password: 'password' };
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      mockAuthService.validateUser.mockResolvedValue({ id: 1 });
      mockAuthService.login.mockResolvedValue(mockAuthResult);

      const result = await controller.login(loginDto, androidReq, mockRes);

      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockAuthResult);
    });

    it('should throw UnauthorizedException if credentials are invalid', async () => {
      const loginDto = { email: 'test@example.com', password: 'wrong_password' };
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      mockAuthService.validateUser.mockResolvedValue(null);

      await expect(controller.login(loginDto, webReq, mockRes)).rejects.toThrow(UnauthorizedException);
      expect(authService.validateUser).toHaveBeenCalledWith(loginDto.email, loginDto.password);
      expect(authService.login).not.toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });
  });

  describe('register', () => {
    it('should register user, set cookies, and return result', async () => {
      const createUserDto = { email: 'test@example.com', password: 'password', nome: 'Test' };
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      mockAuthService.register.mockResolvedValue(mockAuthResult);

      const result = await controller.register(createUserDto, webReq, mockRes);

      expect(authService.register).toHaveBeenCalledWith(createUserDto);
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ user: mockAuthResult.user });
    });
  });

  describe('refresh', () => {
    it('should extract token from cookies if present, refresh, set cookies and return result', async () => {
      const mockReq = {
        cookies: {
          otaku_refresh_token: 'cookie_refresh_token',
        },
      } as any as Request;
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      mockAuthService.refresh.mockResolvedValue(mockAuthResult);

      const result = await controller.refresh(mockReq, mockRes);

      expect(authService.refresh).toHaveBeenCalledWith('cookie_refresh_token');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ user: mockAuthResult.user });
    });

    it('should extract token from body if cookie is absent, refresh, set cookies and return result', async () => {
      const mockReq = {
        headers: { 'x-client': 'android' },
        cookies: {},
        body: {
          refresh_token: 'body_refresh_token',
        },
      } as any as Request;
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      mockAuthService.refresh.mockResolvedValue(mockAuthResult);

      const result = await controller.refresh(mockReq, mockRes);

      expect(authService.refresh).toHaveBeenCalledWith('body_refresh_token');
      expect(mockRes.cookie).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockAuthResult);
    });

    it('should throw UnauthorizedException if refresh token is missing', async () => {
      const mockReq = {
        cookies: {},
        body: {},
      } as any as Request;
      const mockRes = {
        cookie: jest.fn(),
      } as any as Response;

      await expect(controller.refresh(mockReq, mockRes)).rejects.toThrow(UnauthorizedException);
      expect(authService.refresh).not.toHaveBeenCalled();
      expect(mockRes.cookie).not.toHaveBeenCalled();
    });
  });

  describe('logout', () => {
    it('should clear cookies and return success message', async () => {
      const mockRes = {
        clearCookie: jest.fn(),
      } as any as Response;

      const result = await controller.logout(mockRes);

      expect(mockRes.clearCookie).toHaveBeenCalledTimes(2);
      expect(mockRes.clearCookie).toHaveBeenNthCalledWith(1, 'otaku_access_token', expect.any(Object));
      expect(mockRes.clearCookie).toHaveBeenNthCalledWith(2, 'otaku_refresh_token', expect.any(Object));
      expect(result).toEqual({ message: 'Sessão terminada com sucesso.' });
    });
  });
});
