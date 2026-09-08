import React from 'react';
import { Eraser, Brush, RotateCcw, Check, Info } from 'lucide-react';
import { BrushMode } from '../types';

interface BrushTouchupPanelProps {
  lang: 'bn' | 'en';
  brushMode: BrushMode;
  setBrushMode: (mode: BrushMode) => void;
  brushSize: number;
  setBrushSize: (size: number) => void;
  onUndo: () => void;
  canUndo: boolean;
  onClose: () => void;
}

export const BrushTouchupPanel: React.FC<BrushTouchupPanelProps> = ({
  lang,
  brushMode,
  setBrushMode,
  brushSize,
  setBrushSize,
  onUndo,
  canUndo,
  onClose,
}) => {
  return (
    <div className="p-3.5 rounded-xl bg-slate-900 border border-blue-500/40 shadow-xl space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Brush className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-bold text-white">
            {lang === 'bn' ? 'ম্যানুয়াল টাচ-আপ ব্রাশ (Touch-up Brush)' : 'Manual Mask Refinement Brush'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white flex items-center space-x-1"
        >
          <Check className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'সম্পন্ন' : 'Done'}</span>
        </button>
      </div>

      <p className="text-[11px] text-slate-400 leading-snug">
        {lang === 'bn'
          ? 'ছবিতে ড্র্যাগ করে কোনো বাড়তি ব্যাকগ্রাউন্ড মুছে ফেলুন অথবা মূল ছবির মুছে যাওয়া অংশ ফিরিয়ে আনুন:'
          : 'Drag directly on the canvas to erase background artifacts or restore clipped subject details:'}
      </p>

      {/* Mode buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setBrushMode('erase')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
            brushMode === 'erase'
              ? 'bg-rose-500/20 border-rose-500 text-rose-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Eraser className="w-3.5 h-3.5 text-rose-400" />
          <span>{lang === 'bn' ? 'ইরেজার (মুছে ফেলুন)' : 'Erase Background'}</span>
        </button>

        <button
          onClick={() => setBrushMode('restore')}
          className={`flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
            brushMode === 'restore'
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
              : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <Brush className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lang === 'bn' ? 'রিস্টোর (ফিরিয়ে আনুন)' : 'Restore Subject'}</span>
        </button>
      </div>

      {/* Size and Undo */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center space-x-2 flex-1 mr-4">
          <span className="text-[11px] text-slate-400 whitespace-nowrap">
            {lang === 'bn' ? 'ব্রাশ সাইজ' : 'Size'}:
          </span>
          <input
            type="range"
            min={8}
            max={80}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="w-full accent-blue-500"
          />
          <span className="text-[11px] font-mono text-slate-400 w-6 text-right">
            {brushSize}px
          </span>
        </div>

        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
            canUndo
              ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
              : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>{lang === 'bn' ? 'আনডু' : 'Undo'}</span>
        </button>
      </div>
    </div>
  );
};
