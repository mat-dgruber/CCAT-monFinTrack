import { Injectable } from '@angular/core';

@Injectable({
     providedIn: 'root'
})
export class ColorService {

     // Base palette for initial items (Tailwind-ish colors)
     private basePalette = [
          '#3b82f6', // Blue 500
          '#ef4444', // Red 500
          '#22c55e', // Green 500
          '#f59e0b', // Amber 500
          '#8b5cf6', // Violet 500
          '#ec4899', // Pink 500
          '#06b6d4', // Cyan 500
          '#10b981', // Emerald 500
          '#f97316', // Orange 500
          '#6366f1', // Indigo 500
          '#14b8a6', // Teal 500
          '#d946ef', // Fuchsia 500
          '#84cc16', // Lime 500
          '#eab308', // Yellow 500
          '#a855f7', // Purple 500
          '#0ea5e9', // Sky 500
          '#f43f5e', // Rose 500
          '#64748b'  // Slate 500
     ];

     constructor() { }

     /**
      * Returns a color for a given index or label.
      * If index < basePalette.length, returns from palette.
      * Otherwise, generates a deterministic HSL color.
      */
     getColor(index: number): string {
          if (index < this.basePalette.length) {
               return this.basePalette[index];
          }
          return this.generateHSL(index);
     }

     /**
      * Generates a color based on a string hash (deterministic).
      */
     getColorForLabel(label: string): string {
          let hash = 0;
          for (let i = 0; i < label.length; i++) {
               hash = label.charCodeAt(i) + ((hash << 5) - hash);
          }

          // Use hash to pick from palette first
          const paletteIndex = Math.abs(hash) % this.basePalette.length;

          // If we want to stick to the palette for consistency:
          return this.basePalette[paletteIndex];

          // OR if we want unlimited colors:
          // const hue = Math.abs(hash) % 360;
          // return `hsl(${hue}, 70%, 50%)`;
     }

     private generateHSL(index: number): string {
          // Golden angle approximation for distinct colors
          const hue = (index * 137.508) % 360;
          return `hsl(${hue}, 70%, 50%)`;
     }

     /**
      * Returns a slightly transparent version of the color for backgrounds
      */
     getBackgroundColor(color: string, opacity: number = 0.2): string {
          if (color.startsWith('#')) {
               const r = parseInt(color.slice(1, 3), 16);
               const g = parseInt(color.slice(3, 5), 16);
               const b = parseInt(color.slice(5, 7), 16);
               return `rgba(${r}, ${g}, ${b}, ${opacity})`;
          } else if (color.startsWith('hsl')) {
               return color.replace('hsl', 'hsla').replace(')', `, ${opacity})`);
          }
          return color;
     }
}
