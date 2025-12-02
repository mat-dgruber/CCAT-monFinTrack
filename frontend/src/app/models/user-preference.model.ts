export interface UserPreference {
     user_id: string;
     language: string;
     theme: 'light' | 'dark';
     notifications_enabled: boolean;
     profile_image_url?: string;
     version: number;
     updated_at: string;
}

export interface UserPreferenceCreate {
     language?: string;
     theme?: 'light' | 'dark';
     notifications_enabled?: boolean;
     profile_image_url?: string;
}
