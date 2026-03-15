import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private configService: ConfigService) {
        super({
            // Aceita token via Authorization header (Bearer) OU via httpOnly cookie
            jwtFromRequest: ExtractJwt.fromExtractors([
                ExtractJwt.fromAuthHeaderAsBearerToken(),
                (req: Request) => req?.cookies?.access_token ?? null,
            ]),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET'),
            passReqToCallback: false,
        });
    }

    async validate(payload: any) {
        return {
            id: payload.sub,
            email: payload.email,
            companyId: payload.companyId,
            role: payload.role,
            permissions: payload.permissions,
            departments: payload.departments || []
        };
    }
}
