import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { SchoolsModule } from './schools/schools.module';
import { CommitteesModule } from './committees/committees.module';
import { ParticipantsModule } from './participants/participants.module';
import { BadgesModule } from './badges/badges.module';
import { CheckpointsModule } from './checkpoints/checkpoints.module';
import { ScansModule } from './scans/scans.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ReportsModule } from './reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    PrismaModule,
    AuditModule,
    UsersModule,
    AuthModule,
    SchoolsModule,
    CommitteesModule,
    ParticipantsModule,
    BadgesModule,
    CheckpointsModule,
    ScansModule,
    DashboardModule,
    ReportsModule,
  ],
})
export class AppModule {}
