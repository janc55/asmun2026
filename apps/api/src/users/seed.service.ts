import { Injectable, OnApplicationBootstrap, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@prisma/client';

@Injectable()
export class SeedService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    await this.seedInitialAdmin();
  }

  private async seedInitialAdmin() {
    try {
      const adminExists = await this.prisma.user.findFirst({
        where: { role: UserRole.admin },
      });

      if (!adminExists) {
        const username = this.configService
          .get<string>('INITIAL_ADMIN_USERNAME', 'admin')
          .toLowerCase();
        const rawPassword = this.configService.get<string>(
          'INITIAL_ADMIN_PASSWORD',
          'AdminAsmun2026!',
        );
        const fullName = this.configService.get<string>(
          'INITIAL_ADMIN_NAME',
          'Administrador ASMUN',
        );

        const passwordHash = await bcrypt.hash(rawPassword, 10);

        await this.prisma.user.create({
          data: {
            username,
            fullName,
            passwordHash,
            role: UserRole.admin,
            isActive: true,
          },
        });

        this.logger.log(`✓ Usuario Administrador inicial creado con éxito: ${username}`);
      } else {
        this.logger.log('✓ Usuario Administrador verificado en la base de datos.');
      }
    } catch (error: any) {
      this.logger.error(`Error al verificar o inicializar usuario admin: ${error.message}`);
    }
  }
}
