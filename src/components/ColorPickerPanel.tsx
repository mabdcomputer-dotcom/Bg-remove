import React, { useState, useRef } from 'react';
import {
  Palette,
  Check,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Upload,
  Eye,
  Layers,
} from 'lucide-react';
import { COLOR_PRESETS, GRADIENT_PRESETS } from '../data/presets';
import { BackgroundType, ColorPreset, GradientPreset } from '../types';

interface ColorPickerPanelProps {
  lang: 'bn' | 'en';
  bgType: BackgroundType;
  setBgType: (type: BackgroundType) => void;
  solidColor: string;
  setSolidColor: (color: string) => void;
  selectedGradient: GradientPreset | null;
  setSelectedGradient: (grad: GradientPreset) => void;
  blurAmount: number;
  setBlurAmount: (val: number) => void;
  onCustomBgUpload: (file: File) => void;
  hasCustomBgImage: boolean;
}

export const ColorPickerPanel: React.FC<ColorPickerPanelProps> = ({
  lang,
  bgType,
  setBgType,
  solidColor,
  setSolidColor,
  selectedGradient,
  setSelectedGradient,
  blurAmount,
  setBlurAmount,
  onCustomBgUpload,
  hasCustomBgImage,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'blue' | 'green' | 'white' | 'vibrant'>('all');
  const customBgInputRef = useRef<HTMLInputElement>(null);

  const filteredColors = COLOR_PRESETS.filter((item) => {
    if (activeCategory === 'blue') return item.category === 'passport_blue';
    if (activeCategory === 'green') return item.category === 'studio_green';
    if (activeCategory === 'white') return item.category === 'official_white' || item.category === 'neutral';
    if (activeCategory === 'vibrant') return item.category === 'vibrant' || item.category === 'pastel';
    return true;
  });

  const handleColorClick = (color: string) => {
    setSolidColor(color);
    setBgType('solid');
  };

  const handleGradientClick = (grad: GradientPreset) => {
    setSelectedGradient(grad);
    setBgType('gradient');
  };

  return (
    <div className="space-y-5">
      {/* Top Type Switcher */}
      <div className="grid grid-cols-4 gap-1.5 p-1 bg-slate-950/70 border border-slate-800 rounded-xl">
        <button
          onClick={() => setBgType('solid')}
          className={`flex items-center justify-center space-x-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            bgType === 'solid'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'কালার' : 'Solid Color'}</span>
        </button>

        <button
          onClick={() => {
            setBgType('gradient');
            if (!selectedGradient && GRADIENT_PRESETS.length > 0) {
              setSelectedGradient(GRADIENT_PRESETS[0]);
            }
          }}
          className={`flex items-center justify-center space-x-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            bgType === 'gradient'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'স্টুডিও' : 'Studio'}</span>
        </button>

        <button
          onClick={() => setBgType('blur')}
          className={`flex items-center justify-center space-x-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            bgType === 'blur'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Sliders className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'ব্লার' : 'Blur BG'}</span>
        </button>

        <button
          onClick={() => setBgType('transparent')}
          className={`flex items-center justify-center space-x-1 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
            bgType === 'transparent'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{lang === 'bn' ? 'স্বচ্ছ' : 'PNG Alpha'}</span>
        </button>
      </div>

      {/* 1. SOLID COLOR SECTION */}
      {bgType === 'solid' && (
        <div className="space-y-3.5">
          {/* Quick Category filter icon tabs */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center space-x-1 cursor-pointer ${
                activeCategory === 'all'
                  ? 'bg-slate-800 text-white border border-slate-700'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-900'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'সব' : 'All'}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('blue')}
              title={lang === 'bn' ? 'নীল শেডস' : 'Blue shades'}
              className={`p-1.5 px-2.5 rounded-lg whitespace-nowrap transition-colors flex items-center cursor-pointer ${
                activeCategory === 'blue'
                  ? 'bg-blue-900/60 border border-blue-500/60 ring-1 ring-blue-500/40'
                  : 'bg-slate-900/60 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#00a3e0] inline-block shadow-sm"></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('green')}
              title={lang === 'bn' ? 'সবুজ শেডস' : 'Green shades'}
              className={`p-1.5 px-2.5 rounded-lg whitespace-nowrap transition-colors flex items-center cursor-pointer ${
                activeCategory === 'green'
                  ? 'bg-emerald-900/60 border border-emerald-500/60 ring-1 ring-emerald-500/40'
                  : 'bg-slate-900/60 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#00c853] inline-block shadow-sm"></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('white')}
              title={lang === 'bn' ? 'সাদা ও গ্রে' : 'White & Neutral'}
              className={`p-1.5 px-2.5 rounded-lg whitespace-nowrap transition-colors flex items-center cursor-pointer ${
                activeCategory === 'white'
                  ? 'bg-slate-800 border border-slate-500 ring-1 ring-slate-400'
                  : 'bg-slate-900/60 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-[#ffffff] border border-slate-500 inline-block shadow-sm"></span>
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('vibrant')}
              title={lang === 'bn' ? 'অন্যান্য কালার' : 'Vibrant'}
              className={`p-1.5 px-2.5 rounded-lg whitespace-nowrap transition-colors flex items-center cursor-pointer ${
                activeCategory === 'vibrant'
                  ? 'bg-purple-900/60 border border-purple-500/60 ring-1 ring-purple-500/40'
                  : 'bg-slate-900/60 hover:bg-slate-800 border border-slate-800'
              }`}
            >
              <span className="w-3.5 h-3.5 rounded-full bg-gradient-to-r from-rose-500 via-purple-500 to-amber-500 inline-block shadow-sm"></span>
            </button>
          </div>

          {/* Color Icon Grid: Only small color icons, no text names */}
          <div className="grid grid-cols-8 sm:grid-cols-9 gap-1.5 max-h-56 overflow-y-auto p-1 pr-1.5 no-scrollbar">
            {filteredColors.map((preset) => {
              const isSelected = solidColor.toLowerCase() === preset.color.toLowerCase();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleColorClick(preset.color)}
                  title={preset.color}
                  className={`aspect-square w-full rounded-full border transition-all cursor-pointer flex items-center justify-center relative shadow-xs hover:scale-115 active:scale-95 ${
                    isSelected
                      ? 'border-blue-400 ring-2 ring-blue-500/70 scale-110 shadow-md'
                      : 'border-slate-800/90 hover:border-slate-500'
                  }`}
                  style={{ backgroundColor: preset.color }}
                >
                  {isSelected && (
                    <Check
                      className="w-3 h-3 drop-shadow-md"
                      style={{ color: preset.textColor || '#ffffff' }}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Custom Color Picker input */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="color"
                value={solidColor}
                onChange={(e) => handleColorClick(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-2 border-slate-700 bg-transparent p-0 overflow-hidden"
              />
              <span className="text-[11px] font-mono text-slate-400 uppercase">
                {solidColor}
              </span>
            </div>

            <div className="flex items-center space-x-1.5">
              {['#00a3e0', '#004c8c', '#00c853', '#ffffff', '#dc2626'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleColorClick(c)}
                  className="w-6 h-6 rounded-full border border-slate-700 hover:scale-110 transition-transform shadow-sm cursor-pointer"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. GRADIENT / STUDIO SECTION */}
      {bgType === 'gradient' && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400">
            {lang === 'bn'
              ? 'বাস্তবধর্মী স্টুডিও স্পটলাইট ও ভিনিয়েট ইফেক্টযুক্ত ব্যাকগ্রাউন্ড:'
              : 'Realistic studio lighting vignettes and depth gradients:'}
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {GRADIENT_PRESETS.map((grad) => {
              const isSelected = selectedGradient?.id === grad.id;
              return (
                <button
                  key={grad.id}
                  onClick={() => handleGradientClick(grad)}
                  className={`relative p-3 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/60'
                  }`}
                >
                  <div
                    className="w-full h-14 rounded-lg mb-2 shadow-inner border border-white/10"
                    style={{ background: grad.css }}
                  ></div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200 truncate">
                      {lang === 'bn' ? grad.nameBn : grad.nameEn}
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. BLUR ORIGINAL BACKGROUND SECTION */}
      {bgType === 'blur' && (
        <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-slate-800">
          <div>
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="font-semibold text-slate-300">
                {lang === 'bn' ? 'ব্লার তীব্রতা (Blur Intensity)' : 'Blur Intensity'}
              </span>
              <span className="font-mono text-blue-400">{blurAmount}px</span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={1}
              value={blurAmount}
              onChange={(e) => setBlurAmount(Number(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          <p className="text-xs text-slate-400">
            {lang === 'bn'
              ? 'এটি আপনার আসল ব্যাকগ্রাউন্ড রেখে তাতে ডিএসএলআর ক্যামেরার মতো ব্লার ও লাইট ইফেক্ট দেয়।'
              : 'Retains your original background with a smooth DSLR-like bokeh depth of field.'}
          </p>
        </div>
      )}

      {/* 4. TRANSPARENT SECTION */}
      {bgType === 'transparent' && (
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
          <div className="inline-flex p-3 rounded-xl bg-slate-800/80 border border-slate-700">
            <Layers className="w-6 h-6 text-blue-400" />
          </div>
          <h4 className="text-sm font-semibold text-slate-200">
            {lang === 'bn' ? 'স্বচ্ছ পিএনজি ব্যাকগ্রাউন্ড (Transparent PNG)' : 'Transparent PNG Background'}
          </h4>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            {lang === 'bn'
              ? 'কোনো কালার ছাড়া সরাসরি কাটআউট পিএনজি হিসেবে ডাউনলোড করুন। ফটোশপ বা যেকোনো ডিজাইনে সরাসরি ব্যবহারযোগ্য।'
              : 'Export as transparent cutout PNG for graphic design, logos, e-commerce, or Photoshop.'}
          </p>
        </div>
      )}

      {/* Custom Backdrop Image option */}
      <div className="pt-3 border-t border-slate-800/80">
        <input
          ref={customBgInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              onCustomBgUpload(e.target.files[0]);
              setBgType('custom_image');
            }
          }}
        />
        <button
          onClick={() => customBgInputRef.current?.click()}
          className={`w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
            bgType === 'custom_image' && hasCustomBgImage
              ? 'bg-blue-600/20 border-blue-500 text-blue-300'
              : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white'
          }`}
        >
          <Upload className="w-3.5 h-3.5" />
          <span>
            {hasCustomBgImage
              ? (lang === 'bn' ? 'কাস্টম ব্যাকগ্রাউন্ড পরিবর্তন করুন' : 'Change Custom Backdrop Image')
              : (lang === 'bn' ? 'ডিভাইস থেকে কাস্টম ব্যাকগ্রাউন্ড আপলোড' : 'Upload Custom Image Backdrop')}
          </span>
        </button>
      </div>
    </div>
  );
};
