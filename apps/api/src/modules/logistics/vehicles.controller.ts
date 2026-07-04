import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import {
  Permission,
  CreateVehicleDto,
  UpdateVehicleDto,
  AssignDriverDto,
} from '@futurefarm/types';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { VehiclesService } from './vehicles.service';

@ApiTags('Vehicles')
@Controller('logistics/vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @RequirePermissions(Permission.VEHICLE_CREATE)
  @ApiOperation({ summary: 'Register a new vehicle in the fleet' })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Get()
  @RequirePermissions(Permission.VEHICLE_READ)
  @ApiOperation({ summary: 'List all vehicles' })
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get(':id')
  @RequirePermissions(Permission.VEHICLE_READ)
  @ApiOperation({ summary: 'Get vehicle detail' })
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(id);
  }

  @Patch(':id')
  @RequirePermissions(Permission.VEHICLE_UPDATE)
  @ApiOperation({ summary: 'Update vehicle metadata' })
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(Permission.VEHICLE_DELETE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a vehicle (soft delete)' })
  deactivate(@Param('id') id: string) {
    return this.vehiclesService.deactivate(id);
  }

  @Post(':id/assign-driver')
  @RequirePermissions(Permission.VEHICLE_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign or unassign driver from vehicle' })
  assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.vehiclesService.assignDriver(id, dto.driverId);
  }
}
