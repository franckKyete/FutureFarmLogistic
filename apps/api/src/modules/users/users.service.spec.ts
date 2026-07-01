/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './entities/user.entity';
import { RoleEntity } from '../roles/entities/role.entity';
import { FarmerProfileEntity } from './entities/farmer-profile.entity';
import { BuyerProfileEntity } from './entities/buyer-profile.entity';
import { ParcelEntity } from './entities/parcel.entity';
import {
  ConflictException,
  NotFoundException,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { UserStatus, BuyerBusinessType, ParcelStatus } from '@futurefarm/types';

describe('UsersService', () => {
  let service: UsersService;
  let usersRepository: any;
  let rolesRepository: any;
  let farmerProfileRepository: any;
  let buyerProfileRepository: any;
  let parcelRepository: any;

  const mockUsersRepository = {
    findAndCount: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const mockRolesRepository = {
    findOneBy: jest.fn(),
  };

  const mockFarmerProfileRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockBuyerProfileRepository = {
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockParcelRepository = {
    find: jest.fn(),
    findBy: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(UserEntity),
          useValue: mockUsersRepository,
        },
        {
          provide: getRepositoryToken(RoleEntity),
          useValue: mockRolesRepository,
        },
        {
          provide: getRepositoryToken(FarmerProfileEntity),
          useValue: mockFarmerProfileRepository,
        },
        {
          provide: getRepositoryToken(BuyerProfileEntity),
          useValue: mockBuyerProfileRepository,
        },
        {
          provide: getRepositoryToken(ParcelEntity),
          useValue: mockParcelRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    usersRepository = module.get(getRepositoryToken(UserEntity));
    rolesRepository = module.get(getRepositoryToken(RoleEntity));
    farmerProfileRepository = module.get(
      getRepositoryToken(FarmerProfileEntity),
    );
    buyerProfileRepository = module.get(getRepositoryToken(BuyerProfileEntity));
    parcelRepository = module.get(getRepositoryToken(ParcelEntity));

    jest.clearAllMocks();

    mockUsersRepository.findAndCount.mockReset();
    mockUsersRepository.findOne.mockReset();
    mockUsersRepository.findOneBy.mockReset();
    mockUsersRepository.create.mockReset();
    mockUsersRepository.save.mockReset();

    mockRolesRepository.findOneBy.mockReset();

    mockFarmerProfileRepository.findOne.mockReset();
    mockFarmerProfileRepository.findOneBy.mockReset();
    mockFarmerProfileRepository.create.mockReset();
    mockFarmerProfileRepository.save.mockReset();

    mockBuyerProfileRepository.findOne.mockReset();
    mockBuyerProfileRepository.findOneBy.mockReset();
    mockBuyerProfileRepository.create.mockReset();
    mockBuyerProfileRepository.save.mockReset();

    mockParcelRepository.find.mockReset();
    mockParcelRepository.findBy.mockReset();
    mockParcelRepository.findOne.mockReset();
    mockParcelRepository.findOneBy.mockReset();
    mockParcelRepository.create.mockReset();
    mockParcelRepository.save.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      usersRepository.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should throw NotFoundException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      await expect(service.findOne('id')).rejects.toThrow(NotFoundException);
    });

    it('should return user if found', async () => {
      const mockUser = { id: 'user-id' };
      usersRepository.findOne.mockResolvedValue(mockUser);
      const result = await service.findOne('user-id');
      expect(result).toEqual(mockUser);
    });
  });

  describe('registerFarmer', () => {
    const dto = {
      email: 'farmer@example.com',
      password: 'password123',
      firstName: 'Farmer',
      lastName: 'Bob',
      companyName: 'Farm Co',
      address: '123 Farm Rd',
      bio: 'Organic crops',
    };

    it('should throw ConflictException if email already registered', async () => {
      usersRepository.findOneBy.mockResolvedValue({ id: 'existing' });
      await expect(service.registerFarmer(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException if Farmer role is not configured', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      rolesRepository.findOneBy.mockResolvedValue(null);
      await expect(service.registerFarmer(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should successfully register farmer', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      rolesRepository.findOneBy.mockResolvedValue({
        id: 'role-id',
        name: 'Farmer',
      });
      usersRepository.create.mockReturnValue({ id: 'user-id' });
      usersRepository.save.mockResolvedValue({ id: 'user-id' });
      farmerProfileRepository.create.mockReturnValue({ id: 'profile-id' });
      farmerProfileRepository.save.mockResolvedValue({ id: 'profile-id' });

      const result = await service.registerFarmer(dto);
      expect(result).toEqual(expect.objectContaining({ id: 'user-id' }));
      expect(farmerProfileRepository.save).toHaveBeenCalled();
    });
  });

  describe('registerBuyer', () => {
    const dto = {
      email: 'buyer@example.com',
      password: 'password123',
      firstName: 'Buyer',
      lastName: 'Alice',
      companyName: 'Store Co',
      vatNumber: 'VAT123',
      businessType: BuyerBusinessType.RESTAURATEUR,
      billingAddress: '123 Bill St',
      shippingAddress: '123 Ship St',
    };

    it('should throw ConflictException if email already registered', async () => {
      usersRepository.findOneBy.mockResolvedValue({ id: 'existing' });
      await expect(service.registerBuyer(dto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw InternalServerErrorException if Buyer role is not configured', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      rolesRepository.findOneBy.mockResolvedValue(null);
      await expect(service.registerBuyer(dto)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should successfully register buyer', async () => {
      usersRepository.findOneBy.mockResolvedValue(null);
      rolesRepository.findOneBy.mockResolvedValue({
        id: 'role-id',
        name: 'Buyer',
      });
      usersRepository.create.mockReturnValue({ id: 'user-id' });
      usersRepository.save.mockResolvedValue({ id: 'user-id' });
      buyerProfileRepository.create.mockReturnValue({ id: 'profile-id' });
      buyerProfileRepository.save.mockResolvedValue({ id: 'profile-id' });

      const result = await service.registerBuyer(dto);
      expect(result).toEqual(expect.objectContaining({ id: 'user-id' }));
      expect(buyerProfileRepository.save).toHaveBeenCalled();
    });
  });

  describe('profile updates', () => {
    describe('updateFarmerProfile', () => {
      const updateFarmerDto = { companyName: 'New', address: 'New Rd' };

      it('should throw NotFoundException if farmer profile does not exist', async () => {
        farmerProfileRepository.findOne.mockResolvedValue(null);
        await expect(
          service.updateFarmerProfile('user-id', updateFarmerDto),
        ).rejects.toThrow(NotFoundException);
      });

      it('should save and update farmer profile', async () => {
        const mockProfile = {
          id: 'profile-id',
          companyName: 'Old',
          address: 'Old Rd',
        };
        farmerProfileRepository.findOne.mockResolvedValue(mockProfile);
        farmerProfileRepository.save.mockResolvedValue({
          ...mockProfile,
          companyName: 'New',
          address: 'New Rd',
        });

        const result = await service.updateFarmerProfile(
          'user-id',
          updateFarmerDto,
        );
        expect(result.companyName).toBe('New');
      });
    });

    describe('updateBuyerProfile', () => {
      const updateBuyerDto = {
        companyName: 'New',
        vatNumber: 'VATNEW',
        businessType: BuyerBusinessType.GROSSISTE,
        billingAddress: 'New Bill',
        shippingAddress: 'New Ship',
      };

      it('should throw NotFoundException if buyer profile does not exist', async () => {
        buyerProfileRepository.findOne.mockResolvedValue(null);
        await expect(
          service.updateBuyerProfile('user-id', updateBuyerDto),
        ).rejects.toThrow(NotFoundException);
      });

      it('should save and update buyer profile', async () => {
        const mockProfile = {
          id: 'profile-id',
          companyName: 'Old',
          vatNumber: 'VATOLD',
          businessType: BuyerBusinessType.GROSSISTE,
          billingAddress: 'Old Bill',
          shippingAddress: 'Old Ship',
        };
        buyerProfileRepository.findOneBy.mockResolvedValue(mockProfile);
        buyerProfileRepository.save.mockResolvedValue({
          ...mockProfile,
          companyName: 'New',
        });

        const result = await service.updateBuyerProfile(
          'user-id',
          updateBuyerDto,
        );
        expect(result.companyName).toBe('New');
      });
    });
  });

  describe('parcels', () => {
    const dto = {
      cadastralNumber: 'CAD123',
      sizeHectares: 5.5,
      locationCoordinates: '45.0, 5.0',
      cropTypes: ['Apples'],
    };

    describe('createParcel', () => {
      it('should throw ForbiddenException if user is not a Farmer', async () => {
        farmerProfileRepository.findOneBy.mockResolvedValue(null);
        await expect(service.createParcel('user-id', dto)).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('should create parcel linked to profile', async () => {
        farmerProfileRepository.findOneBy.mockResolvedValue({
          id: 'profile-id',
        });
        parcelRepository.create.mockReturnValue({ id: 'parcel-id' });
        parcelRepository.save.mockResolvedValue({ id: 'parcel-id' });

        const result = await service.createParcel('user-id', dto);
        expect(result).toEqual({ id: 'parcel-id' });
      });
    });

    describe('getMyParcels', () => {
      it('should throw ForbiddenException if user is not a Farmer', async () => {
        farmerProfileRepository.findOneBy.mockResolvedValue(null);
        await expect(service.getMyParcels('user-id')).rejects.toThrow(
          ForbiddenException,
        );
      });

      it('should return farmer parcels', async () => {
        farmerProfileRepository.findOneBy.mockResolvedValue({
          id: 'profile-id',
        });
        parcelRepository.findBy.mockResolvedValue([]);

        const result = await service.getMyParcels('user-id');
        expect(result).toEqual([]);
      });
    });

    describe('verifyParcel', () => {
      it('should throw NotFoundException if parcel does not exist', async () => {
        parcelRepository.findOneBy.mockResolvedValue(null);
        await expect(
          service.verifyParcel(
            'parcel-id',
            'inspector-id',
            ParcelStatus.VERIFIED,
          ),
        ).rejects.toThrow(NotFoundException);
      });

      it('should update parcel verification status', async () => {
        const mockParcel = { id: 'parcel-id', status: ParcelStatus.PENDING };
        parcelRepository.findOneBy.mockResolvedValue(mockParcel);
        parcelRepository.save.mockResolvedValue({
          ...mockParcel,
          status: ParcelStatus.VERIFIED,
        });

        const result = await service.verifyParcel(
          'parcel-id',
          'inspector-id',
          ParcelStatus.VERIFIED,
        );
        expect(result.status).toBe(ParcelStatus.VERIFIED);
      });
    });
  });

  describe('updateUserStatus', () => {
    it('should throw NotFoundException if user not found', async () => {
      usersRepository.findOne.mockResolvedValue(null);
      await expect(
        service.updateUserStatus('user-id', UserStatus.APPROVED),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update user status successfully', async () => {
      const mockUser = { id: 'user-id', status: UserStatus.PENDING_VALIDATION };
      usersRepository.findOne.mockResolvedValue(mockUser);
      usersRepository.save.mockResolvedValue({
        ...mockUser,
        status: UserStatus.APPROVED,
      });

      const result = await service.updateUserStatus(
        'user-id',
        UserStatus.APPROVED,
      );
      expect(result.status).toBe(UserStatus.APPROVED);
    });
  });
});
