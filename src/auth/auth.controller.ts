import {
  Controller,
  Post,
  Body,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Res,
  Req,
} from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../user/dto/create-user.dto';

const isProduction = process.env.NODE_ENV === 'production';
const cookieOptions: any = {
  httpOnly: true,
  secure: isProduction || process.env.SECURE_COOKIES === 'true',
  sameSite: isProduction ? 'none' : 'lax',
  path: '/',
};

// Cabeçalho enviado pela app nativa (Capacitor), onde os cookies entre domínios
// não são fiáveis. Só esses clientes recebem os tokens no corpo da resposta.
const NATIVE_CLIENTS = ['android', 'ios'];

export function isNativeClient(req: Request): boolean {
  const client = req.headers?.['x-client'];
  return typeof client === 'string' && NATIVE_CLIENTS.includes(client.toLowerCase());
}

interface AuthResult {
  access_token: string;
  refresh_token: string;
  user: any;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  // Guarda os tokens em cookies HttpOnly. Na web o corpo leva só o utilizador,
  // para que nenhum script na página consiga ler os tokens (RNF-03, L-08).
  private sendSession(req: Request, res: Response, result: AuthResult) {
    res.cookie('otaku_access_token', result.access_token, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15m
    });

    res.cookie('otaku_refresh_token', result.refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    if (isNativeClient(req)) return result;
    return { user: result.user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.authService.validateUser(
      loginDto.email,
      loginDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);
    return this.sendSession(req, res, result);
  }

  @Post('register')
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async register(
    @Body() createUserDto: CreateUserDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(createUserDto);
    return this.sendSession(req, res, result);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let refreshToken = req.cookies?.['otaku_refresh_token'];

    // No Android os cookies entre domínios não são fiáveis: o token vem no corpo
    if (!refreshToken && req.body?.refresh_token) {
      refreshToken = req.body.refresh_token;
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token em falta.');
    }

    const result = await this.authService.refresh(refreshToken);
    return this.sendSession(req, res, result);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('otaku_access_token', cookieOptions);
    res.clearCookie('otaku_refresh_token', cookieOptions);
    return { message: 'Sessão terminada com sucesso.' };
  }
}
