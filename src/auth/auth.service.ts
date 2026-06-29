import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = {
      email: user.email,
      sub: user.id,
      tokenVersion: user.tokenVersion,
    };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        preferredLanguage: user.preferredLanguage,
        theme: user.theme,
        showAdultContent: user.showAdultContent,
        tipoConta: user.tipoConta,
        iconUrl: user.iconUrl,
        bannerUrl: user.bannerUrl,
        preferences: user.preferences,
      },
    };
  }

  async register(createUserDto: any) {
    const existingUser = await this.userService.findByEmail(
      createUserDto.email,
    );
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }
    const user = await this.userService.create(createUserDto);
    return this.login(user);
  }
}
