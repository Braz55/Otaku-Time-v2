export class CreateUserDto {
  nome!: string;
  email!: string;
  password!: string;
  preferredLanguage?: string;
  theme?: string;
  showAdultContent?: boolean;
}