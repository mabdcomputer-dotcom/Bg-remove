import React, { useState, useRef } from 'react';
import { UploadCloud, Sparkles, CheckCircle, Shield, ArrowRight, Brain, Zap, Layers, Plus } from 'lucide-react';
import { SAMPLE_IMAGES } from '../data/presets';
import { RemovalEngine } from '../utils/bgRemover';

interface UploadZoneProps {
  lang: 'bn' | 'en';
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  onSampleSelect: (url: string, title: string) => void;
  isProcessing: boolean;
  progressText: string;
  progressPercent: number;
  engine: RemovalEngine;
  setEngine: (engine: RemovalEngine) => void;
}

export const UploadZone: React.FC<UploadZoneProps> = ({
  lang,
  onFileSelect,
  onFilesSelect,
  onSampleSelect,
  isProcessing,
  progressText,
  progressPercent,
  engine,
  setEngine,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const allFiles = Array.from(e.dataTransfer.files) as File[];
      const validFiles = allFiles.filter((f) => f.type.startsWith('image/'));
      if (validFiles.length > 0) {
        if (onFilesSelect) {
          onFilesSelect(validFiles);
        } else {
          onFileSelect(validFiles[0]);
        }
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const allFiles = Array.from(e.target.files) as File[];
      const validFiles = allFiles.filter((f) => f.type.startsWith('image/'));
      if (validFiles.length > 0) {
        if (onFilesSelect) {
          onFilesSelect(validFiles);
        } else {
          onFileSelect(validFiles[0]);
        }
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-8">
      {/* Hero statement */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-400 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>
            {lang === 'bn'
              ? 'সলিড অবজেক্ট ব্যাকগ্রাউন্ড রিমুভার ও কালার রিপ্লেসমেন্ট'
              : 'Precision Object Cutout & Studio Color Replacer'}
          </span>
        </div>
        <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
          {lang === 'bn' ? (
            <>
              শুধু <span className="text-emerald-400">মূল অবজেক্ট</span> রেখে ব্যাকগ্রাউন্ড সরান, <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400">
                পাসপোর্ট নীল, সবুজ বা স্বচ্ছ পিএনজি
              </span>{' '}
              ডাউনলোড করুন
            </>
          ) : (
            <>
              Keep <span className="text-emerald-400">Only Main Subject</span> Solid, <br className="hidden sm:inline" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-emerald-400">
                Export Passport Blue, Studio Green or Transparent PNG
              </span>
            </>
          )}
        </h2>
        <p className="mt-2.5 text-xs sm:text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
          {lang === 'bn'
            ? 'ছবি থেকে মানুষ বা অবজেক্টকে ১০০% সলিড ও অক্ষত রেখে যেকোনো জটিল ব্যাকগ্রাউন্ড স্বয়ংক্রিয়ভাবে মুছে ফেলুন। পাসপোর্ট স্কাই ব্লু, স্টুডিও গ্রিন বা স্বচ্ছ পিএনজিতে ডাউনলোড করুন।'
            : 'Accurately isolates the main person or subject with crisp solid edges. Download as transparent PNG or with official passport blue, studio green, and white backgrounds.'}
        </p>
      </div>

      {/* Engine Mode Toggle */}
      <div className="max-w-md mx-auto mb-5 p-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center shadow-lg">
        <button
          type="button"
          onClick={() => setEngine('ai')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
            engine === 'ai'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/40 ring-1 ring-blue-400/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Brain className="w-4 h-4 text-sky-300" />
          <span>{lang === 'bn' ? '🧠 এআই সলিড কাটআউট (১০০% নির্ভুল)' : '🧠 AI Solid Cutout (Precise)'}</span>
        </button>

        <button
          type="button"
          onClick={() => setEngine('fast')}
          className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 px-3 rounded-lg text-xs font-bold transition-all ${
            engine === 'fast'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 ring-1 ring-purple-400/40'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-amber-300" />
          <span>{lang === 'bn' ? '⚡ দ্রুত মোড' : '⚡ Fast Mode'}</span>
        </button>
      </div>

      {/* Upload Box */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`relative group border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center transition-all cursor-pointer ${
          isDragOver
            ? 'border-blue-400 bg-blue-500/10 scale-[1.01]'
            : 'border-slate-700 hover:border-blue-500/70 bg-slate-900/70 hover:bg-slate-900/95 shadow-xl'
        } ${isProcessing ? 'pointer-events-none' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/png, image/jpeg, image/webp, image/jpg"
          onChange={handleFileChange}
          className="hidden"
        />

        {isProcessing ? (
          <div className="py-6 flex flex-col items-center justify-center">
            <div className="relative w-16 h-16 mb-4">
              <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
              <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-400">
                {progressPercent}%
              </div>
            </div>
            <p className="text-base font-semibold text-white mb-1">
              {progressText || (lang === 'bn' ? 'ব্যাকগ্রাউন্ড রিমুভ হচ্ছে...' : 'Removing background...')}
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              {lang === 'bn'
                ? 'শুধু মূল মানুষ বা অবজেক্টকে সলিড রেখে নিখুঁতভাবে ব্যাকগ্রাউন্ড আলাদা করা হচ্ছে...'
                : 'Extracting solid main subject and removing background...'}
            </p>
            {/* Progress bar */}
            <div className="w-64 h-2 bg-slate-800 rounded-full mt-4 overflow-hidden border border-slate-700">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-sky-400 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/25 text-blue-400 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg shadow-blue-500/10">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-white mb-1">
              {lang === 'bn' ? 'এক বা একাধিক ছবি ড্রপ করুন বা ব্রাউজ করুন' : 'Drop one or multiple photos here'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-400 mb-4">
              {lang === 'bn'
                ? 'JPG, PNG, WEBP • একসাথে একাধিক ছবি সিলেক্ট করতে পারেন (+)'
                : 'Supports JPG, PNG, WEBP • Select multiple photos at once (+)'}
            </p>
            <button
              type="button"
              className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white text-sm font-bold shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ছবি নির্বাচন করুন (+ একাধিক সম্ভব)' : 'Select Photos (+ Multiple)'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Feature Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
        <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <Layers className="w-4 h-4 text-blue-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200">
            {lang === 'bn' ? 'শুধু মেইন অবজেক্ট সলিড' : 'Solid Subject Cutout'}
          </span>
        </div>
        <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="w-3.5 h-3.5 rounded-full bg-[#00a3e0] shrink-0 shadow-sm shadow-[#00a3e0]/50"></div>
          <span className="text-xs font-semibold text-slate-200">
            {lang === 'bn' ? 'পাসপোর্ট স্কাই ব্লু' : 'Passport Sky Blue'}
          </span>
        </div>
        <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <div className="w-3.5 h-3.5 rounded-full bg-[#00c853] shrink-0 shadow-sm shadow-[#00c853]/50"></div>
          <span className="text-xs font-semibold text-slate-200">
            {lang === 'bn' ? 'স্টুডিও গ্রিন স্ক্রিন' : 'Studio Green Screen'}
          </span>
        </div>
        <div className="flex items-center space-x-2.5 p-3 rounded-xl bg-slate-900/70 border border-slate-800">
          <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-200">
            {lang === 'bn' ? 'এইচডি ডাউনলোড অপশন' : 'Direct HD Download'}
          </span>
        </div>
      </div>

      {/* Sample Photos for 1-click test */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold tracking-wider uppercase text-slate-400">
            {lang === 'bn' ? 'অথবা সরাসরি ডেমো ছবি দিয়ে টেস্ট করুন' : 'Or test immediately with a sample photo'}
          </h4>
          <span className="text-xs text-slate-500">
            {lang === 'bn' ? 'ক্লিক করলেই প্রসেস শুরু হবে' : 'Click any photo below'}
          </span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SAMPLE_IMAGES.map((sample) => (
            <button
              key={sample.id}
              type="button"
              disabled={isProcessing}
              onClick={(e) => {
                e.stopPropagation();
                onSampleSelect(sample.url, sample.titleEn);
              }}
              className="group relative flex flex-col rounded-xl overflow-hidden border border-slate-800 hover:border-blue-500/70 bg-slate-900 text-left transition-all hover:scale-[1.02] shadow-md disabled:opacity-50"
            >
              <div className="aspect-[4/5] w-full overflow-hidden bg-slate-800 relative">
                <img
                  src={sample.url}
                  alt={sample.titleEn}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-90 group-hover:opacity-75 transition-opacity"></div>
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-white truncate drop-shadow-sm">
                    {lang === 'bn' ? sample.titleBn : sample.titleEn}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
