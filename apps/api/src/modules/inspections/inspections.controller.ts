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

import { Permission, AuthUser } from '@futurefarm/types';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';

import { InspectionsService } from './inspections.service';
import { CreateInspectorProfileDtoClass } from './dto/create-inspector-profile.dto';
import { CreateInspectionReportDtoClass } from './dto/create-inspection-report.dto';
import { UpdateInspectionReportDtoClass } from './dto/update-inspection-report.dto';
import { SubmitInspectionReportDtoClass } from './dto/submit-inspection-report.dto';
import { CreateInspectionPhotoDtoClass } from './dto/create-inspection-photo.dto';

@ApiTags('Inspections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('inspections')
export class InspectionsController {
  constructor(private readonly inspectionsService: InspectionsService) {}

  // --- Inspector Profile ---

  @Post('profile')
  @RequirePermissions(Permission.INSPECTOR_PROFILE_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create or activate own inspector profile' })
  createProfile(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInspectorProfileDtoClass,
  ) {
    return this.inspectionsService.createInspectorProfile(user.id, dto);
  }

  @Get('profile/me')
  @RequirePermissions(Permission.INSPECTOR_PROFILE_READ)
  @ApiOperation({ summary: 'Get own inspector profile details' })
  getProfile(@CurrentUser() user: AuthUser) {
    return this.inspectionsService.getInspectorProfile(user.id);
  }

  // --- Inspection Reports ---

  @Post('reports')
  @RequirePermissions(Permission.INSPECTION_CREATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a quality inspection report for a harvest' })
  createReport(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateInspectionReportDtoClass,
  ) {
    return this.inspectionsService.createReport(user.id, dto);
  }

  @Get('reports')
  @RequirePermissions(Permission.INSPECTION_READ_ALL)
  @ApiOperation({ summary: 'Admin/System: list all inspection reports' })
  listAll() {
    return this.inspectionsService.listAllReports();
  }

  @Get('reports/me')
  @RequirePermissions(Permission.INSPECTION_READ)
  @ApiOperation({ summary: 'Inspector: list own inspection reports' })
  listMyReports(@CurrentUser() user: AuthUser) {
    return this.inspectionsService.listReportsForInspector(user.id);
  }

  @Get('reports/:id')
  @RequirePermissions(Permission.INSPECTION_READ)
  @ApiOperation({ summary: 'Get a single inspection report detail' })
  getOne(@Param('id') id: string) {
    return this.inspectionsService.getReport(id);
  }

  @Patch('reports/:id')
  @RequirePermissions(Permission.INSPECTION_UPDATE)
  @ApiOperation({ summary: 'Update an in-progress inspection report' })
  updateReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateInspectionReportDtoClass,
  ) {
    return this.inspectionsService.updateReport(id, user.id, dto);
  }

  // --- Photos Management ---

  @Post('reports/:id/photos')
  @RequirePermissions(Permission.INSPECTION_UPDATE)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a photo to an in-progress report' })
  addPhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateInspectionPhotoDtoClass,
  ) {
    return this.inspectionsService.addPhoto(id, user.id, dto);
  }

  @Delete('reports/:id/photos/:photoId')
  @RequirePermissions(Permission.INSPECTION_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a photo from an in-progress report' })
  removePhoto(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('photoId') photoId: string,
  ) {
    return this.inspectionsService.removePhoto(id, photoId, user.id);
  }

  // --- AI Vision Screening ---

  @Post('reports/:id/ai-screen')
  @RequirePermissions(Permission.INSPECTION_UPDATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger Gemini visual pre-screening on report' })
  aiScreen(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.inspectionsService.runAiPreScreen(id, user.id);
  }

  // --- Submit / Finalize ---

  @Post('reports/:id/submit')
  @RequirePermissions(Permission.INSPECTION_CREATE)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Finalize, score, and submit the quality report' })
  submitReport(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: SubmitInspectionReportDtoClass,
  ) {
    return this.inspectionsService.submitReport(id, user.id, dto);
  }
}
