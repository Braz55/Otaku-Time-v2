export class CreateListDto {
  name: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  criteria?: {
    genres?: string[];
    tags?: string[];
    mediaTypes?: ('ANIME' | 'MANGA')[];
  } | null;
}
