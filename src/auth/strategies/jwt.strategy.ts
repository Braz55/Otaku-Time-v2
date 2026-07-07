import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../../user/user.service';

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret && process.env.NODE_ENV !== 'test') {
  throw new Error('A variável de ambiente JWT_SECRET não está definida!');
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly userService: UserService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
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
