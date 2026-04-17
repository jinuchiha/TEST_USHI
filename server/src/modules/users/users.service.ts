import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '../../common/enums';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  async findAll(role?: Role): Promise<User[]> {
    const where: any = { isActive: true };
    if (role) where.role = role;
    return this.usersRepo.find({ where, order: { name: 'ASC' } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepo.findOne({ where: { email } });
  }

  async findOfficers(): Promise<User[]> {
    return this.usersRepo.find({
      where: { role: Role.OFFICER, isActive: true },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email already exists');

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = this.usersRepo.create({
      name: dto.name,
      email: dto.email,
      passwordHash,
      role: dto.role,
      agentCode: dto.agentCode || null,
      target: dto.target || null,
      dailyTarget: dto.dailyTarget || null,
    });
    return this.usersRepo.save(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // CEO protection: cannot be edited or deleted
    if (user.role === Role.CEO) {
      throw new ConflictException('CEO user cannot be modified');
    }

    if (dto.password) {
      user.passwordHash = await bcrypt.hash(dto.password, 12);
    }
    if (dto.name !== undefined) user.name = dto.name;
    if (dto.email !== undefined) user.email = dto.email;
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.agentCode !== undefined) user.agentCode = dto.agentCode || null;
    if (dto.target !== undefined) user.target = dto.target || null;
    if (dto.dailyTarget !== undefined) user.dailyTarget = dto.dailyTarget || null;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    return this.usersRepo.save(user);
  }

  async deactivate(id: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('User not found');
    if (user.role === Role.CEO) throw new ConflictException('CEO user cannot be deleted');
    user.isActive = false;
    await this.usersRepo.save(user);
  }
}
