import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AddressEntity } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressableType, AddressType } from '@futurefarm/types';

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(AddressEntity)
    private readonly addressRepo: Repository<AddressEntity>,
  ) {}

  async listForAddressable(
    addressableType: AddressableType,
    addressableId: string,
  ): Promise<AddressEntity[]> {
    return this.addressRepo.find({
      where: { addressableType, addressableId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async listForUser(userId: string): Promise<AddressEntity[]> {
    return this.listForAddressable(AddressableType.USER, userId);
  }

  async findById(id: string): Promise<AddressEntity> {
    const address = await this.addressRepo.findOne({ where: { id } });
    if (!address) {
      throw new NotFoundException(`Address #${id} not found`);
    }
    return address;
  }

  async createForAddressable(
    addressableType: AddressableType,
    addressableId: string,
    dto: CreateAddressDto,
  ): Promise<AddressEntity> {
    if (dto.isDefault) {
      await this.addressRepo.update(
        { addressableType, addressableId },
        { isDefault: false },
      );
    } else {
      // Check if this is the very first address for this addressable; if so, make it default
      const count = await this.addressRepo.count({
        where: { addressableType, addressableId },
      });
      if (count === 0) {
        dto.isDefault = true;
      }
    }

    const address = this.addressRepo.create({
      ...dto,
      addressableType,
      addressableId,
      type: dto.type || AddressType.SHIPPING,
      country: dto.country || 'COD',
      isDefault: dto.isDefault ?? false,
    });

    return this.addressRepo.save(address);
  }

  async createForUser(userId: string, dto: CreateAddressDto): Promise<AddressEntity> {
    return this.createForAddressable(AddressableType.USER, userId, dto);
  }

  async update(
    id: string,
    userId: string | null,
    dto: UpdateAddressDto,
    isAdmin = false,
  ): Promise<AddressEntity> {
    const address = await this.findById(id);

    if (!isAdmin && userId && address.addressableType === AddressableType.USER && address.addressableId !== userId) {
      throw new ForbiddenException('Cannot edit address belonging to another user');
    }

    if (dto.isDefault) {
      await this.addressRepo.update(
        {
          addressableType: address.addressableType,
          addressableId: address.addressableId,
        },
        { isDefault: false },
      );
    }

    Object.assign(address, dto);
    return this.addressRepo.save(address);
  }

  async setDefault(id: string, userId: string, isAdmin = false): Promise<AddressEntity> {
    const address = await this.findById(id);

    if (!isAdmin && address.addressableType === AddressableType.USER && address.addressableId !== userId) {
      throw new ForbiddenException('Cannot modify address belonging to another user');
    }

    await this.addressRepo.update(
      {
        addressableType: address.addressableType,
        addressableId: address.addressableId,
      },
      { isDefault: false },
    );

    address.isDefault = true;
    return this.addressRepo.save(address);
  }

  async delete(id: string, userId: string | null, isAdmin = false): Promise<void> {
    const address = await this.findById(id);

    if (!isAdmin && userId && address.addressableType === AddressableType.USER && address.addressableId !== userId) {
      throw new ForbiddenException('Cannot delete address belonging to another user');
    }

    const wasDefault = address.isDefault;
    const addressableType = address.addressableType;
    const addressableId = address.addressableId;

    await this.addressRepo.remove(address);

    if (wasDefault) {
      // Pick the next remaining address and set it as default
      const nextAddress = await this.addressRepo.findOne({
        where: { addressableType, addressableId },
        order: { createdAt: 'DESC' },
      });
      if (nextAddress) {
        nextAddress.isDefault = true;
        await this.addressRepo.save(nextAddress);
      }
    }
  }
}
