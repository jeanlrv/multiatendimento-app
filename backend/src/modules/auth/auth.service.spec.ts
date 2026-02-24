import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';

describe('AuthService', () => {
    let service: AuthService;
    let usersService: UsersService;
    let jwtService: JwtService;

    const mockUsersService = {
        findByEmail: jest.fn(),
    };

    const mockJwtService = {
        sign: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuthService,
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: JwtService,
                    useValue: mockJwtService,
                },
            ],
        }).compile();

        service = module.get<AuthService>(AuthService);
        usersService = module.get<UsersService>(UsersService);
        jwtService = module.get<JwtService>(JwtService);
    });

    it('should be defined', () => {
        expect(service).toBeDefined();
    });

    describe('validateUser', () => {
        it('should return user without password if credentials are valid', async () => {
            const user = { id: '1', email: 'test@test.com', password: 'hashed_password' };
            mockUsersService.findByEmail.mockResolvedValue(user);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(true));

            const result = await service.validateUser('test@test.com', 'password');

            expect(result).toEqual({ id: '1', email: 'test@test.com' });
        });

        it('should return null if password does not match', async () => {
            const user = { id: '1', email: 'test@test.com', password: 'hashed_password' };
            mockUsersService.findByEmail.mockResolvedValue(user);
            jest.spyOn(bcrypt, 'compare').mockImplementation(() => Promise.resolve(false));

            const result = await service.validateUser('test@test.com', 'password');

            expect(result).toBeNull();
        });

        it('should return null if user is not found', async () => {
            mockUsersService.findByEmail.mockResolvedValue(null);

            const result = await service.validateUser('test@test.com', 'password');

            expect(result).toBeNull();
        });
    });

    describe('login', () => {
        it('should return access_token and user info', async () => {
            const user = {
                id: '1',
                email: 'test@test.com',
                name: 'Test User',
                role: {
                    name: 'Admin',
                    permissions: ['all']
                }
            };
            mockJwtService.sign.mockReturnValue('mock_token');

            const result = await service.login(user);

            expect(result).toEqual({
                access_token: 'mock_token',
                user: {
                    id: '1',
                    email: 'test@test.com',
                    name: 'Test User',
                    role: 'Admin'
                }
            });
            expect(jwtService.sign).toHaveBeenCalled();
        });
    });
});
