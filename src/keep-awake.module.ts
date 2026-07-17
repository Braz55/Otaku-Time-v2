import { Module, Global } from '@nestjs/common';
import { KeepAwakeService } from './keep-awake.service';

@Global()
@Module({
  providers: [KeepAwakeService],
  exports: [KeepAwakeService],
})
export class KeepAwakeModule {}
