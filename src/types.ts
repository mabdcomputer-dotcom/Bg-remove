export type BackgroundType = 'solid' | 'gradient' | 'blur' | 'custom_image' | 'transparent';

export interface ColorPreset {
  id: string;
  nameEn: string;
  nameBn: string;
  category: 'passport_blue' | 'studio_green' | 'official_white' | 'vibrant' | 'neutral' | 'pastel';
  color: string;
  textColor?: string;
  badge?: string;
}

export interface GradientPreset {
  id: string;
  nameEn: string;
  nameBn: string;
  css: string;
  canvasType: 'linear' | 'radial';
  stops: { offset: number; color: string }[];
}

export type AspectRatioOption = 'original' | '1:1' | '7:9' | '3:4' | '4:5' | '16:9' | '9:16';

export interface CropPreset {
  id: AspectRatioOption;
  nameEn: string;
  nameBn: string;
  ratio: number | null; // width / height
  descriptionEn: string;
  descriptionBn: string;
}

export interface SubjectAdjustments {
  brightness: number; // -50 to +50 (default 0)
  contrast: number;   // -50 to +50 (default 0)
  saturation: number; // -50 to +50 (default 0)
  feather: number;    // 0 to 10 (default 0)
  edgeShift: number;  // -5 to +5 (default 0)
  hasShadow: boolean;
  shadowBlur: number;
  shadowOpacity: number;
  hairFinishingLevel?: 'silky' | 'soft' | 'crisp';
  removalStrength?: 'ultra' | 'strong' | 'balanced';
  defringeEnabled?: boolean;
}

export type BrushMode = 'none' | 'restore' | 'erase';

export interface BrushSettings {
  mode: BrushMode;
  size: number;
  opacity: number;
}

export interface ProcessedImageResult {
  originalWidth: number;
  originalHeight: number;
  originalDataUrl: string;
  originalFileName: string;
  cutoutDataUrl: string; // transparent png data URL
  maskCanvas?: HTMLCanvasElement;
}

export interface BatchImageItem {
  id: string;
  file: File;
  name: string;
  originalDataUrl: string;
  cutoutDataUrl: string | null;
  cutoutBlob: Blob | null;
  cutoutImg: HTMLImageElement | null;
  isProcessing: boolean;
  progress: number;
  statusText: string;
  error?: string | null;
  dimensions: { width: number; height: number };
}

