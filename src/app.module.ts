import * as path from 'path';
import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { MulterModule } from '@nestjs/platform-express';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { CacheModule } from '@nestjs/cache-manager';
import { CommonModule, StorageService } from '@Common';
import { AppController } from './app.controller';
import { AppCacheInterceptor } from './app-cache.interceptor';
import { PrismaModule } from './prisma';
import { AuthModule } from './auth';
import { RedisModule } from './redis';
import { CategoriesModule } from './categories/categories.module';
import { I18nModule, QueryResolver } from 'nestjs-i18n';
import { SubcategoriesModule } from './subcategories/subcategories.module';
import { ContentTypesModule } from './content-types/content-types.module';
import { IngestionModule } from './ingestion/ingestion.module';

const redisEnabled = process.env.REDIS_ENABLED === 'true';

@Module({
  imports: [
    I18nModule.forRoot({
      fallbackLanguage: 'hi',
      loaderOptions: {
        path: path.join(process.cwd(), 'src/i18n'),
        includeSubfolders: true,
        watch: true,
      },
      resolvers: [{ use: QueryResolver, options: ['lang'] }],
    }),

    MulterModule.registerAsync({
      useFactory: (storageService: StorageService) => ({
        ...storageService.defaultMulterOptions,
      }),
      inject: [StorageService],
    }),

    CacheModule.register({
      isGlobal: true,
      ttl: 600,
      max: 1000,
    }),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    CommonModule,
    PrismaModule,

    ...(redisEnabled ? [RedisModule] : []),

    AuthModule,
    CategoriesModule,
    SubcategoriesModule,
    ContentTypesModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AppCacheInterceptor,
    },
  ],
})
export class AppModule {}
