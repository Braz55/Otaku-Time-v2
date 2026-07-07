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
import { Response, Request } from 'express';
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

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
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

    res.cookie('otaku_access_token', result.access_token, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15m
    });

    res.cookie('otaku_refresh_token', result.refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    return result;
  }

  @Post('register')
  async register(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.register(createUserDto);

    res.cookie('otaku_access_token', result.access_token, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15m
    });

    res.cookie('otaku_refresh_token', result.refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    let refreshToken = req.cookies?.['otaku_refresh_token'];

    if (!refreshToken && req.body?.refresh_token) {
      refreshToken = req.body.refresh_token;
    }

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token em falta.');
    }

    const result = await this.authService.refresh(refreshToken);

    res.cookie('otaku_access_token', result.access_token, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000, // 15m
    });

    res.cookie('otaku_refresh_token', result.refresh_token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7d
    });

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('otaku_access_token', cookieOptions);
    res.clearCookie('otaku_refresh_token', cookieOptions);
    return { message: 'Sessão terminada com sucesso.' };
  }
}
