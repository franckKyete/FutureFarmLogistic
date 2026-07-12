/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import {
  DeliveryRunStatus,
  DisputeStatus,
  InspectionStatus,
} from '@futurefarm/types';

import { AdminService } from './admin.service';
import { UsersService } from '../users/users.service';
import { AuctionsService } from '../auctions/auctions.service';
import { LogisticsService } from '../logistics/logistics.service';
import { InspectionsService } from '../inspections/inspections.service';
import { OrdersService } from '../orders/orders.service';
import { DisputesService } from '../disputes/disputes.service';

describe('AdminService', () => {
  let service: AdminService;
  let mockUsersService: any;
  let mockAuctionsService: any;
  let mockLogisticsService: any;
  let mockInspectionsService: any;
  let mockOrdersService: any;
  let mockDisputesService: any;

  beforeEach(async () => {
    mockUsersService = { findAll: jest.fn() };
    mockAuctionsService = { listAuctions: jest.fn() };
    mockLogisticsService = { listAllRuns: jest.fn() };
    mockInspectionsService = { listAllReports: jest.fn() };
    mockOrdersService = { listAllOrdersAdmin: jest.fn() };
    mockDisputesService = { findAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: AuctionsService, useValue: mockAuctionsService },
        { provide: LogisticsService, useValue: mockLogisticsService },
        { provide: InspectionsService, useValue: mockInspectionsService },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: DisputesService, useValue: mockDisputesService },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);

    jest.clearAllMocks();

    // Reset all mocks
    mockUsersService.findAll.mockReset();
    mockAuctionsService.listAuctions.mockReset();
    mockLogisticsService.listAllRuns.mockReset();
    mockInspectionsService.listAllReports.mockReset();
    mockOrdersService.listAllOrdersAdmin.mockReset();
    mockDisputesService.findAll.mockReset();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDashboardStats', () => {
    it('should return dashboard stats with correct shape', async () => {
      mockUsersService.findAll
        .mockResolvedValueOnce({ data: [{ id: '1' }], meta: { total: 5 } })
        .mockResolvedValueOnce({ data: [], meta: { total: 2 } });
      mockAuctionsService.listAuctions.mockResolvedValue({
        data: [],
        meta: { total: 3 },
      });
      mockLogisticsService.listAllRuns.mockResolvedValue({
        data: [
          { status: DeliveryRunStatus.IN_PROGRESS },
          { status: DeliveryRunStatus.COMPLETED },
        ],
        total: 2,
      });
      mockInspectionsService.listAllReports.mockResolvedValue([
        { status: InspectionStatus.IN_PROGRESS },
        { status: InspectionStatus.SUBMITTED },
      ]);
      mockDisputesService.findAll.mockResolvedValue([
        { status: DisputeStatus.OPEN },
        { status: DisputeStatus.RESOLVED },
      ]);
      const now = new Date();
      mockOrdersService.listAllOrdersAdmin.mockResolvedValue({
        data: [
          {
            id: 'o1',
            totalAmount: 150,
            createdAt: now.toISOString(),
          },
        ],
        meta: { total: 1 },
      });

      const result = await service.getDashboardStats();

      expect(result).toHaveProperty('totalUsers', 5);
      expect(result).toHaveProperty('pendingValidations', 2);
      expect(result).toHaveProperty('activeAuctions', 3);
      expect(result).toHaveProperty('activeRuns', 1);
      expect(result).toHaveProperty('pendingInspections', 1);
      expect(result).toHaveProperty('openDisputes', 1);
      expect(result).toHaveProperty('monthlyRevenue', 150);
      expect(result).toHaveProperty('recentOrders');
      expect(result.recentOrders).toHaveLength(1);
    });

    it('should handle empty data gracefully', async () => {
      mockUsersService.findAll
        .mockResolvedValue({ data: [], meta: { total: 0 } });
      mockAuctionsService.listAuctions.mockResolvedValue({ data: [], meta: { total: 0 } });
      mockLogisticsService.listAllRuns.mockResolvedValue({ data: [], total: 0 });
      mockInspectionsService.listAllReports.mockResolvedValue([]);
      mockDisputesService.findAll.mockResolvedValue([]);
      mockOrdersService.listAllOrdersAdmin.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      const result = await service.getDashboardStats();

      expect(result.totalUsers).toBe(0);
      expect(result.pendingValidations).toBe(0);
      expect(result.activeAuctions).toBe(0);
      expect(result.activeRuns).toBe(0);
      expect(result.pendingInspections).toBe(0);
      expect(result.openDisputes).toBe(0);
      expect(result.monthlyRevenue).toBe(0);
      expect(result.recentOrders).toEqual([]);
    });

    it('should handle service errors gracefully', async () => {
      mockUsersService.findAll.mockRejectedValue(new Error('DB error'));
      mockAuctionsService.listAuctions.mockRejectedValue(new Error('DB error'));
      mockLogisticsService.listAllRuns.mockRejectedValue(new Error('DB error'));
      mockInspectionsService.listAllReports.mockRejectedValue(new Error('DB error'));
      mockDisputesService.findAll.mockRejectedValue(new Error('DB error'));
      mockOrdersService.listAllOrdersAdmin.mockRejectedValue(new Error('DB error'));

      const result = await service.getDashboardStats();

      expect(result.totalUsers).toBe(0);
      expect(result.pendingValidations).toBe(0);
      expect(result.activeAuctions).toBe(0);
      expect(result.activeRuns).toBe(0);
      expect(result.pendingInspections).toBe(0);
      expect(result.openDisputes).toBe(0);
      expect(result.monthlyRevenue).toBe(0);
      expect(result.recentOrders).toEqual([]);
    });
  });

  describe('getAnalytics', () => {
    it('should return analytics with revenue by month', async () => {
      const now = new Date();
      const orders = [];
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 15);
        orders.push({
          id: `order-${i}`,
          totalAmount: (i + 1) * 100,
          status: 'DELIVERED',
          createdAt: d.toISOString(),
          lines: [
            {
              harvest: {
                product: { id: `prod-${i}`, name: `Product ${i}` },
              },
              quantity: (i + 1) * 2,
            },
          ],
        });
      }

      mockOrdersService.listAllOrdersAdmin.mockResolvedValue({
        data: orders,
        meta: { total: 12 },
      });
      mockUsersService.findAll.mockResolvedValue({
        data: [
          { id: 'u1', roles: [{ name: 'Farmer' }, { name: 'Admin' }] },
          { id: 'u2', roles: [{ name: 'Buyer' }] },
        ],
        meta: { total: 2 },
      });

      const result = await service.getAnalytics();

      expect(result).toHaveProperty('revenueByMonth');
      expect(result.revenueByMonth).toHaveLength(12);
      expect(result).toHaveProperty('ordersByStatus');
      expect(result.ordersByStatus).toEqual({ DELIVERED: 12 });
      expect(result).toHaveProperty('usersByRole');
      expect(result.usersByRole).toEqual({ Farmer: 1, Admin: 1, Buyer: 1 });
      expect(result).toHaveProperty('topProducts');
      expect(result.topProducts).toHaveLength(10);
      expect(result.topProducts[0]).toHaveProperty('id');
      expect(result.topProducts[0]).toHaveProperty('name');
      expect(result.topProducts[0]).toHaveProperty('count');
    });

    it('should handle empty data gracefully', async () => {
      mockOrdersService.listAllOrdersAdmin.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });
      mockUsersService.findAll.mockResolvedValue({
        data: [],
        meta: { total: 0 },
      });

      const result = await service.getAnalytics();

      expect(result.revenueByMonth).toHaveLength(12);
      for (const entry of result.revenueByMonth) {
        expect(entry.revenue).toBe(0);
        expect(entry.month).toMatch(/^\d{4}-\d{2}$/);
      }
      expect(result.ordersByStatus).toEqual({});
      expect(result.usersByRole).toEqual({});
      expect(result.topProducts).toEqual([]);
    });

    it('should handle service errors gracefully', async () => {
      mockOrdersService.listAllOrdersAdmin.mockRejectedValue(new Error('DB error'));
      mockUsersService.findAll.mockRejectedValue(new Error('DB error'));

      const result = await service.getAnalytics();

      expect(result.revenueByMonth).toHaveLength(12);
      for (const entry of result.revenueByMonth) {
        expect(entry.revenue).toBe(0);
      }
      expect(result.ordersByStatus).toEqual({});
      expect(result.usersByRole).toEqual({});
      expect(result.topProducts).toEqual([]);
    });
  });
});
