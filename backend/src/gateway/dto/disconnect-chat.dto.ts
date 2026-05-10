import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DisconnectChatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  deviceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(60)
  nickname: string;
}
