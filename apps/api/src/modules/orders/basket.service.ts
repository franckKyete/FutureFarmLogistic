import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BasketEntity } from './entities/basket.entity';
import { BasketLineEntity } from './entities/basket-line.entity';
import { BasketStatus } from './entities/basket-status.enum';
import { HarvestEntity } from '../products/entities/harvest.entity';
import { HarvestStatus } from '@futurefarm/types';
import { AddBasketLineDto, UpdateBasketLineDto } from '@futurefarm/types';

@Injectable()
export class BasketService {
  constructor(
    @InjectRepository(BasketEntity)
    private readonly basketRepository: Repository<BasketEntity>,
    @InjectRepository(BasketLineEntity)
    private readonly basketLineRepository: Repository<BasketLineEntity>,
    @InjectRepository(HarvestEntity)
    private readonly harvestRepository: Repository<HarvestEntity>,
  ) {}

  async getOrCreateBasket(buyerId: string): Promise<BasketEntity> {
    let basket = await this.basketRepository.findOne({
      where: { buyerId, status: BasketStatus.ACTIVE },
      relations: ['lines', 'lines.harvest', 'lines.harvest.product'],
    });

    if (!basket) {
      basket = new BasketEntity();
      basket.buyerId = buyerId;
      basket.status = BasketStatus.ACTIVE;
      basket.lines = [];
      basket = await this.basketRepository.save(basket);
    }

    return basket;
  }

  async addBasketLine(
    buyerId: string,
    dto: AddBasketLineDto,
  ): Promise<BasketLineEntity> {
    const basket = await this.getOrCreateBasket(buyerId);

    const harvest = await this.harvestRepository.findOne({
      where: { id: dto.harvestId },
      relations: ['farmerProfile'],
    });
    if (!harvest) {
      throw new NotFoundException('Harvest batch not found');
    }

    if (harvest.status !== HarvestStatus.APPROVED) {
      throw new ConflictException(
        'Only approved harvests can be added to the basket',
      );
    }

    if (harvest.farmerProfile?.userId === buyerId) {
      throw new ConflictException('You cannot buy your own harvest');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const effectiveStock =
      Number(harvest.quantityInStock) - Number(harvest.stockMarge);
    if (dto.quantity > effectiveStock) {
      throw new BadRequestException(
        `Requested quantity (${dto.quantity}) exceeds available stock (${effectiveStock})`,
      );
    }

    let line = basket.lines.find((l) => l.harvestId === dto.harvestId);
    if (line) {
      const newQty = Number(line.quantity) + dto.quantity;
      if (newQty > effectiveStock) {
        throw new BadRequestException(
          `Total requested quantity (${newQty}) exceeds available stock (${effectiveStock})`,
        );
      }
      line.quantity = newQty;
      return this.basketLineRepository.save(line);
    } else {
      line = new BasketLineEntity();
      line.basketId = basket.id;
      line.harvestId = dto.harvestId;
      line.quantity = dto.quantity;
      return this.basketLineRepository.save(line);
    }
  }

  async updateBasketLine(
    buyerId: string,
    lineId: string,
    dto: UpdateBasketLineDto,
  ): Promise<BasketLineEntity> {
    const basket = await this.getOrCreateBasket(buyerId);
    const line = await this.basketLineRepository.findOne({
      where: { id: lineId, basketId: basket.id },
      relations: ['harvest'],
    });

    if (!line) {
      throw new NotFoundException('Basket line not found');
    }

    if (dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    const harvest = line.harvest;
    const effectiveStock =
      Number(harvest.quantityInStock) - Number(harvest.stockMarge);
    if (dto.quantity > effectiveStock) {
      throw new BadRequestException(
        `Requested quantity (${dto.quantity}) exceeds available stock (${effectiveStock})`,
      );
    }

    line.quantity = dto.quantity;
    return this.basketLineRepository.save(line);
  }

  async removeBasketLine(buyerId: string, lineId: string): Promise<void> {
    const basket = await this.getOrCreateBasket(buyerId);
    const line = await this.basketLineRepository.findOne({
      where: { id: lineId, basketId: basket.id },
    });

    if (!line) {
      throw new NotFoundException('Basket line not found');
    }

    await this.basketLineRepository.remove(line);
  }
}
