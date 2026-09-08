import React, { useState } from 'react';
import {
  Sun,
  Contrast,
  Droplet,
  Feather,
  Sparkles,
  RotateCcw,
  Bot,
  HelpCircle,
  RefreshCw,
  Check,
} from 'lucide-react';
import { SubjectAdjustments } from '../types';

interface AdjustmentsPanelProps {
  lang: 'bn' | 'en';
  adjustments: SubjectAdjustments;
  setAdjustments: React.Dispatch<React.SetStateAction<SubjectAdjustments>>;
  onApplyPresetColor?: (hex: string) => void;
  onRefineEdges?: (level: 'silky' | 'soft' | 'crisp') => void;
  isRefining?: boolean;
}

export const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({
  lang,
  adjustments,
  setAdjustments,
  onApplyPresetColor,
  onRefineEdges,
  isRefining,
}) => {
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<{
    recommendedColor?: string;
    colorName?: string;
    reason?: string;
    cropPreset?: string;
    tips?: string[];
  } | null>(null);

  const handleReset = () => {
    setAdjustments({
      brightness: 0,
      contrast: 0,
      saturation: 0,
      feather: 0,
      edgeShift: 0,
      hasShadow: false,
      shadowBlur: 24,
      shadowOpacity: 0.35,
      hairFinishingLevel: 'silky',
      defringeEnabled: true,
    });
  };

  const requestAiRecommendation = async (purpose: string) => {
    setIsAiLoading(true);
    try {
      const res = await fetch('/api/ai/recommend-backdrop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoType: 'portrait', purpose }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiAdvice(data);
        if (data.recommendedColor && onApplyPresetColor) {
          onApplyPresetColor(data.recommendedColor);
        }
      }
    } catch (e) {
      console.error('Failed to get AI recommendation', e);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header with Reset */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">
          {lang === 'bn' ? 'সাবজেক্ট লাইটিং ও টোন ম্যাচিং' : 'Lighting & Edge Refinement'}
        </span>
        <button
          onClick={handleReset}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1"
        >
          <RotateCcw className="w-3 h-3" />
          <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
        </button>
      </div>

      {/* Sliders Container */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3.5">
        {/* Brightness */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 text-slate-300">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>{lang === 'bn' ? 'উজ্জ্বলতা (Brightness)' : 'Brightness'}</span>
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              {adjustments.brightness > 0 ? `+${adjustments.brightness}` : adjustments.brightness}
            </span>
          </div>
          <input
            type="range"
            min={-40}
            max={40}
            step={1}
            value={adjustments.brightness}
            onChange={(e) =>
              setAdjustments((prev) => ({ ...prev, brightness: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>

        {/* Contrast */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 text-slate-300">
              <Contrast className="w-3.5 h-3.5 text-blue-400" />
              <span>{lang === 'bn' ? 'কন্ট্রাস্ট (Contrast)' : 'Contrast'}</span>
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              {adjustments.contrast > 0 ? `+${adjustments.contrast}` : adjustments.contrast}
            </span>
          </div>
          <input
            type="range"
            min={-40}
            max={40}
            step={1}
            value={adjustments.contrast}
            onChange={(e) =>
              setAdjustments((prev) => ({ ...prev, contrast: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>

        {/* Saturation */}
        <div>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 text-slate-300">
              <Droplet className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? 'স্যাচুরেশন (Color Vibrancy)' : 'Saturation'}</span>
            </span>
            <span className="font-mono text-slate-400 text-[11px]">
              {adjustments.saturation > 0 ? `+${adjustments.saturation}` : adjustments.saturation}
            </span>
          </div>
          <input
            type="range"
            min={-40}
            max={40}
            step={1}
            value={adjustments.saturation}
            onChange={(e) =>
              setAdjustments((prev) => ({ ...prev, saturation: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>

        {/* Hair & Ear Edge Finishing (চুল ও কানের এজ ফিনিশিং) */}
        <div className="pt-3 border-t border-slate-800/80 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 text-xs text-slate-200 font-semibold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>{lang === 'bn' ? 'চুল ও কানের নিখুঁত ফিনিশিং' : 'Hair & Ear Edge Finishing'}</span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-medium">
              {lang === 'bn' ? 'স্বয়ংক্রিয় সক্রিয়' : 'Active'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-tight">
            {lang === 'bn'
              ? 'চুলের সূক্ষ্ম আঁশ ও কানের কিনারা মসৃণ করে ব্যাকগ্রাউন্ডের কালার স্পিল মুছে দেয়।'
              : 'Smoothes hair wisps and ear contours while removing background color bleed.'}
          </p>

          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'crisp', labelBn: 'একদম ক্লিয়ার', labelEn: 'Ultra Clear', descBn: 'দাগ ও ব্লার ছাড়া ক্রিস্টাল কাট' },
              { id: 'soft', labelBn: 'ন্যাচারাল', labelEn: 'Natural Cut', descBn: 'স্বাভাবিক স্টুডিও লুক' },
              { id: 'silky', labelBn: 'সিল্কি হেয়ার', labelEn: 'Fine Strands', descBn: 'সূক্ষ্ম চুলের আঁশ' },
            ].map((mode) => {
              const isSelected = (adjustments.hairFinishingLevel || 'crisp') === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  disabled={isRefining}
                  onClick={() => {
                    setAdjustments((prev) => ({
                      ...prev,
                      hairFinishingLevel: mode.id as 'silky' | 'soft' | 'crisp',
                    }));
                    if (onRefineEdges) {
                      onRefineEdges(mode.id as 'silky' | 'soft' | 'crisp');
                    }
                  }}
                  className={`p-2 rounded-lg text-left transition-all border cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600/25 border-blue-500 text-blue-300 ring-1 ring-blue-500/30'
                      : 'bg-slate-800/70 border-slate-700/60 text-slate-400 hover:text-slate-200 hover:border-slate-600'
                  }`}
                >
                  <div className="text-[11px] font-semibold flex items-center justify-between">
                    <span>{lang === 'bn' ? mode.labelBn : mode.labelEn}</span>
                    {isSelected && <Check className="w-3 h-3 text-blue-400" />}
                  </div>
                  <div className="text-[9px] text-slate-400 mt-0.5">
                    {mode.descBn}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Re-apply button if user wants to trigger it manually */}
          {onRefineEdges && (
            <button
              type="button"
              disabled={isRefining}
              onClick={() => onRefineEdges(adjustments.hairFinishingLevel || 'crisp')}
              className="w-full flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-medium transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 text-emerald-400 ${isRefining ? 'animate-spin' : ''}`} />
              <span>
                {isRefining
                  ? lang === 'bn'
                    ? 'একদম ক্লিয়ার ফিনিশিং হচ্ছে...'
                    : 'Refining...'
                  : lang === 'bn'
                  ? 'বর্তমান ছবিতে একদম ক্লিয়ার ফিনিশিং দিন'
                  : 'Re-apply Ultra-Clear Finishing'}
              </span>
            </button>
          )}
        </div>

        {/* Edge Feather */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="flex items-center space-x-1.5 text-slate-300">
              <Feather className="w-3.5 h-3.5 text-purple-400" />
              <span>{lang === 'bn' ? 'এজ সফটনেস (Edge Feathering)' : 'Edge Smoothness'}</span>
            </span>
            <span className="font-mono text-slate-400 text-[11px]">{adjustments.feather}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={5}
            step={0.5}
            value={adjustments.feather}
            onChange={(e) =>
              setAdjustments((prev) => ({ ...prev, feather: Number(e.target.value) }))
            }
            className="w-full accent-blue-500"
          />
        </div>
      </div>

      {/* Studio Contact Shadow Toggle */}
      <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-200 block">
              {lang === 'bn' ? 'বাস্তবধর্মী স্টুডিও শ্যাডো' : 'Studio Contact Shadow'}
            </span>
            <span className="text-[11px] text-slate-400 block">
              {lang === 'bn' ? 'ব্যাকগ্রাউন্ডে গভীরতা ও রিয়্যালিস্টিক লুক তৈরি করে' : 'Adds natural depth behind the cutout subject'}
            </span>
          </div>
          <button
            onClick={() =>
              setAdjustments((prev) => ({ ...prev, hasShadow: !prev.hasShadow }))
            }
            className={`w-10 h-6 rounded-full transition-colors relative p-0.5 ${
              adjustments.hasShadow ? 'bg-blue-600' : 'bg-slate-800'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-white transition-transform ${
                adjustments.hasShadow ? 'translate-x-4' : 'translate-x-0'
              }`}
            ></div>
          </button>
        </div>

        {adjustments.hasShadow && (
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
              <span>{lang === 'bn' ? 'ছায়ার গাঢ়ত্ব' : 'Shadow Softness'}</span>
              <span>{adjustments.shadowBlur}px</span>
            </div>
            <input
              type="range"
              min={10}
              max={40}
              step={2}
              value={adjustments.shadowBlur}
              onChange={(e) =>
                setAdjustments((prev) => ({ ...prev, shadowBlur: Number(e.target.value) }))
              }
              className="w-full accent-blue-500"
            />
          </div>
        )}
      </div>

      {/* AI Passport & Visa Standard Assistant */}
      <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-950/40 to-slate-900 border border-blue-800/30 space-y-2">
        <div className="flex items-center space-x-2">
          <Bot className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white">
            {lang === 'bn' ? 'এআই পাসপোর্ট ও ভিসা কালার পরামর্শ' : 'AI Visa & Passport Advisor'}
          </span>
        </div>
        <p className="text-[11px] text-slate-400">
          {lang === 'bn'
            ? 'কোন দেশের পাসপোর্টের জন্য কোন ব্যাকগ্রাউন্ড কালার লাগবে তা জানতে নিচের বাটনে ক্লিক করুন:'
            : 'Get instant official color recommendations for specific passport standards:'}
        </p>

        <div className="grid grid-cols-3 gap-1.5 pt-1">
          <button
            onClick={() => requestAiRecommendation('Bangladesh Passport Standard')}
            disabled={isAiLoading}
            className="px-2 py-1.5 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition truncate"
          >
            {lang === 'bn' ? '🇧🇩 বিডি পাসপোর্ট' : '🇧🇩 BD Passport'}
          </button>
          <button
            onClick={() => requestAiRecommendation('US Visa & Schengen Passport')}
            disabled={isAiLoading}
            className="px-2 py-1.5 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition truncate"
          >
            {lang === 'bn' ? '🇺🇸 ইউএস ভিসা' : '🇺🇸 US Visa'}
          </button>
          <button
            onClick={() => requestAiRecommendation('Professional LinkedIn / Resume Profile')}
            disabled={isAiLoading}
            className="px-2 py-1.5 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition truncate"
          >
            {lang === 'bn' ? '💼 জব ও সিভি' : '💼 Job / CV'}
          </button>
        </div>

        {isAiLoading && (
          <div className="text-[11px] text-blue-400 flex items-center space-x-1.5 pt-1">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>{lang === 'bn' ? 'এআই যাচাই করছে...' : 'AI checking standards...'}</span>
          </div>
        )}

        {aiAdvice && !isAiLoading && (
          <div className="mt-2 p-2.5 rounded-lg bg-slate-900 border border-blue-500/20 text-xs space-y-1">
            <div className="font-semibold text-blue-300">
              {aiAdvice.colorName || 'Recommended'} ({aiAdvice.recommendedColor})
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {aiAdvice.reason}
            </p>
            {aiAdvice.tips && (
              <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800">
                💡 {aiAdvice.tips.join(' • ')}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
