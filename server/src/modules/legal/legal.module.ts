import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LegalNotice } from './entities/legal-notice.entity';
import { CourtCase } from './entities/court-case.entity';
import { Document } from './entities/document.entity';
import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';

@Module({
  imports: [TypeOrmModule.forFeature([LegalNotice, CourtCase, Document])],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
