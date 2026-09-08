import React, { useState, useRef } from 'react';
import { UploadCloud, Brain, Zap, Plus } from 'lucide-react';
import { RemovalEngine } from '../utils/bgRemover';

interface UploadZoneProps {
  lang: 'bn' | 'en';
  onFileSelect: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  onSampleSelect?: (url: string, title: string) => void;
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
    <div className="w-full max-w-2xl mx-auto px-4 py-8">
      {/* Clean, minimal title */}
      <div className="text-center mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
          {lang === 'bn' ? 'ব্যাকগ্রাউন্ড রিমুভার' : 'AI Background Remover'}
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          {lang === 'bn' ? 'ছবি নির্বাচন করুন বা ড্রপ করুন' : 'Select photos or drag and drop here'}
        </p>
      </div>

      {/* Engine Mode Toggle */}
      <div className="max-w-md mx-auto mb-6 p-1 rounded-xl bg-slate-900 border border-slate-800 flex items-center shadow-lg">
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
          <span>{lang === 'bn' ? '🧠 এআই সলিড কাটআউট' : '🧠 AI Solid Cutout'}</span>
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
        className={`relative group border-2 border-dashed rounded-2xl p-8 sm:p-14 text-center transition-all cursor-pointer ${
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
            <p className="text-xs sm:text-sm text-slate-400 mb-5">
              {lang === 'bn'
                ? 'JPG, PNG, WEBP • একসাথে একাধিক ছবি সিলেক্ট করতে পারেন'
                : 'Supports JPG, PNG, WEBP • Select multiple photos at once'}
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
    </div>
  );
};
