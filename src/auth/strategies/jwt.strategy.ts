import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../../user/user.service';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('A variável de ambiente JWT_SECRET não está definida!');
}

const cookieOrHeaderExtractor = (req: any) => {
  let token: string | null = null;
  if (req.headers && req.headers.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
      const candidate = parts[1];
      if (
        candidate &&
        candidate !== 'null' &&
        candidate !== 'undefined' &&
        candidate !== 'session-cookie' &&
        candidate !== ''
      ) {
        token = candidate;
      }
    }
  }
  if (!token && req.cookies) {
    token = req.cookies['otaku_access_token'] || null;
  }
  return token;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: cookieOrHeaderExtractor,
      ignoreExpiration: false,
      secretOrKey: jwtSecret || 'test_fallback_secret',
    });
  }

  async validate(payload: any) {
    const user = await this.userService.findOne(payload.sub);

    if (!user) {
      throw new UnauthorizedException('Utilizador não encontrado.');
    }
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException(
        'Sessão expirada. Por favor, inicia sessão novamente.',
      );
    }

    return {
      userId: payload.sub,
      email: payload.email,
      tipoConta: user.tipoConta,
    };
  }
}
