import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadFileDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  nickname: string;
}
