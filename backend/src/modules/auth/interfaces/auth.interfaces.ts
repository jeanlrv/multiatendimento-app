export interface JwtPayload {
    sub: string;
    email: string;
    companyId: string;
    role: string | { name: string };
    permissions?: string[];
    departments?: { id: string; name: string }[];
}

export interface AuthenticatedUser {
    id: string;
    email: string;
    companyId: string;
    role: string | { name: string };
    permissions: string[];
    departments: { id: string; name: string }[];
}

export interface TokenPair {
    access_token: string;
    refresh_token: string;
}
