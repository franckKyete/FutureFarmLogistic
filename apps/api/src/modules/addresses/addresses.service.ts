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

  /**
   * Parse a single address string into structured parts.
   */
  parseAddressString(rawAddress?: string | null, fallbackCountry = 'COD'): {
    streetAddress: string;
    streetAddress2?: string | undefined;
    city: string;
    stateOrProvince?: string | undefined;
    country: string;
  } {
    if (!rawAddress || !rawAddress.trim()) {
      return {
        streetAddress: '',
        streetAddress2: undefined,
        city: '',
        stateOrProvince: undefined,
        country: fallbackCountry,
      };
    }

    const parts = rawAddress.split(',').map((p) => p.trim()).filter(Boolean);

    if (parts.length >= 4) {
      const country = parts[parts.length - 1];
      const stateOrProvince = parts[parts.length - 2];
      const city = parts[parts.length - 3];
      const remaining = parts.slice(0, parts.length - 3);

      return {
        streetAddress: remaining[0] || '',
        streetAddress2: remaining.slice(1).join(', ') || undefined,
        city: city || '',
        stateOrProvince: stateOrProvince || undefined,
        country: country || fallbackCountry,
      };
    }

    if (parts.length === 3) {
      return {
        streetAddress: parts[0] || '',
        streetAddress2: undefined,
        city: parts[1] || '',
        stateOrProvince: parts[1] || undefined,
        country: parts[2] || fallbackCountry,
      };
    }

    if (parts.length === 2) {
      return {
        streetAddress: parts[0] || '',
        streetAddress2: undefined,
        city: parts[1] || '',
        stateOrProvince: undefined,
        country: fallbackCountry,
      };
    }

    return {
      streetAddress: rawAddress.trim(),
      streetAddress2: undefined,
      city: '',
      stateOrProvince: undefined,
      country: fallbackCountry,
    };
  }

  /**
   * Upsert the primary / default address for a user or addressable entity.
   * Directly saves structured address properties (streetAddress, city, stateOrProvince, postalCode, country, etc.)
   */
  async upsertPrimaryAddress(
    addressableType: AddressableType,
    addressableId: string,
    addressInput: string | Partial<CreateAddressDto>,
    type: AddressType = AddressType.SHIPPING,
    extra?: Partial<CreateAddressDto>,
  ): Promise<AddressEntity | null> {
    if (!addressInput) {
      return null;
    }

    let streetAddress = '';
    let streetAddress2: string | null = null;
    let city = '';
    let stateOrProvince: string | null = null;
    let postalCode: string | null = null;
    let country = extra?.country || 'COD';
    let latitude: number | null = extra?.latitude ?? null;
    let longitude: number | null = extra?.longitude ?? null;
    let recipientName = extra?.recipientName || null;
    let phoneNumber = extra?.phoneNumber || null;

    if (typeof addressInput === 'object') {
      streetAddress = addressInput.streetAddress || '';
      streetAddress2 = addressInput.streetAddress2 || null;
      city = addressInput.city || '';
      stateOrProvince = addressInput.stateOrProvince || null;
      postalCode = addressInput.postalCode || null;
      country = addressInput.country || extra?.country || 'COD';
      latitude = addressInput.latitude ?? null;
      longitude = addressInput.longitude ?? null;
      if (addressInput.recipientName) recipientName = addressInput.recipientName;
      if (addressInput.phoneNumber) phoneNumber = addressInput.phoneNumber;
      if (addressInput.type) type = addressInput.type;
    } else if (typeof addressInput === 'string' && addressInput.trim()) {
      const parsed = this.parseAddressString(addressInput, extra?.country || 'COD');
      streetAddress = parsed.streetAddress;
      streetAddress2 = parsed.streetAddress2 || null;
      city = parsed.city;
      stateOrProvince = parsed.stateOrProvince || null;
      country = parsed.country;
    }

    if (!streetAddress && !city) {
      return null;
    }

    const existing = await this.addressRepo.findOne({
      where: { addressableType, addressableId, type },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });

    if (existing) {
      existing.streetAddress = streetAddress || existing.streetAddress;
      existing.streetAddress2 = streetAddress2 !== undefined ? streetAddress2 : existing.streetAddress2;
      existing.city = city || existing.city;
      existing.stateOrProvince = stateOrProvince !== undefined ? stateOrProvince : existing.stateOrProvince;
      existing.postalCode = postalCode !== undefined ? postalCode : existing.postalCode;
      existing.country = country || existing.country;
      existing.latitude = latitude !== null ? latitude : existing.latitude;
      existing.longitude = longitude !== null ? longitude : existing.longitude;
      existing.isDefault = true;
      if (recipientName) existing.recipientName = recipientName;
      if (phoneNumber) existing.phoneNumber = phoneNumber;
      return this.addressRepo.save(existing);
    }

    const newAddress = this.addressRepo.create({
      addressableType,
      addressableId,
      type,
      streetAddress: streetAddress || 'Kinshasa',
      streetAddress2,
      city: city || 'Kinshasa',
      stateOrProvince,
      postalCode,
      country: country || 'COD',
      latitude,
      longitude,
      isDefault: true,
      recipientName,
      phoneNumber,
    });

    return this.addressRepo.save(newAddress);
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
    } as Partial<AddressEntity>);

    return (await this.addressRepo.save(address)) as unknown as AddressEntity;
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
