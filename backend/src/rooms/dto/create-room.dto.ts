import {
  IsString,
  IsNotEmpty,
  IsEnum,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { RoomType } from '@prisma/client';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' })
  @MaxLength(50, { message: 'El nombre no puede tener más de 50 caracteres' })
  name: string;

  @IsEnum(RoomType, { message: 'El tipo debe ser TEXT o MULTIMEDIA' })
  type: RoomType;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4,10}$/, {
    message: 'El PIN debe tener entre 4 y 10 dígitos numéricos',
  })
  pin: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxFileSize?: number;
}
