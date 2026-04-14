import { Redis } from 'ioredis';
import {
  Injectable,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private client: Redis;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onModuleInit() {
    this.client = new Redis(this.configService.get('REDIS_URI'), {
      lazyConnect: true,

     
      maxRetriesPerRequest: 1,

     
      enableReadyCheck: false,
    });

    this.client.on('error', (err: Error) => {
      console.error(' Redis Error:', err.message);
    });

    this.client.on('connect', () => {
      console.log(' Redis connected');
    });

    await this.client.connect();
  }

  getClient(): Redis {
    if (!this.client) {
      throw new Error('Redis client not initialized');
    }
    return this.client;
  }

  async onApplicationShutdown() {
    if (this.client) {
      await this.client.quit();
    }
  }
}