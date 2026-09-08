import React, { useState, useRef, useEffect } from 'react';
import { Eye, MoveHorizontal } from 'lucide-react';

interface ComparisonSliderProps {
  originalUrl: string;
  compositeCanvas: HTMLCanvasElement | null;
  lang: 'bn' | 'en';
}

export const ComparisonSlider: React.FC<ComparisonSliderProps> = ({
  originalUrl,
  compositeCanvas,
  lang,
}) => {
  const [sliderPos, setSliderPos] = useState(50); // percentage 0 - 100
  const [compositeDataUrl, setCompositeDataUrl] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  useEffect(() => {
    if (compositeCanvas) {
      try {
        setCompositeDataUrl(compositeCanvas.toDataURL('image/png'));
      } catch (e) {
        // ignore
      }
    }
  }, [compositeCanvas]);

  const handlePointerDown = () => {
    isDragging.current = true;
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  };

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="relative w-full h-full select-none overflow-hidden rounded-xl cursor-ew-resize touch-none"
    >
      {/* After image (with new background) */}
      {compositeDataUrl && (
        <img
          src={compositeDataUrl}
          alt="Processed"
          className="absolute inset-0 w-full h-full object-contain pointer-events-none"
        />
      )}

      {/* Before image (original) clipped by slider position */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${sliderPos}%` }}
      >
        <img
          src={originalUrl}
          alt="Original"
          className="absolute inset-0 w-full h-full object-contain max-w-none pointer-events-none"
          style={{ width: containerRef.current?.clientWidth, height: containerRef.current?.clientHeight }}
        />
      </div>

      {/* Divider line & handle */}
      <div
        onPointerDown={handlePointerDown}
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-xl cursor-ew-resize flex items-center justify-center -ml-px z-20"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="w-7 h-7 rounded-full bg-white text-slate-900 flex items-center justify-center shadow-lg border border-slate-200">
          <MoveHorizontal className="w-4 h-4" />
        </div>
      </div>

      {/* Floating Labels */}
      <div className="absolute top-3 left-3 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-semibold text-white pointer-events-none z-10">
        {lang === 'bn' ? 'আসল ছবি (Before)' : 'Original (Before)'}
      </div>
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-blue-600/80 backdrop-blur-md text-[10px] font-semibold text-white pointer-events-none z-10">
        {lang === 'bn' ? 'নতুন ব্যাকগ্রাউন্ড (After)' : 'New Background (After)'}
      </div>
    </div>
  );
};
