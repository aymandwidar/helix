export interface Expense {
    id: string;
    cost: string;
    category: string;
    date: string;
    note: string;
    createdAt: string;
}

export interface Vehicle {
    id: string;
    model: string;
    vin: string;
    year: number;
    plate: string;
    createdAt: string;
}

export interface ServiceLog {
    id: string;
    vehicle_id: number;
    service_type: string;
    cost: string;
    mileage: number;
    date: string;
    createdAt: string;
}
