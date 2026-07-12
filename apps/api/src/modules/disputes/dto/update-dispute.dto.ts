import { PartialType } from '@nestjs/swagger';
import { CreateDisputeDtoClass } from './create-dispute.dto';

export class UpdateDisputeDtoClass extends PartialType(CreateDisputeDtoClass) {}
