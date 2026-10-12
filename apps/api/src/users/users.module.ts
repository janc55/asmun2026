import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { SeedService } from './seed.service';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [UsersService, SeedService],
  exports: [UsersService, SeedService],
})
export class UsersModule {}
