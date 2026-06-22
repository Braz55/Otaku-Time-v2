import { CreateListDto } from './create-list.dto';

export class UpdateListDto implements Partial<CreateListDto> {
  name?: string;
  description?: string;
  coverUrl?: string;
  isPublic?: boolean;
  criteria?: CreateListDto['criteria'];
}
