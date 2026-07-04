import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { VehicleType } from '@futurefarm/types';
import { VehiclesService } from './vehicles.service';
import { VehicleEntity } from './entities/vehicle.entity';

describe('VehiclesService', () => {
  let service: VehiclesService;
  let vehicleRepo: any;

  const mockVehicleRepo = {
    findOne: jest.fn(),
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'vehicle-id', ...entity })),
    find: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VehiclesService,
        {
          provide: getRepositoryToken(VehicleEntity),
          useValue: mockVehicleRepo,
        },
      ],
    }).compile();

    service = module.get<VehiclesService>(VehiclesService);
    vehicleRepo = module.get(getRepositoryToken(VehicleEntity));

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new vehicle', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);
      const dto = {
        registrationPlate: 'AB-123-CD',
        type: VehicleType.TRUCK,
        capacityKg: 5000,
        capacityM3: 20,
      };

      const result = await service.create(dto);
      expect(result).toBeDefined();
      expect(result.registrationPlate).toBe(dto.registrationPlate);
      expect(vehicleRepo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if registration plate already exists', async () => {
      vehicleRepo.findOne.mockResolvedValue({ id: 'exists' });
      const dto = {
        registrationPlate: 'AB-123-CD',
        type: VehicleType.TRUCK,
        capacityKg: 5000,
        capacityM3: 20,
      };

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return a vehicle if it exists', async () => {
      const mockVehicle = { id: 'vehicle-id', registrationPlate: 'AB-123-CD' };
      vehicleRepo.findOne.mockResolvedValue(mockVehicle);

      const result = await service.findOne('vehicle-id');
      expect(result).toEqual(mockVehicle);
    });

    it('should throw NotFoundException if vehicle does not exist', async () => {
      vehicleRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('deactivate', () => {
    it('should deactivate vehicle if no driver is assigned', async () => {
      const mockVehicle = { id: 'vehicle-id', currentDriverId: null, isActive: true };
      vehicleRepo.findOne.mockResolvedValue(mockVehicle);

      await service.deactivate('vehicle-id');
      expect(mockVehicle.isActive).toBe(false);
      expect(vehicleRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if driver is assigned', async () => {
      const mockVehicle = { id: 'vehicle-id', currentDriverId: 'driver-123', isActive: true };
      vehicleRepo.findOne.mockResolvedValue(mockVehicle);

      await expect(service.deactivate('vehicle-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignDriver', () => {
    it('should assign a driver to vehicle', async () => {
      const mockVehicle = { id: 'vehicle-id', currentDriverId: null };
      vehicleRepo.findOne.mockResolvedValue(mockVehicle);
      vehicleRepo.findOne.mockImplementation((opt: any) => {
        // Mock check for occupied driver
        if (opt.where?.currentDriverId === 'driver-123') return Promise.resolve(null);
        return Promise.resolve(mockVehicle);
      });

      const result = await service.assignDriver('vehicle-id', 'driver-123');
      expect(result.currentDriverId).toBe('driver-123');
    });

    it('should throw ConflictException if driver is already assigned elsewhere', async () => {
      const mockVehicle = { id: 'vehicle-id', currentDriverId: null };
      const otherVehicle = { id: 'other-id', currentDriverId: 'driver-123' };
      vehicleRepo.findOne.mockImplementation((opt: any) => {
        if (opt.where?.id === 'vehicle-id') return Promise.resolve(mockVehicle);
        if (opt.where?.currentDriverId === 'driver-123') return Promise.resolve(otherVehicle);
        return Promise.resolve(null);
      });

      await expect(service.assignDriver('vehicle-id', 'driver-123')).rejects.toThrow(ConflictException);
    });
  });
});
