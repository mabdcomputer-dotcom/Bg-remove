import React from 'react';
import { Crop, ZoomIn, Move, RotateCcw, Check, Sparkles } from 'lucide-react';
import { CROP_PRESETS } from '../data/presets';
import { CropPreset } from '../types';

interface CropControlsProps {
  lang: 'bn' | 'en';
  selectedCrop: CropPreset;
  setSelectedCrop: (preset: CropPreset) => void;
  zoom: number;
  setZoom: (val: number) => void;
  panX: number;
  setPanX: (val: number) => void;
  panY: number;
  setPanY: (val: number) => void;
  onResetPosition: () => void;
  computedWidth: number;
  computedHeight: number;
}

export const CropControls: React.FC<CropControlsProps> = ({
  lang,
  selectedCrop,
  setSelectedCrop,
  zoom,
  setZoom,
  panX,
  setPanX,
  panY,
  setPanY,
  onResetPosition,
  computedWidth,
  computedHeight,
}) => {
  return (
    <div className="space-y-4">
      {/* Output Resolution Banner */}
      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/80 border border-slate-800">
        <div>
          <span className="text-[11px] font-medium text-slate-400 block">
            {lang === 'bn' ? 'আউটপুট রেজোলিউশন (১০০% নিখুঁত পিক্সেল)' : 'Output Resolution (100% Full-Res)'}
          </span>
          <span className="text-sm font-bold font-mono text-emerald-400">
            {computedWidth} × {computedHeight} px
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
          {lang === 'bn' ? 'ফুল কোয়ালিটি' : 'Full Quality'}
        </span>
      </div>

      {/* Crop Presets Grid */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-300 block">
          {lang === 'bn' ? 'সাইজ ও ক্রপ প্রিসেট (পাসপোর্ট / আইডি / সোশ্যাল)' : 'Size & Crop Standards'}
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {CROP_PRESETS.map((preset) => {
            const isSelected = selectedCrop.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => setSelectedCrop(preset)}
                className={`flex items-start justify-between p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-slate-200">
                    {lang === 'bn' ? preset.nameBn : preset.nameEn}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    {lang === 'bn' ? preset.descriptionBn : preset.descriptionEn}
                  </div>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-blue-400 shrink-0 ml-2 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Zoom & Positioning Adjustments */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
            <ZoomIn className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === 'bn' ? 'সাবজেক্ট জুম (Zoom)' : 'Subject Zoom'}</span>
          </span>
          <span className="font-mono text-blue-400 text-xs">{(zoom * 100).toFixed(0)}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={1.8}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-blue-500"
        />

        {/* Pan Vertical (head positioning) */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" />
              <span>{lang === 'bn' ? 'উপরে / নিচে এডজাস্ট' : 'Vertical Alignment'}</span>
            </span>
            <button
              onClick={onResetPosition}
              className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center space-x-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
            </button>
          </div>
          <input
            type="range"
            min={-150}
            max={150}
            step={1}
            value={panY}
            onChange={(e) => setPanY(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
