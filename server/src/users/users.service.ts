import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Connection, Repository } from 'typeorm';

import { MailService } from '@/mail/mail.service';

import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    private schedulerRegistry: SchedulerRegistry,
    private mailService: MailService,
    private connection: Connection
  ) {}

  async findById(id: number): Promise<User> {
    const user = await this.userRepository.findOne({ id });

    if (user) {
      return user;
    }

    throw new HttpException(
      'A user with this username/email does not exist.',
      HttpStatus.NOT_FOUND
    );
  }

  async findByEmail(email: string): Promise<User> {
    const user = await this.userRepository.findOne({ email });

    if (user) {
      return user;
    }

    throw new HttpException('A user with this email does not exist.', HttpStatus.NOT_FOUND);
  }

  async findByIdentifier(identifier: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: [{ username: identifier }, { email: identifier }],
    });

    if (user) {
      return user;
    }

    throw new HttpException(
      'A user with this username/email does not exist.',
      HttpStatus.NOT_FOUND
    );
  }

  async findByResetToken(resetToken: string): Promise<User> {
    const user = await this.userRepository.findOne({ resetToken });

    if (user) {
      return user;
    }

    throw new HttpException(
      'The reset token provided may be invalid or expired.',
      HttpStatus.NOT_FOUND
    );
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.userRepository.create(createUserDto);

    await this.userRepository.save(user);

    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    const user = await this.findById(id);
    const updatedUser = {
      ...user,
      ...updateUserDto,
    };

    await this.userRepository.save(updatedUser);

    return updatedUser;
  }

  async remove(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  async generateResetToken(email: string): Promise<void> {
    try {
      const user = await this.findByEmail(email);

      const resetToken = randomBytes(32).toString('hex');
      const queryRunner = this.connection.createQueryRunner();

      const interval = setInterval(async () => {
        await this.userRepository.update(user.id, { resetToken: null });
      }, 30 * 60 * 1000);

      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager.update(User, user.id, { resetToken });

        this.schedulerRegistry.addInterval(`clear-resetToken-${user.id}`, interval);

        await this.mailService.sendForgotPasswordEmail(user, resetToken);

        await queryRunner.commitTransaction();
      } catch {
        await queryRunner.rollbackTransaction();

        throw new HttpException(
          'Please wait at least 30 minutes before resetting your password again.',
          HttpStatus.TOO_MANY_REQUESTS
        );
      } finally {
        await queryRunner.release();
      }
    } catch {}
  }
}
