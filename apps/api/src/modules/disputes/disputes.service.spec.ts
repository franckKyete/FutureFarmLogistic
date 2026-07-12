/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';

import { DisputesService } from './disputes.service';
import { DisputeEntity } from './entities/dispute.entity';
import { CreateDisputeDtoClass } from './dto/create-dispute.dto';
import { UpdateDisputeDtoClass } from './dto/update-dispute.dto';
import { ResolveDisputeDtoClass } from './dto/resolve-dispute.dto';
import { DisputeStatus, DisputeSeverity } from '@futurefarm/types';

describe('DisputesService', () => {
  let service: DisputesService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputesService,
        {
          provide: getRepositoryToken(DisputeEntity),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<DisputesService>(DisputesService);

    jest.clearAllMocks();

    mockRepository.find.mockReset();
    mockRepository.findOne.mockReset();
    mockRepository.create.mockReset();
    mockRepository.save.mockReset();
    mockRepository.remove.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return an array of disputes ordered by createdAt DESC', async () => {
      const mockDisputes = [
        {
          id: '1',
          title: 'Litige sur la qualité des produits',
          description: 'Les produits livrés ne correspondent pas à la commande.',
          status: DisputeStatus.OPEN,
          severity: DisputeSeverity.HIGH,
          relatedType: 'order',
          relatedId: 'order-1',
          createdAt: new Date('2024-01-02'),
        },
        {
          id: '2',
          title: 'Problème de livraison',
          description: 'La livraison a eu lieu avec 3 jours de retard.',
          status: DisputeStatus.UNDER_REVIEW,
          severity: DisputeSeverity.MEDIUM,
          relatedType: 'delivery',
          relatedId: 'delivery-1',
          createdAt: new Date('2024-01-01'),
        },
      ] as DisputeEntity[];

      mockRepository.find.mockResolvedValue(mockDisputes);

      const result = await service.findAll();

      expect(result).toEqual(mockDisputes);
      expect(mockRepository.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        relations: ['createdBy', 'assignedTo'],
      });
    });
  });

  describe('findOne', () => {
    it('should return a dispute when found', async () => {
      const mockDispute = {
        id: 'dispute-1',
        title: 'Litige sur le classement',
        description: 'Le classement des produits est incorrect.',
        status: DisputeStatus.OPEN,
        severity: DisputeSeverity.CRITICAL,
      } as DisputeEntity;

      mockRepository.findOne.mockResolvedValue(mockDispute);

      const result = await service.findOne('dispute-1');

      expect(result).toEqual(mockDispute);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        relations: ['createdBy', 'assignedTo'],
      });
    });

    it('should throw NotFoundException when dispute is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create and save a new dispute', async () => {
      const dto: CreateDisputeDtoClass = {
        title: 'Produit endommagé',
        description: 'Le colis est arrivé avec des produits abîmés.',
        severity: DisputeSeverity.HIGH,
        relatedType: 'order',
        relatedId: 'order-123',
      };

      const createdDispute = {
        id: 'new-dispute-1',
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        relatedType: dto.relatedType,
        relatedId: dto.relatedId,
        status: DisputeStatus.OPEN,
      } as DisputeEntity;

      mockRepository.create.mockReturnValue(createdDispute);
      mockRepository.save.mockResolvedValue(createdDispute);

      const result = await service.create(dto);

      expect(result).toEqual(createdDispute);
      expect(mockRepository.create).toHaveBeenCalledWith({
        title: dto.title,
        description: dto.description,
        severity: dto.severity,
        relatedType: dto.relatedType,
        relatedId: dto.relatedId,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(createdDispute);
    });
  });

  describe('update', () => {
    it('should update an existing dispute', async () => {
      const existingDispute = {
        id: 'dispute-1',
        title: 'Ancien titre',
        description: 'Ancienne description',
        severity: DisputeSeverity.LOW,
        relatedType: 'inspection',
        relatedId: 'inspection-1',
        status: DisputeStatus.OPEN,
      } as DisputeEntity;

      const dto: UpdateDisputeDtoClass = {
        title: 'Titre mis à jour',
        description: 'Description mise à jour',
      };

      const updatedDispute = {
        ...existingDispute,
        ...dto,
      } as DisputeEntity;

      mockRepository.findOne.mockResolvedValue(existingDispute);
      mockRepository.save.mockResolvedValue(updatedDispute);

      const result = await service.update('dispute-1', dto);

      expect(result).toEqual(updatedDispute);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        relations: ['createdBy', 'assignedTo'],
      });
      expect(mockRepository.save).toHaveBeenCalledWith(
        expect.objectContaining(dto),
      );
    });
  });

  describe('resolve', () => {
    it('should resolve a dispute with default RESOLVED status', async () => {
      const existingDispute = {
        id: 'dispute-1',
        title: 'Litige à résoudre',
        description: 'Description du litige.',
        status: DisputeStatus.OPEN,
        severity: DisputeSeverity.MEDIUM,
        resolutionNotes: null,
      } as DisputeEntity;

      const dto: ResolveDisputeDtoClass = {
        resolutionNotes: 'Après vérification, le litige est résolu.',
        status: undefined as any,
      };

      const resolvedDispute = {
        ...existingDispute,
        resolutionNotes: dto.resolutionNotes,
        status: DisputeStatus.RESOLVED,
      } as DisputeEntity;

      mockRepository.findOne.mockResolvedValue(existingDispute);
      mockRepository.save.mockResolvedValue(resolvedDispute);

      const result = await service.resolve('dispute-1', dto);

      expect(result.status).toBe(DisputeStatus.RESOLVED);
      expect(result.resolutionNotes).toBe(dto.resolutionNotes);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should dismiss a dispute when status is DISMISSED', async () => {
      const existingDispute = {
        id: 'dispute-2',
        title: 'Litige non fondé',
        description: 'Ce litige est infondé.',
        status: DisputeStatus.UNDER_REVIEW,
        severity: DisputeSeverity.LOW,
        resolutionNotes: null,
      } as DisputeEntity;

      const dto: ResolveDisputeDtoClass = {
        resolutionNotes: 'Aucune preuve suffisante.',
        status: DisputeStatus.DISMISSED,
      };

      const dismissedDispute = {
        ...existingDispute,
        resolutionNotes: dto.resolutionNotes,
        status: DisputeStatus.DISMISSED,
      } as DisputeEntity;

      mockRepository.findOne.mockResolvedValue(existingDispute);
      mockRepository.save.mockResolvedValue(dismissedDispute);

      const result = await service.resolve('dispute-2', dto);

      expect(result.status).toBe(DisputeStatus.DISMISSED);
      expect(result.resolutionNotes).toBe(dto.resolutionNotes);
      expect(mockRepository.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('should remove an existing dispute', async () => {
      const existingDispute = {
        id: 'dispute-1',
        title: 'Litige à supprimer',
        description: 'Ce litige doit être supprimé.',
      } as DisputeEntity;

      mockRepository.findOne.mockResolvedValue(existingDispute);
      mockRepository.remove.mockResolvedValue(existingDispute);

      await service.remove('dispute-1');

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'dispute-1' },
        relations: ['createdBy', 'assignedTo'],
      });
      expect(mockRepository.remove).toHaveBeenCalledWith(existingDispute);
    });

    it('should throw NotFoundException when dispute to remove is not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
