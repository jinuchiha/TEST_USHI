import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HelpRequest } from './entities/help-request.entity';
import { HelpRequestReply } from './entities/help-request-reply.entity';
import { HelpRequestsService } from './help-requests.service';
import { HelpRequestsController } from './help-requests.controller';

@Module({
  imports: [TypeOrmModule.forFeature([HelpRequest, HelpRequestReply])],
  controllers: [HelpRequestsController],
  providers: [HelpRequestsService],
  exports: [HelpRequestsService],
})
export class HelpRequestsModule {}
