import { Module, OnApplicationShutdown, Optional } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { MAIL_QUEUE } from './mail.constants';
import { MailService } from './mail.service';
import { MailProcessor } from './mail.processor';
import { QueueModule } from '../queue';

const redisEnabled = process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [...(redisEnabled ? [QueueModule.registerAsync(MAIL_QUEUE)] : [])],
  providers: [MailService, ...(redisEnabled ? [MailProcessor] : [])],
  exports: [MailService],
})
export class MailModule implements OnApplicationShutdown {
  constructor(
    @Optional()
    @InjectQueue(MAIL_QUEUE)
    private readonly mailQueue?: Queue,
  ) {}

  async onApplicationShutdown() {
    if (redisEnabled && this.mailQueue) {
      await this.mailQueue.disconnect();
    }
  }
}
