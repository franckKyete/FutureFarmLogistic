import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VehicleType,
} from '@futurefarm/types';
import { VehicleEntity } from './entities/vehicle.entity';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepo: Repository<VehicleEntity>,
  ) {}

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async create(dto: CreateVehicleDto): Promise<VehicleEntity> {
    const existing = await this.vehicleRepo.findOne({
      where: { registrationPlate: dto.registrationPlate },
    });
    if (existing) {
      throw new ConflictException(
        `Vehicle with plate "${dto.registrationPlate}" already exists`,
      );
    }

    const vehicle = this.vehicleRepo.create({
      registrationPlate: dto.registrationPlate,
      type:              dto.type as VehicleType,
      capacityKg:        dto.capacityKg,
      capacityM3:        dto.capacityM3,
      isActive:          true,
    });

    return this.vehicleRepo.save(vehicle);
  }

  async findAll(): Promise<VehicleEntity[]> {
    return this.vehicleRepo.find({
      order: { createdAt: 'DESC' },
      relations: ['currentDriver'],
    });
  }

  async findOne(id: string): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepo.findOne({
      where: { id },
      relations: ['currentDriver'],
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle ${id} not found`);
    }
    return vehicle;
  }

  async update(id: string, dto: UpdateVehicleDto): Promise<VehicleEntity> {
    const vehicle = await this.findOne(id);

    if (dto.registrationPlate && dto.registrationPlate !== vehicle.registrationPlate) {
      const conflict = await this.vehicleRepo.findOne({
        where: { registrationPlate: dto.registrationPlate },
      });
      if (conflict) {
        throw new ConflictException(
          `Plate "${dto.registrationPlate}" is already in use`,
        );
      }
      vehicle.registrationPlate = dto.registrationPlate;
    }

    if (dto.type !== undefined)       vehicle.type       = dto.type as VehicleType;
    if (dto.capacityKg !== undefined) vehicle.capacityKg = dto.capacityKg;
    if (dto.capacityM3 !== undefined) vehicle.capacityM3 = dto.capacityM3;
    if (dto.isActive !== undefined)   vehicle.isActive   = dto.isActive;

    return this.vehicleRepo.save(vehicle);
  }

  /** Soft-deactivate a vehicle. Throws if it currently has a driver assigned. */
  async deactivate(id: string): Promise<void> {
    const vehicle = await this.findOne(id);
    if (vehicle.currentDriverId) {
      throw new BadRequestException(
        'Cannot deactivate a vehicle that has an assigned driver',
      );
    }
    vehicle.isActive = false;
    await this.vehicleRepo.save(vehicle);
  }

  // ---------------------------------------------------------------------------
  // Driver assignment
  // ---------------------------------------------------------------------------

  async assignDriver(vehicleId: string, driverId: string | null): Promise<VehicleEntity> {
    const vehicle = await this.findOne(vehicleId);

    if (driverId !== null) {
      // Ensure the driver doesn't already have a different vehicle
      const occupied = await this.vehicleRepo.findOne({
        where: { currentDriverId: driverId, isActive: true },
      });
      if (occupied && occupied.id !== vehicleId) {
        throw new ConflictException(
          `Driver ${driverId} is already assigned to vehicle ${occupied.id}`,
        );
      }
    }

    vehicle.currentDriverId = driverId;
    if (driverId === null) {
      vehicle.lastKnownLat = null;
      vehicle.lastKnownLon = null;
      vehicle.lastSeenAt   = null;
    }
    return this.vehicleRepo.save(vehicle);
  }

  /** Update the last known GPS position of a vehicle */
  async updatePosition(vehicleId: string, lat: number, lon: number): Promise<void> {
    await this.vehicleRepo.update(vehicleId, {
      lastKnownLat: lat,
      lastKnownLon: lon,
      lastSeenAt:   new Date(),
    });
  }
}
