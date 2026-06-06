import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { EmailService } from './email.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, pass: string): Promise<any> {
    const user = await this.userService.findByEmail(email);
    if (user && (await bcrypt.compare(pass, user.password))) {
      if (!user.isVerified) {
        throw new UnauthorizedException('Email não verificado. Por favor, verifica a tua caixa de correio.');
      }
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id, tokenVersion: user.tokenVersion };
    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        nome: user.nome,
        preferredLanguage: user.preferredLanguage,
        theme: user.theme,
        showAdultContent: user.showAdultContent,
      },
    };
  }

  async register(createUserDto: any) {
    const existingUser = await this.userService.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }
    const user = await this.userService.create(createUserDto);
    
    if (user.verificationToken) {
      await this.emailService.sendVerificationEmail(user.email, user.verificationToken);
    }

    return {
      message: 'Registo efetuado com sucesso! Por favor, verifica o teu email para ativares a tua conta.',
      requiresVerification: true
    };
  }

  async verifyEmail(token: string) {
    const user = await this.userService.findByVerificationToken(token);
    if (!user) {
      throw new BadRequestException('Token de verificação inválido ou expirado.');
    }
    await this.userService.verifyUser(user.id);
    return `
      <html>
        <head>
          <title>Email Verificado</title>
          <style>
            body { font-family: sans-serif; background-color: #0f1014; color: #gray-200; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background-color: #1a1c23; border: 1px solid #c2185b; padding: 40px; border-radius: 24px; text-align: center; max-width: 400px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
            h1 { color: #c2185b; margin-bottom: 16px; font-weight: 900; }
            p { color: #a0aec0; margin-bottom: 24px; line-height: 1.5; }
            .btn { background-color: #c2185b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block; transition: opacity 0.2s; }
            .btn:hover { opacity: 0.9; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>Email Verificado! 🎉</h1>
            <p>A tua conta Otaku-Time foi ativada com sucesso. Já podes regressar à aplicação e fazer login.</p>
            <a href="/" class="btn">Voltar à App</a>
          </div>
        </body>
      </html>
    `;
  }
}
