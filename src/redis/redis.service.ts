import { Redis } from 'ioredis';
import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';

@Injectable()
export class RedisService implements OnApplicationShutdown {
  private client: Redis;

  constructor(
    private readonly configService: ConfigService<EnvironmentVariables, true>,
  ) {
    this.client = new Redis(this.configService.get('REDIS_URI'), {
      lazyConnect: false,
      maxRetriesPerRequest: null,

      retryStrategy: (times) => {
        if (times > 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 200, 2000);
      },

      enableReadyCheck: false,
    });

    this.client.on('error', (err: Error) => {
      console.error(' Redis Error:', err.message);
    });

    this.client.on('connect', () => {
      console.log(' Redis connected');
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async onApplicationShutdown() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
