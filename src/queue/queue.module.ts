import { BullModule } from '@nestjs/bullmq';
import { DynamicModule } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '@Common';
import { RedisService } from 'src/redis';
import { RedisModule } from 'src/redis/redis.module';

export class QueueModule {
  static registerAsync(name: string): DynamicModule {
    return BullModule.registerQueueAsync({
      name,
      imports: [RedisModule],

      inject: [ConfigService, RedisService],

      useFactory: (
  configService: ConfigService<EnvironmentVariables, true>,
  redisService: RedisService,
) => {
  return {
    connection: redisService.getClient(),

    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: {
        age: 86400,
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