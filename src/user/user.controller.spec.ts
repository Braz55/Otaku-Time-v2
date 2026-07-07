import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let service: UserService;

  const mockUserService = {
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        {
          provide: UserService,
          useValue: mockUserService,
        },
      ],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get<UserService>(UserService);
  });

  it('should call userService.update with user id and dto on updateProfile', async () => {
    const req = { user: { userId: 123 } };
    const dto = { nome: 'Alice' };

    mockUserService.update.mockResolvedValue({ id: 123, nome: 'Alice' });

    const result = await controller.updateProfile(req, dto);

    expect(service.update).toHaveBeenCalledWith(123, dto);
    expect(result).toEqual({ id: 123, nome: 'Alice' });
  });
});
