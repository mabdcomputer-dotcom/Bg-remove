import React from 'react';
import { Plus, Check, Loader2, Trash2, Archive, Sparkles, Image as ImageIcon } from 'lucide-react';
import { BatchImageItem } from '../types';

interface BatchImageStripProps {
  images: BatchImageItem[];
  activeId: string | null;
  onSelectImage: (id: string) => void;
  onAddImages: () => void;
  onRemoveImage: (id: string) => void;
  onDownloadAllZip: () => void;
  isDownloadingZip: boolean;
  lang: 'bn' | 'en';
}

export const BatchImageStrip: React.FC<BatchImageStripProps> = ({
  images,
  activeId,
  onSelectImage,
  onAddImages,
  onRemoveImage,
  onDownloadAllZip,
  isDownloadingZip,
  lang,
}) => {
  if (images.length === 0) return null;

  const completedCount = images.filter((img) => !!img.cutoutDataUrl && !img.isProcessing).length;

  return (
    <div className="w-full bg-slate-900/95 border-b border-slate-800 px-3 sm:px-6 py-2.5 shadow-xl backdrop-blur-md sticky top-16 z-30">
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-3">
        {/* Left: Prominent Plus Button & Scrollable Thumbnails */}
        <div className="flex items-center space-x-2.5 overflow-x-auto py-1 no-scrollbar flex-1">
          {/* THE BIG PROMINENT PLUS BUTTON */}
          <button
            type="button"
            id="btn-add-more-photos"
            onClick={onAddImages}
            title={lang === 'bn' ? 'আরও ছবি যোগ করুন (+)' : 'Add More Photos (+)'}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-blue-600 via-sky-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-xs shadow-lg shadow-blue-600/30 hover:scale-105 active:scale-95 transition-all shrink-0 cursor-pointer group"
          >
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center group-hover:rotate-90 transition-transform">
              <Plus className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="whitespace-nowrap font-extrabold tracking-wide">
              {lang === 'bn' ? 'ছবি যোগ করুন (+)' : 'Add Photo (+)'}
            </span>
          </button>

          {/* Divider */}
          <div className="w-px h-8 bg-slate-800 shrink-0 mx-1"></div>

          {/* Image Thumbnails Carousel */}
          {images.map((item, idx) => {
            const isActive = item.id === activeId;
            const previewSrc = item.cutoutDataUrl || item.originalDataUrl;

            return (
              <div
                key={item.id}
                onClick={() => onSelectImage(item.id)}
                className={`relative group/thumb flex items-center space-x-2 p-1.5 rounded-xl border transition-all cursor-pointer shrink-0 ${
                  isActive
                    ? 'bg-blue-950/50 border-blue-500 ring-2 ring-blue-500/50 shadow-md shadow-blue-500/20'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700 hover:border-slate-600'
                }`}
              >
                {/* Thumbnail Image */}
                <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-slate-950 border border-slate-700/60 shrink-0">
                  {previewSrc ? (
                    <img
                      src={previewSrc}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}

                  {/* Processing spinner or status badge overlay */}
                  {item.isProcessing ? (
                    <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center">
                      <Loader2 className="w-4 h-4 text-sky-400 animate-spin" />
                    </div>
                  ) : item.cutoutDataUrl ? (
                    <div className="absolute top-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center shadow">
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </div>
                  ) : null}
                </div>

                {/* Name & Progress Info */}
                <div className="hidden sm:flex flex-col text-left max-w-[100px] pr-1">
                  <span className="text-[11px] font-semibold text-slate-200 truncate leading-tight">
                    {idx + 1}. {item.name}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate">
                    {item.isProcessing
                      ? `${item.progress}%`
                      : item.cutoutDataUrl
                      ? (lang === 'bn' ? 'সলিড কাটআউট' : 'Cutout Ready')
                      : (lang === 'bn' ? 'অপেক্ষা করছে' : 'Queued')}
                  </span>
                </div>

                {/* Remove / Delete button (Always clearly visible when multiple images exist) */}
                {images.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveImage(item.id);
                    }}
                    title={lang === 'bn' ? 'এই ছবিটি ডিলিট করুন' : 'Delete photo'}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-rose-600 text-slate-400 hover:text-white border border-slate-700 hover:border-rose-500 transition-all ml-1 shrink-0 cursor-pointer shadow-sm group-hover/thumb:border-rose-500/50"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400 group-hover/thumb:text-white" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Right: Batch ZIP Download & Count indicator */}
        <div className="flex items-center space-x-2 shrink-0">
          <div className="hidden md:flex items-center space-x-1 text-xs text-slate-400 font-medium">
            <span className="text-emerald-400 font-bold">{completedCount}</span>
            <span>/</span>
            <span>{images.length}</span>
            <span>{lang === 'bn' ? 'প্রস্তুত' : 'ready'}</span>
          </div>

          {images.length > 1 && (
            <button
              type="button"
              id="btn-batch-download-zip"
              onClick={onDownloadAllZip}
              disabled={isDownloadingZip || completedCount === 0}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
              title={lang === 'bn' ? 'সবগুলো ছবি জিপ ফাইলে একসাথে ডাউনলোড করুন' : 'Download all cutouts in a ZIP file'}
            >
              {isDownloadingZip ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Archive className="w-3.5 h-3.5 text-emerald-400" />
              )}
              <span>{lang === 'bn' ? 'সব ডাউনলোড (ZIP)' : 'Download All (ZIP)'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
