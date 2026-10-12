import { Module } from '@nestjs/common';
import { ParticipantsService } from './participants.service';
import { ParticipantsController } from './participants.controller';
import { ParticipantsImportService } from './import/participants-import.service';
import { ParticipantsImportController } from './import/participants-import.controller';
import { SchoolsModule } from '../schools/schools.module';
import { CommitteesModule } from '../committees/committees.module';

@Module({
  imports: [SchoolsModule, CommitteesModule],
  controllers: [ParticipantsController, ParticipantsImportController],
  providers: [ParticipantsService, ParticipantsImportService],
  exports: [ParticipantsService],
})
export class ParticipantsModule {}
