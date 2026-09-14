import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { DispatchService } from './dispatch.service';

@Processor('order-dispatch')
export class OrderDispatchProcessor {
  private readonly logger = new Logger(OrderDispatchProcessor.name);

  constructor(private readonly dispatchService: DispatchService) {}

  /**
   * Processes incoming paid orders sequentially (concurrency: 1)
   * to pack driver schedules and avoid overlapping route allocations.
   */
  @Process({ concurrency: 1 })
  async handleOrderDispatch(job: Job<{ orderId: string }>): Promise<void> {
    const { orderId } = job.data;
    this.logger.log(`Processing sequential dispatch for order ${orderId}`);
    try {
      await this.dispatchService.processOrderDispatch(orderId);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to process order dispatch for ${orderId}: ${msg}`);
      throw error;
    }
  }
}
