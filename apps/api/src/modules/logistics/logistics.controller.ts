import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  Permission,
  AuthUser,
  CreateDeliveryRunDto,
  UpdateDeliveryRunDto,
  SkipStopDto,
  PushLocationDto,
  AssignDriverDto,
  AssignVehicleDto,
} from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { LogisticsService } from './logistics.service';

interface UploadedFileDto {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@ApiTags('Logistics')
@Controller('logistics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class LogisticsController {
  constructor(private readonly logisticsService: LogisticsService) {}

  // -------------------------------------------------------------------------
  // Delivery Runs
  // -------------------------------------------------------------------------

  @Post('runs')
  @RequirePermissions(Permission.DELIVERY_RUN_CREATE)
  @ApiOperation({ summary: 'Create a new delivery run with stops' })
  createRun(@Body() dto: CreateDeliveryRunDto) {
    return this.logisticsService.createRun(dto);
  }

  @Get('runs')
  @RequirePermissions(Permission.DELIVERY_RUN_READ_ALL)
  @ApiOperation({ summary: 'Admin: paginated list of all runs' })
  listAllRuns(
    @Query('page')  page?:  number,
    @Query('limit') limit?: number,
  ) {
    return this.logisticsService.listAllRuns(
      page  ? Number(page)  : 1,
      limit ? Number(limit) : 20,
    );
  }

  @Get('runs/my')
  @RequirePermissions(Permission.DELIVERY_RUN_READ)
  @ApiOperation({ summary: 'Driver: own assigned runs' })
  listMyRuns(@CurrentUser() user: AuthUser) {
    return this.logisticsService.listMyRuns(user.id);
  }

  @Get('runs/:id')
  @RequirePermissions(Permission.DELIVERY_RUN_READ)
  @ApiOperation({ summary: 'Get run detail with stops' })
  getRun(@Param('id') id: string) {
    return this.logisticsService.getRun(id);
  }

  @Patch('runs/:id')
  @RequirePermissions(Permission.DELIVERY_RUN_UPDATE)
  @ApiOperation({ summary: 'Update run metadata (scheduled_at, notes)' })
  updateRun(@Param('id') id: string, @Body() dto: UpdateDeliveryRunDto) {
    return this.logisticsService.updateRun(id, dto);
  }

  @Post('runs/:id/assign-driver')
  @RequirePermissions(Permission.DELIVERY_RUN_UPDATE)
  @ApiOperation({ summary: 'Assign or reassign driver to run' })
  assignDriver(@Param('id') id: string, @Body() dto: AssignDriverDto) {
    return this.logisticsService.assignDriver(id, dto.driverId!);
  }

  @Post('runs/:id/assign-vehicle')
  @RequirePermissions(Permission.DELIVERY_RUN_UPDATE)
  @ApiOperation({ summary: 'Assign or reassign vehicle to run' })
  assignVehicle(@Param('id') id: string, @Body() dto: AssignVehicleDto) {
    return this.logisticsService.assignVehicle(id, dto.vehicleId);
  }

  @Post('runs/:id/optimise')
  @RequirePermissions(Permission.DELIVERY_RUN_UPDATE)
  @ApiOperation({ summary: 'Re-run OSRM route optimisation on pending stops' })
  optimiseRun(@Param('id') id: string) {
    return this.logisticsService.optimiseRun(id);
  }

  @Post('runs/:id/start')
  @RequirePermissions(Permission.DELIVERY_STOP_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver: start the run' })
  startRun(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.logisticsService.startRun(id, user.id);
  }

  @Post('runs/:id/cancel')
  @RequirePermissions(Permission.DELIVERY_RUN_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: cancel a run' })
  cancelRun(@Param('id') id: string) {
    return this.logisticsService.cancelRun(id);
  }

  // -------------------------------------------------------------------------
  // Delivery Stops
  // -------------------------------------------------------------------------

  @Post('runs/:id/stops/:stopId/arrive')
  @RequirePermissions(Permission.DELIVERY_STOP_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver: mark arrived at stop' })
  arriveAtStop(
    @Param('id')     runId:  string,
    @Param('stopId') stopId: string,
    @CurrentUser()   user:   AuthUser,
  ) {
    return this.logisticsService.arriveAtStop(runId, stopId, user.id);
  }

  @Post('runs/:id/stops/:stopId/pickup-report')
  @RequirePermissions(Permission.DELIVERY_STOP_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver: link AI pickup inspection report to COLLECTION stop' })
  linkPickupReport(
    @Param('id')     runId:  string,
    @Param('stopId') stopId: string,
    @CurrentUser()   user:   AuthUser,
    @Body('reportId') reportId: string,
  ) {
    return this.logisticsService.createPickupReport(runId, stopId, user.id, reportId);
  }


  @Post('runs/:id/stops/:stopId/proof')
  @RequirePermissions(Permission.DELIVERY_STOP_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('photo'))
  @ApiOperation({ summary: 'Driver: upload delivery proof photo' })
  uploadProof(
    @Param('id')     runId:  string,
    @Param('stopId') stopId: string,
    @CurrentUser()   user:   AuthUser,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10 MB
          new FileTypeValidator({ fileType: 'image/(jpeg|png|webp)' }),
        ],
      }),
    )
    file: UploadedFileDto,
  ) {
    return this.logisticsService.uploadProofPhoto(
      runId,
      stopId,
      user.id,
      file.buffer,
      file.originalname,
      file.mimetype,
    );
  }

  @Post('runs/:id/stops/:stopId/complete')
  @RequirePermissions(Permission.DELIVERY_STOP_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver: mark stop completed' })
  completeStop(
    @Param('id')     runId:  string,
    @Param('stopId') stopId: string,
    @CurrentUser()   user:   AuthUser,
  ) {
    return this.logisticsService.completeStop(runId, stopId, user.id);
  }

  @Post('runs/:id/stops/:stopId/skip')
  @RequirePermissions(Permission.DELIVERY_STOP_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Driver: skip stop with reason' })
  skipStop(
    @Param('id')     runId:  string,
    @Param('stopId') stopId: string,
    @CurrentUser()   user:   AuthUser,
    @Body()          dto:    SkipStopDto,
  ) {
    return this.logisticsService.skipStop(runId, stopId, user.id, dto);
  }

  // -------------------------------------------------------------------------
  // Driver Tracking
  // -------------------------------------------------------------------------

  @Post('location')
  @RequirePermissions(Permission.DRIVER_LOCATION_PUSH)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'HTTP fallback: push driver GPS ping' })
  pushLocation(@CurrentUser() user: AuthUser, @Body() dto: PushLocationDto) {
    return this.logisticsService.pushLocation(user.id, dto);
  }

  @Get('runs/:id/location')
  @RequirePermissions(Permission.DRIVER_LOCATION_READ)
  @ApiOperation({ summary: 'Get last known driver position for a run' })
  getLastLocation(@Param('id') runId: string) {
    return this.logisticsService.getLastLocation(runId);
  }
}
