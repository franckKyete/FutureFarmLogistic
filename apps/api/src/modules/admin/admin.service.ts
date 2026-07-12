import { Injectable } from '@nestjs/common';

import {
  AuctionStatus,
  DeliveryRunStatus,
  DisputeStatus,
  InspectionStatus,
  UserStatus,
} from '@futurefarm/types';

import { UsersService } from '../users/users.service';
import { AuctionsService } from '../auctions/auctions.service';
import { LogisticsService } from '../logistics/logistics.service';
import { InspectionsService } from '../inspections/inspections.service';
import { OrdersService } from '../orders/orders.service';
import { DisputesService } from '../disputes/disputes.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly usersService: UsersService,
    private readonly auctionsService: AuctionsService,
    private readonly logisticsService: LogisticsService,
    private readonly inspectionsService: InspectionsService,
    private readonly ordersService: OrdersService,
    private readonly disputesService: DisputesService,
  ) {}

  async getDashboardStats(): Promise<{
    totalUsers: number;
    pendingValidations: number;
    activeAuctions: number;
    activeRuns: number;
    pendingInspections: number;
    openDisputes: number;
    monthlyRevenue: number;
    recentOrders: unknown[];
  }> {
    const [
      allUsers,
      pendingUsers,
      auctionsResult,
      runsResult,
      allInspections,
      allDisputes,
      ordersResult,
    ] = await Promise.all([
      this.safeUsersFindAll({ limit: 1 }),
      this.safeUsersFindAll({ status: UserStatus.PENDING_VALIDATION, limit: 1 }),
      this.safeListAuctions({ status: AuctionStatus.ACTIVE, limit: 1 }),
      this.safeListAllRuns(1, 1000),
      this.safeListAllReports(),
      this.safeDisputesFindAll(),
      this.safeListAllOrdersAdmin({ limit: 1000 }),
    ]);

    const activeRuns = runsResult.data.filter(
      (r) => r.status === DeliveryRunStatus.IN_PROGRESS,
    ).length;

    const pendingInspections = allInspections.filter(
      (i) => i.status === InspectionStatus.IN_PROGRESS,
    ).length;

    const openDisputes = allDisputes.filter(
      (d) => d.status === DisputeStatus.OPEN,
    ).length;

    const now = new Date();
    const monthlyRevenue = ordersResult.data
      .filter((o) => {
        const d = new Date(o.createdAt);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, o) => sum + Number(o.totalAmount), 0);

    const recentOrders = ordersResult.data.slice(0, 10);

    return {
      totalUsers: allUsers.meta.total,
      pendingValidations: pendingUsers.meta.total,
      activeAuctions: auctionsResult.meta.total,
      activeRuns,
      pendingInspections,
      openDisputes,
      monthlyRevenue,
      recentOrders,
    };
  }

  async getAnalytics(): Promise<{
    revenueByMonth: Array<{ month: string; revenue: number }>;
    ordersByStatus: Record<string, number>;
    usersByRole: Record<string, number>;
    topProducts: Array<{ id: string; name: string; count: number }>;
  }> {
    const [ordersResult, usersResult] = await Promise.all([
      this.safeListAllOrdersAdmin({ limit: 10000 }),
      this.safeUsersFindAll({ limit: 10000 }),
    ]);

    const now = new Date();
    const revenueByMonth: Array<{ month: string; revenue: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      revenueByMonth.push({ month: key, revenue: 0 });
    }

    for (const order of ordersResult.data) {
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const bucket = revenueByMonth.find((r) => r.month === key);
      if (bucket) {
        bucket.revenue += Number(order.totalAmount);
      }
    }

    const ordersByStatus: Record<string, number> = {};
    for (const order of ordersResult.data) {
      const status = order.status;
      ordersByStatus[status] = (ordersByStatus[status] ?? 0) + 1;
    }

    const usersByRole: Record<string, number> = {};
    for (const user of usersResult.data) {
      if (user.roles) {
        for (const role of user.roles) {
          const roleName = role.name;
          usersByRole[roleName] = (usersByRole[roleName] ?? 0) + 1;
        }
      }
    }

    const productCount: Record<string, { id: string; name: string; count: number }> = {};
    for (const order of ordersResult.data) {
      const lines = (order as any).lines;
      if (lines) {
        for (const line of lines) {
          const product = line.harvest?.product;
          if (product) {
            const existing = productCount[product.id];
            if (existing) {
              existing.count += Number(line.quantity);
            } else {
              productCount[product.id] = { id: product.id, name: product.name, count: Number(line.quantity) };
            }
          }
        }
      }
    }
    const topProducts = Object.values(productCount)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      revenueByMonth,
      ordersByStatus,
      usersByRole,
      topProducts,
    };
  }

  private async safeUsersFindAll(query: any) {
    try {
      return await this.usersService.findAll(query);
    } catch {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
    }
  }

  private async safeListAuctions(query: any) {
    try {
      return await this.auctionsService.listAuctions(query);
    } catch {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
    }
  }

  private async safeListAllRuns(page: number, limit: number) {
    try {
      return await this.logisticsService.listAllRuns(page, limit);
    } catch {
      return { data: [], total: 0 };
    }
  }

  private async safeListAllReports() {
    try {
      return await this.inspectionsService.listAllReports();
    } catch {
      return [];
    }
  }

  private async safeDisputesFindAll() {
    try {
      return await this.disputesService.findAll();
    } catch {
      return [];
    }
  }

  private async safeListAllOrdersAdmin(options: { limit: number }) {
    try {
      return await this.ordersService.listAllOrdersAdmin(options);
    } catch {
      return { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0, hasNextPage: false, hasPreviousPage: false } };
    }
  }
}
