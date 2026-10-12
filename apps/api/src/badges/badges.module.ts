import { Module } from '@nestjs/common';
import { BadgesService } from './badges.service';
import { BadgesController } from './badges.controller';
import { BadgePdfService } from './badge-pdf.service';
import { ParticipantsModule } from '../participants/participants.module';

@Module({
  imports: [ParticipantsModule],
  controllers: [BadgesController],
  providers: [BadgesService, BadgePdfService],
  exports: [BadgesService, BadgePdfService],
})
export class BadgesModule {}
