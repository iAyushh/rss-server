import path from 'node:path';
import pug from 'pug';
import nodemailer from 'nodemailer';
import { Queue } from 'bullmq';
import { SentMessageInfo } from 'nodemailer/lib/smtp-transport';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';

import {
  appConfigFactory,
  mailConfigFactory,
  mailQueueConfigFactory,
} from '@Config';
import { MAIL_QUEUE } from './mail.constants';
import { MailTemplate } from './mail.types';

export type SendMessagePayload = {
  to: string;
  subject: string;
  mailBodyOrTemplate: string | MailTemplate;
  attachments?: string[];
  replyTo?: string;
};

@Injectable()
export class MailService {
  private readonly transporter;
  private readonly redisEnabled: boolean;

  constructor(
    @Inject(mailConfigFactory.KEY)
    private readonly config: ConfigType<typeof mailConfigFactory>,

    @Inject(appConfigFactory.KEY)
    private readonly appConfig: ConfigType<typeof appConfigFactory>,

    @Inject(mailQueueConfigFactory.KEY)
    private readonly queueConfig: ConfigType<typeof mailQueueConfigFactory>,

    @Optional()
    @InjectQueue(MAIL_QUEUE)
    private readonly mailQueue?: Queue<SendMessagePayload, SentMessageInfo>,
  ) {
    this.redisEnabled = process.env.REDIS_ENABLED === 'true';

    this.transporter = nodemailer.createTransport({
      name: this.appConfig.domain,
      host: this.config.host,
      port: this.config.port,
      auth: {
        user: this.config.auth.user,
        pass: this.config.auth.pass,
      },
    });
  }

  // ----------------------------
  // Helpers
  // ----------------------------

  configureMessage(
    to: string,
    subject: string,
    mailBody: string,
    attachments?: string[],
    replyTo?: string,
  ) {
    const message: Record<string, unknown> = {
      from: this.config.sender,
      to,
      subject,
      html: mailBody,
      attachments: attachments ?? [],
    };

    if (replyTo) {
      message.replyTo = replyTo;
    }

    return message;
  }

  async renderTemplate(template: MailTemplate): Promise<string> {
    return pug.renderFile(
      path.resolve('templates', 'mail', `${template.name}.pug`),
      'data' in template ? template.data : {},
    );
  }

  // ----------------------------
  // Public API
  // ----------------------------

  async send(mailPayload: SendMessagePayload): Promise<void> {
    // ✅ Redis + Queue mode (PROD)
    if (this.redisEnabled && this.mailQueue) {
      await this.mailQueue.add('send', mailPayload, this.queueConfig.options);
      return;
    }

    // ✅ DEV MODE (Redis disabled)
    console.log('[MAIL] Redis disabled. Sending mail directly.');

    const html =
      typeof mailPayload.mailBodyOrTemplate === 'string'
        ? mailPayload.mailBodyOrTemplate
        : await this.renderTemplate(mailPayload.mailBodyOrTemplate);

    const message = this.configureMessage(
      mailPayload.to,
      mailPayload.subject,
      html,
      mailPayload.attachments,
      mailPayload.replyTo,
    );

    await this.transporter.sendMail(message);
  }
}
