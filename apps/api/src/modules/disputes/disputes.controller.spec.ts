/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';

import { DisputesController } from './disputes.controller';
import { DisputesService } from './disputes.service';
import { DisputeStatus, DisputeSeverity } from '@futurefarm/types';

describe('DisputesController', () => {
  let controller: DisputesController;

  const mockService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    resolve: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputesController],
      providers: [
        {
          provide: DisputesService,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<DisputesController>(DisputesController);

    jest.clearAllMocks();

    mockService.findAll.mockReset();
    mockService.findOne.mockReset();
    mockService.create.mockReset();
    mockService.update.mockReset();
    mockService.resolve.mockReset();
    mockService.remove.mockReset();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll() and return the result', async () => {
      const mockDisputes = [
        { id: '1', title: 'Litige test', status: DisputeStatus.OPEN },
      ];
      mockService.findAll.mockResolvedValue(mockDisputes);

      const result = await controller.findAll();

      expect(result).toEqual(mockDisputes);
      expect(mockService.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should call service.findOne(id) with the given id', async () => {
      const mockDispute = {
        id: 'dispute-1',
        title: 'Litige sur la livraison',
      };
      mockService.findOne.mockResolvedValue(mockDispute);

      const result = await controller.findOne('dispute-1');

      expect(result).toEqual(mockDispute);
      expect(mockService.findOne).toHaveBeenCalledWith('dispute-1');
    });
  });

  describe('create', () => {
    it('should call service.create(dto) and return the result with 201 status', async () => {
      const dto = {
        title: 'Produit endommagé',
        description: 'Le colis est arrivé abîmé.',
        severity: DisputeSeverity.HIGH,
        relatedType: 'order' as const,
        relatedId: 'order-456',
      };

      const createdDispute = { id: 'new-dispute', ...dto };
      mockService.create.mockResolvedValue(createdDispute);

      const result = await controller.create(dto as any);

      expect(result).toEqual(createdDispute);
      expect(mockService.create).toHaveBeenCalledWith(dto);
    });

    it('should have HttpCode(HttpStatus.CREATED) decorator', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        DisputesController.prototype.create,
      );
      expect(metadata).toBe(HttpStatus.CREATED);
    });
  });

  describe('update', () => {
    it('should call service.update(id, dto) with the given id and dto', async () => {
      const dto = {
        title: 'Titre mis à jour',
      };

      const updatedDispute = {
        id: 'dispute-1',
        title: 'Titre mis à jour',
        description: 'Description existante',
        severity: DisputeSeverity.LOW,
      };
      mockService.update.mockResolvedValue(updatedDispute);

      const result = await controller.update('dispute-1', dto as any);

      expect(result).toEqual(updatedDispute);
      expect(mockService.update).toHaveBeenCalledWith('dispute-1', dto);
    });
  });

  describe('resolve', () => {
    it('should call service.resolve(id, dto) with the given id and dto', async () => {
      const dto = {
        resolutionNotes: 'Litige résolu après examen.',
        status: DisputeStatus.RESOLVED,
      };

      const resolvedDispute = {
        id: 'dispute-1',
        status: DisputeStatus.RESOLVED,
        resolutionNotes: 'Litige résolu après examen.',
      };
      mockService.resolve.mockResolvedValue(resolvedDispute);

      const result = await controller.resolve('dispute-1', dto as any);

      expect(result).toEqual(resolvedDispute);
      expect(mockService.resolve).toHaveBeenCalledWith('dispute-1', dto);
    });
  });

  describe('remove', () => {
    it('should call service.remove(id) with the given id', async () => {
      mockService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('dispute-1');

      expect(result).toBeUndefined();
      expect(mockService.remove).toHaveBeenCalledWith('dispute-1');
    });

    it('should have HttpCode(HttpStatus.NO_CONTENT) decorator', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        DisputesController.prototype.remove,
      );
      expect(metadata).toBe(HttpStatus.NO_CONTENT);
    });
  });
});
