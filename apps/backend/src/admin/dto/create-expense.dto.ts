import { PaymentMethod } from '@prisma/client';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateExpenseDto {
  @IsInt()
  @Min(1)
  shiftId!: number;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  category!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsOptional()
  @IsIn([PaymentMethod.CASH, PaymentMethod.CARD])
  method?: PaymentMethod;
}
