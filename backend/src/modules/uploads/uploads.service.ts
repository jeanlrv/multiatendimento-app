import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class UploadsService {
    constructor(private configService: ConfigService) { }

    getPublicUrl(filename: string) {
        const port = this.configService.get<string>('PORT', '3002');
        const baseUrl = this.configService.get<string>('API_URL', `http://localhost:${port}`);
        return `${baseUrl}/public/uploads/${filename}`;
    }
}
