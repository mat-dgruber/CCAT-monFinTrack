export interface UserPreference {
     user_id: string;
     language: string;
     theme: 'light' | 'dark' | 'system' | 'capycro';
     notifications_enabled: boolean;
     profile_image_url?: string;
     birthday?: string; // ISO string
     timezone?: string;
     version: number;
     updated_at: string;

     // Tithes & Offerings
     enable_tithes_offerings?: boolean;
     default_tithe_percentage?: number;
     default_offering_percentage?: number;
     auto_apply_tithe?: boolean;
}

export interface UserPreferenceCreate {
     language?: string;
     theme?: 'light' | 'dark' | 'system' | 'capycro';
     notifications_enabled?: boolean;
     profile_image_url?: string;
     birthday?: string;
     timezone?: string;

     // Tithes & Offerings
     enable_tithes_offerings?: boolean;
     default_tithe_percentage?: number;
     default_offering_percentage?: number;
     auto_apply_tithe?: boolean;
}
