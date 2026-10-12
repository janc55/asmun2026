import { Module } from '@nestjs/common';
import { ScansService } from './scans.service';
import { ScansController } from './scans.controller';
import { CheckpointsModule } from '../checkpoints/checkpoints.module';

@Module({
  imports: [CheckpointsModule],
  controllers: [ScansController],
  providers: [ScansService],
  exports: [ScansService],
})
export class ScansModule {}
