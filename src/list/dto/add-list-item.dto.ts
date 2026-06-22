import { MediaType } from '@prisma/client';

export class AddListItemDto {
  anilistMediaId: number;
  mediaType: MediaType;
}
