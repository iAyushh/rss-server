import { BullModule } from '@nestjs/bullmq';
import { DynamicModule, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';
import { RedisService } from 'src/redis';

@Module({})
export class QueueModule {
  static registerAsync(name: string): DynamicModule {
    return BullModule.registerQueueAsync({
      name,
      inject: [ConfigService, RedisService],

      useFactory: async (
        configService: ConfigService<EnvironmentVariables, true>,
        redisService: RedisService,
      ) => {
        return {
          connection: redisService.getClient(),

          defaultJobOptions: {
            removeOnComplete: true,
            removeOnFail: {
              age: 86400, // 24 hours
            },
            attempts: 2,
            backoff: {
              type: 'exponential',
              delay: 2000,
            },
          },
        };
      },
    });
  }
}