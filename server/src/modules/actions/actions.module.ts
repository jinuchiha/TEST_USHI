import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Action } from './entities/action.entity';
import { AuditLog } from '../audit-logs/entities/audit-log.entity';
import { ActionsService } from './actions.service';
import { ActionsController, ActionsVerifyController } from './actions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Action, AuditLog])],
  controllers: [ActionsController, ActionsVerifyController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
