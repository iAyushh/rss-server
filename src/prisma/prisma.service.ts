import {
  Injectable,
  OnModuleInit,
  OnApplicationShutdown,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnApplicationShutdown
{
  constructor() {
    if (!prisma) {
      prisma = new PrismaClient({
        errorFormat: 'minimal',
      });
    }

    super();
    Object.assign(this, prisma);
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onApplicationShutdown() {
    await this.$disconnect();
  }
}
