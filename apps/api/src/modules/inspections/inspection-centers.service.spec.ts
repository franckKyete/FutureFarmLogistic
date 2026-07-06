/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InspectionCentersService } from './inspection-centers.service';
import { InspectionCenterEntity } from './entities/inspection-center.entity';
import { InspectorCenterAssignmentEntity } from './entities/inspector-center-assignment.entity';
import { InspectorProfileEntity } from './entities/inspector-profile.entity';

describe('InspectionCentersService', () => {
  let service: InspectionCentersService;
  let centerRepo: any;
  let assignmentRepo: any;
  let inspectorProfileRepo: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InspectionCentersService,
        {
          provide: getRepositoryToken(InspectionCenterEntity),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'center-1', ...x })),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InspectorCenterAssignmentEntity),
          useValue: {
            update: jest.fn(),
            create: jest.fn((x) => x),
            save: jest.fn((x) => Promise.resolve({ id: 'assign-1', ...x })),
            find: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(InspectorProfileEntity),
          useValue: {
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<InspectionCentersService>(InspectionCentersService);
    centerRepo = module.get(getRepositoryToken(InspectionCenterEntity));
    assignmentRepo = module.get(getRepositoryToken(InspectorCenterAssignmentEntity));
    inspectorProfileRepo = module.get(getRepositoryToken(InspectorProfileEntity));
  });

  describe('createCenter', () => {
    it('should throw BadRequestException if center with code already exists', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', code: 'C01' });
      await expect(service.createCenter({ name: 'Center 1', code: 'C01', regionName: 'Region', address: '123 Center St' })).rejects.toThrow(BadRequestException);
    });

    it('should successfully create center', async () => {
      centerRepo.findOne.mockResolvedValue(null);
      const result = await service.createCenter({ name: 'Center 1', code: 'C01', regionName: 'Region', address: '123 Center St' });
      expect(result).toBeDefined();
      expect(result.code).toBe('C01');
    });
  });

  describe('get, update, deactivate', () => {
    it('should get center by id', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', code: 'C01' });
      const result = await service.getCenter('center-1');
      expect(result.id).toBe('center-1');
    });

    it('should throw NotFoundException if center not found', async () => {
      centerRepo.findOne.mockResolvedValue(null);
      await expect(service.getCenter('center-1')).rejects.toThrow(NotFoundException);
    });

    it('should update center', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', code: 'C01' });
      const result = await service.updateCenter('center-1', { name: 'New Name' });
      expect(result.name).toBe('New Name');
    });

    it('should deactivate center', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', code: 'C01', isActive: true });
      await service.deactivateCenter('center-1');
      expect(centerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
    });
  });

  describe('assignInspector', () => {
    it('should throw BadRequestException if center is inactive', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', isActive: false });
      await expect(service.assignInspector('center-1', 'inspector-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if inspector profile not found', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', isActive: true });
      inspectorProfileRepo.findOne.mockResolvedValue(null);
      await expect(service.assignInspector('center-1', 'inspector-1')).rejects.toThrow(NotFoundException);
    });

    it('should assign inspector, clear previous active assignment and save new', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', isActive: true });
      inspectorProfileRepo.findOne.mockResolvedValue({ id: 'inspector-1' });

      const result = await service.assignInspector('center-1', 'inspector-1');
      expect(result).toBeDefined();
      expect(assignmentRepo.update).toHaveBeenCalledWith(
        { inspectorProfileId: 'inspector-1', isCurrentAssignment: true },
        { isCurrentAssignment: false },
      );
    });
  });

  describe('list inspects & assignments', () => {
    it('should list inspectors assigned to a center', async () => {
      centerRepo.findOne.mockResolvedValue({ id: 'center-1', isActive: true });
      assignmentRepo.find.mockResolvedValue([{ inspectorProfile: { id: 'inspector-1' } }]);

      const result = await service.listInspectorsForCenter('center-1');
      expect(result.length).toBe(1);
    });

    it('should get assigned center for inspector user id', async () => {
      inspectorProfileRepo.findOne.mockResolvedValue({ id: 'inspector-1' });
      assignmentRepo.findOne.mockResolvedValue({ center: { id: 'center-1' } });

      const result = await service.getAssignedCenter('user-1');
      expect(result!.id).toBe('center-1');
    });
  });
});
