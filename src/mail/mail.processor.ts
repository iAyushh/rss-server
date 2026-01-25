import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MAIL_QUEUE } from './mail.constants';
import { MailService, SendMessagePayload } from './mail.service';

@Processor(MAIL_QUEUE)
export class MailProcessor extends WorkerHost {
  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendMessagePayload>): Promise<any> {
    const { to, subject, mailBodyOrTemplate, attachments, replyTo } = job.data;

    return this.mailService.send({
      to,
      subject,
      mailBodyOrTemplate,
      attachments,
      replyTo,
    });
  }
}
