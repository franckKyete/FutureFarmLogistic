/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { DriverProfileService } from './driver-profile.service';
import { DriverProfileEntity } from './entities/driver-profile.entity';
import { UserEntity } from '../users/entities/user.entity';

describe('DriverProfileService', () => {
  let service: DriverProfileService;
  let driverProfileRepo: any;
  let userRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriverProfileService,
        {
          provide: getRepositoryToken(DriverProfileEntity),
          useValue: {
            findOneBy: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'profile-1', ...x })),
            remove: jest.fn(),
            findAndCount: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(UserEntity),
          useValue: {
            findOneBy: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<DriverProfileService>(DriverProfileService);
    driverProfileRepo = module.get(getRepositoryToken(DriverProfileEntity));
    userRepo = module.get(getRepositoryToken(UserEntity));
  });

  describe('createProfile', () => {
    it('should throw NotFoundException if user not found', async () => {
      userRepo.findOneBy.mockResolvedValue(null);
      await expect(service.createProfile({ userId: 'user-1', licenseNumber: 'L123', licenseCategory: 'B' })).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if profile already exists', async () => {
      userRepo.findOneBy.mockResolvedValue({ id: 'user-1' });
      driverProfileRepo.findOneBy.mockResolvedValue({ id: 'profile-1' });
      await expect(service.createProfile({ userId: 'user-1', licenseNumber: 'L123', licenseCategory: 'B' })).rejects.toThrow(ConflictException);
    });

    it('should create and return driver profile', async () => {
      userRepo.findOneBy.mockResolvedValue({ id: 'user-1' });
      driverProfileRepo.findOneBy.mockResolvedValue(null);

      const result = await service.createProfile({ userId: 'user-1', licenseNumber: 'L123', licenseCategory: 'B' });
      expect(result).toBeDefined();
      expect(result.userId).toBe('user-1');
    });
  });

  describe('get, update, delete', () => {
    it('should throw NotFoundException if profile does not exist', async () => {
      driverProfileRepo.findOne.mockResolvedValue(null);
      await expect(service.getProfileByUserId('user-1')).rejects.toThrow(NotFoundException);
    });

    it('should get profile by user id', async () => {
      driverProfileRepo.findOne.mockResolvedValue({ id: 'profile-1', userId: 'user-1' });
      const result = await service.getProfileByUserId('user-1');
      expect(result.id).toBe('profile-1');
    });

    it('should update driver profile fields', async () => {
      const mockProfile = { id: 'profile-1', userId: 'user-1', licenseNumber: 'L123' };
      driverProfileRepo.findOne.mockResolvedValue(mockProfile);
      driverProfileRepo.save.mockImplementation((x: any) => Promise.resolve(x));

      const result = await service.updateProfileByUserId('user-1', { licenseNumber: 'L456' });
      expect(result.licenseNumber).toBe('L456');
    });

    it('should delete driver profile successfully', async () => {
      const mockProfile = { id: 'profile-1', userId: 'user-1' };
      driverProfileRepo.findOne.mockResolvedValue(mockProfile);
      await service.deleteProfileByUserId('user-1');
      expect(driverProfileRepo.remove).toHaveBeenCalledWith(mockProfile);
    });
  });

  describe('listProfiles', () => {
    it('should list driver profiles paginated', async () => {
      driverProfileRepo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.listProfiles(1, 10);
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
