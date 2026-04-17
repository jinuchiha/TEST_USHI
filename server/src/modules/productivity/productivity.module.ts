import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OfficerTask } from './entities/task.entity';
import { Badge } from './entities/badge.entity';
import { Case } from '../cases/entities/case.entity';
import { Action } from '../actions/entities/action.entity';
import { User } from '../users/entities/user.entity';
import { ProductivityService } from './productivity.service';
import { ProductivityController } from './productivity.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OfficerTask, Badge, Case, Action, User])],
  controllers: [ProductivityController],
  providers: [ProductivityService],
  exports: [ProductivityService],
})
export class ProductivityModule {}
