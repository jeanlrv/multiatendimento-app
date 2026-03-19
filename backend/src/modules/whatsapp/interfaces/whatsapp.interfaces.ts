export interface BusinessHoursDay {
    enabled: boolean;
    start: string; // Ex: "08:00"
    end: string;   // Ex: "18:00"
}

export interface BusinessHoursConfig {
    enabled: boolean;
    timezone: string;
    message: string;
    schedule: {
        monday: BusinessHoursDay;
        tuesday: BusinessHoursDay;
        wednesday: BusinessHoursDay;
        thursday: BusinessHoursDay;
        friday: BusinessHoursDay;
        saturday: BusinessHoursDay;
        sunday: BusinessHoursDay;
    };
}

export interface WhatsAppConnection {
    id: string;
    name: string;
    instanceId: string;
    zapiToken: string | null;
    zapiClientToken: string | null;
    status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
    companyId: string;
    departmentId?: string | null;
    departmentIds: string[];
    isActive: boolean;
    department?: any; // Substituído na limpeza geral, se houver interface Department
}
