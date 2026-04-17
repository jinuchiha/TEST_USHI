import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactRecord } from './entities/contact-record.entity';
import { TracingService } from './tracing.service';
import { TracingController } from './tracing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ContactRecord])],
  controllers: [TracingController],
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule {}
