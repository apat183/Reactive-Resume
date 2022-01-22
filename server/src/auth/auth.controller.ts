import { Body, Controller, Delete, Get, HttpCode, Post, UseGuards } from '@nestjs/common';

import { User } from '@/decorators/user.decorator';
import { User as UserEntity } from '@/users/entities/user.entity';

import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { LocalAuthGuard } from './guards/local.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  authenticate(@User() user: UserEntity) {
    return user;
  }

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    const user = await this.authService.register(registerDto);
    const accessToken = this.authService.getAccessToken(user.id);

    return { user, accessToken };
  }

  @HttpCode(200)
  @UseGuards(LocalAuthGuard)
  @Post('login')
  async login(@User() user: UserEntity) {
    const accessToken = this.authService.getAccessToken(user.id);

    return { user, accessToken };
  }

  @HttpCode(200)
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.email);
  }

  @HttpCode(200)
  @Post('reset-password')
  resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Delete()
  async remove(@User('id') id: number) {
    await this.authService.removeUser(id);
  }
}
