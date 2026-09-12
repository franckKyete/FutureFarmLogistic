import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FeeCalculationType,
  OrderAppliedFeeDto,
} from '@futurefarm/types';
import { PlatformFeeEntity } from './entities/platform-fee.entity';
import { CreatePlatformFeeRequestDto } from './dto/create-platform-fee.dto';
import { UpdatePlatformFeeRequestDto } from './dto/update-platform-fee.dto';

@Injectable()
export class FeesService {
  constructor(
    @InjectRepository(PlatformFeeEntity)
    private readonly feeRepo: Repository<PlatformFeeEntity>,
  ) {}

  async getActiveFees(): Promise<PlatformFeeEntity[]> {
    return this.feeRepo.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async getAllForAdmin(): Promise<PlatformFeeEntity[]> {
    return this.feeRepo.find({
      order: { displayOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findById(id: string): Promise<PlatformFeeEntity> {
    const fee = await this.feeRepo.findOne({ where: { id } });
    if (!fee) {
      throw new NotFoundException(`Platform fee configuration with ID "${id}" not found.`);
    }
    return fee;
  }

  async createFee(dto: CreatePlatformFeeRequestDto): Promise<PlatformFeeEntity> {
    const existing = await this.feeRepo.findOne({
      where: { code: dto.code.toUpperCase().trim() },
    });
    if (existing) {
      throw new ConflictException(`Fee with code "${dto.code}" already exists.`);
    }

    const fee = this.feeRepo.create({
      name: dto.name.trim(),
      code: dto.code.toUpperCase().trim(),
      calculationType: dto.calculationType,
      value: Number(dto.value),
      currency: (dto.currency || 'USD').toUpperCase().trim(),
      isActive: dto.isActive !== undefined ? dto.isActive : true,
      description: dto.description ? dto.description.trim() : null,
      displayOrder: dto.displayOrder !== undefined ? dto.displayOrder : 0,
    });

    return this.feeRepo.save(fee);
  }

  async updateFee(id: string, dto: UpdatePlatformFeeRequestDto): Promise<PlatformFeeEntity> {
    const fee = await this.findById(id);

    if (dto.code && dto.code.toUpperCase().trim() !== fee.code) {
      const existing = await this.feeRepo.findOne({
        where: { code: dto.code.toUpperCase().trim() },
      });
      if (existing) {
        throw new ConflictException(`Fee with code "${dto.code}" already exists.`);
      }
      fee.code = dto.code.toUpperCase().trim();
    }

    if (dto.name !== undefined) fee.name = dto.name.trim();
    if (dto.calculationType !== undefined) fee.calculationType = dto.calculationType;
    if (dto.value !== undefined) fee.value = Number(dto.value);
    if (dto.currency !== undefined) fee.currency = dto.currency.toUpperCase().trim();
    if (dto.isActive !== undefined) fee.isActive = dto.isActive;
    if (dto.description !== undefined) fee.description = dto.description ? dto.description.trim() : null;
    if (dto.displayOrder !== undefined) fee.displayOrder = dto.displayOrder;

    return this.feeRepo.save(fee);
  }

  async deleteFee(id: string): Promise<void> {
    const fee = await this.findById(id);
    await this.feeRepo.remove(fee);
  }

  /**
   * Calculate all active fees for an order based on the crops subtotal and exchange rate against USD.
   */
  async calculateFeesForOrder(
    subtotalInCurrency: number,
    exchangeRate: number,
  ): Promise<{
    fees: OrderAppliedFeeDto[];
    totalFeesAmount: number;
    totalFeesAmountUSD: number;
  }> {
    const activeFees = await this.getActiveFees();
    const applied: OrderAppliedFeeDto[] = [];
    let totalFees = 0;

    for (const fee of activeFees) {
      let feeAmount = 0;
      let feeAmountUSD = 0;

      if (fee.calculationType === FeeCalculationType.FIXED) {
        feeAmountUSD = Number(fee.value);
        feeAmount = Number((feeAmountUSD * exchangeRate).toFixed(2));
      } else if (fee.calculationType === FeeCalculationType.PERCENTAGE) {
        feeAmount = Number(((subtotalInCurrency * Number(fee.value)) / 100).toFixed(2));
        feeAmountUSD = Number((feeAmount / exchangeRate).toFixed(2));
      }

      applied.push({
        feeConfigId: fee.id,
        name: fee.name,
        code: fee.code,
        calculationType: fee.calculationType,
        rateOrValue: Number(fee.value),
        amount: feeAmount,
        amountUSD: feeAmountUSD,
      });

      totalFees += feeAmount;
    }

    const totalFeesAmount = Number(totalFees.toFixed(2));
    const totalFeesAmountUSD = Number((totalFeesAmount / exchangeRate).toFixed(2));

    return {
      fees: applied,
      totalFeesAmount,
      totalFeesAmountUSD,
    };
  }
}
