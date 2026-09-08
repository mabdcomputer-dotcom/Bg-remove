import React from 'react';
import { Image as ImageIcon, Sparkles, RefreshCw, Globe, ShieldCheck, Plus } from 'lucide-react';

interface HeaderProps {
  lang: 'bn' | 'en';
  setLang: (lang: 'bn' | 'en') => void;
  hasImage: boolean;
  onReset: () => void;
  onAddImage?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  setLang,
  hasImage,
  onReset,
  onAddImage,
}) => {
  return (
    <header className="w-full border-b border-slate-800 bg-slate-900/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-emerald-500 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-bold">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {lang === 'bn' ? 'ফটো ব্যাকগ্রাউন্ড রিমুভার' : 'Photo Background Remover'}
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                PRO HD
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              {lang === 'bn'
                ? '১০০% অরিজিনাল কোয়ালিটিতে নীল, সবুজ ও পাসপোর্ট ব্যাকগ্রাউন্ড'
                : '100% Original Resolution • Blue, Green & Studio Backdrops'}
            </p>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="hidden md:flex items-center space-x-1 text-xs text-emerald-400 bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-1 rounded-lg">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{lang === 'bn' ? 'অরিজিনাল কোয়ালিটি সংরক্ষিত' : '100% Full Resolution'}</span>
          </div>

          {hasImage && onAddImage && (
            <button
              onClick={onAddImage}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 rounded-lg shadow-md shadow-blue-600/30 transition-all cursor-pointer"
              title={lang === 'bn' ? 'আরও ছবি যোগ করুন (+)' : 'Add More Photos (+)'}
            >
              <Plus className="w-4 h-4" />
              <span>{lang === 'bn' ? 'ছবি যোগ করুন' : 'Add Photos'}</span>
            </button>
          )}

          {hasImage && (
            <button
              onClick={onReset}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              title={lang === 'bn' ? 'নতুন ছবি আপলোড' : 'New Image'}
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {lang === 'bn' ? 'রিসেট' : 'Reset'}
              </span>
            </button>
          )}

          {/* Language Switch */}
          <button
            onClick={() => setLang(lang === 'bn' ? 'en' : 'bn')}
            className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition"
            title="Switch Language"
          >
            <Globe className="w-3.5 h-3.5 text-blue-400" />
            <span>{lang === 'bn' ? 'English' : 'বাংলা'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
