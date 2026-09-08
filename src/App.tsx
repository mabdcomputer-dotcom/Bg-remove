/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import JSZip from 'jszip';
import {
  Download,
  Eye,
  Sliders,
  Crop as CropIcon,
  Palette,
  Sparkles,
  Layers,
  Copy,
  Check,
  Brush,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  RotateCcw,
  Zap,
  Cpu,
  RefreshCw,
  Plus,
  Trash2,
} from 'lucide-react';

import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { ColorPickerPanel } from './components/ColorPickerPanel';
import { CropControls } from './components/CropControls';
import { AdjustmentsPanel } from './components/AdjustmentsPanel';
import { ComparisonSlider } from './components/ComparisonSlider';
import { BrushTouchupPanel } from './components/BrushTouchupPanel';
import { BatchImageStrip } from './components/BatchImageStrip';

import {
  BackgroundType,
  GradientPreset,
  CropPreset,
  SubjectAdjustments,
  BrushMode,
  BatchImageItem,
} from './types';
import { COLOR_PRESETS, GRADIENT_PRESETS, CROP_PRESETS } from './data/presets';
import { removeImageBackground, RemovalEngine, preloadModel, refineCutoutEdges } from './utils/bgRemover';
import {
  renderCompositeToCanvas,
  downloadCanvasImage,
  calculateCropDimensions,
} from './utils/canvasRenderer';

export default function App() {
  const [lang, setLang] = useState<'bn' | 'en'>('bn');

  // Engine selection: Default to AI Deep Neural for 100% solid main object isolation
  const [removalEngine, setRemovalEngine] = useState<RemovalEngine>('ai');
  const [mattingTolerance, setMattingTolerance] = useState<number>(36);
  const [removeSecondaryObjects, setRemoveSecondaryObjects] = useState<boolean>(true);
  const [fillHoles, setFillHoles] = useState<boolean>(true);

  // Multi-image batch state
  const [images, setImages] = useState<BatchImageItem[]>([]);
  const [activeImageId, setActiveImageId] = useState<string | null>(null);
  const activeImageIdRef = useRef<string | null>(null);
  activeImageIdRef.current = activeImageId;
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const plusFileInputRef = useRef<HTMLInputElement>(null);

  // Preload AI model in background on app launch
  useEffect(() => {
    preloadModel();
  }, []);

  // Image states
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalDataUrl, setOriginalDataUrl] = useState<string | null>(null);
  const [cutoutDataUrl, setCutoutDataUrl] = useState<string | null>(null);
  const [cutoutImgState, setCutoutImgState] = useState<HTMLImageElement | null>(null);
  const [renderTrigger, setRenderTrigger] = useState<number>(0);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Background settings (Defaulting to Bangladesh / Official Passport Blue as requested: "nil sobuj etc")
  const [bgType, setBgType] = useState<BackgroundType>('solid');
  const [solidColor, setSolidColor] = useState<string>('#00a3e0'); // BD Passport Cyan Blue
  const [selectedGradient, setSelectedGradient] = useState<GradientPreset | null>(
    GRADIENT_PRESETS[0]
  );
  const [blurAmount, setBlurAmount] = useState<number>(20);
  const [customBgImage, setCustomBgImage] = useState<HTMLImageElement | null>(null);

  // Crop & alignment
  const [selectedCrop, setSelectedCrop] = useState<CropPreset>(CROP_PRESETS[0]); // 'original'
  const [zoom, setZoom] = useState<number>(1);
  const [panX, setPanX] = useState<number>(0);
  const [panY, setPanY] = useState<number>(0);

  // Subject adjustments
  const [adjustments, setAdjustments] = useState<SubjectAdjustments>({
    brightness: 0,
    contrast: 0,
    saturation: 0,
    feather: 0,
    edgeShift: 0,
    hasShadow: false,
    shadowBlur: 24,
    shadowOpacity: 0.35,
    hairFinishingLevel: 'crisp',
    removalStrength: 'ultra',
    defringeEnabled: true,
  });

  // Active Control Tab
  const [activeTab, setActiveTab] = useState<'color' | 'crop' | 'adjust'>('color');

  // Comparison & View modes
  const [showComparison, setShowComparison] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg' | 'webp'>('png');

  // Brush Touch-up Mode
  const [isBrushActive, setIsBrushActive] = useState(false);
  const [brushMode, setBrushMode] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState<number>(24);
  const [undoStack, setUndoStack] = useState<string[]>([]);

  // Canvas Refs
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const originalImgRef = useRef<HTMLImageElement | null>(null);
  const cutoutImgRef = useRef<HTMLImageElement | null>(null);
  const brushCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isPainting = useRef(false);

  // 1. Process Batch Item
  const processBatchItem = async (
    item: BatchImageItem,
    overrideEngine?: RemovalEngine,
    overrideStrength?: 'ultra' | 'strong' | 'balanced'
  ) => {
    const activeEngine = overrideEngine || removalEngine;
    const activeStrength = overrideStrength || adjustments.removalStrength || 'ultra';

    // Update item status
    setImages((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              isProcessing: true,
              progress: 15,
              statusText:
                lang === 'bn'
                  ? 'স্ক্যান ও প্রসেসিং হচ্ছে...'
                  : 'Scanning and processing...',
            }
          : it
      )
    );

    if (activeImageIdRef.current === item.id) {
      setIsProcessing(true);
      setErrorMessage(null);
      setProgressPercent(15);
      setProgressText(
        lang === 'bn'
          ? (activeEngine === 'fast'
              ? '⚡ সুপার ফাস্ট প্রসেসিং শুরু হচ্ছে...'
              : 'ছবি লোড হচ্ছে...')
          : 'Loading image...'
      );
    }

    try {
      // Step A: Convert file to Data URL
      let dataUrl = item.originalDataUrl;
      if (!dataUrl) {
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(item.file);
        });
      }

      // Step B: Preload original image element for dimensions
      const oImg = new Image();
      oImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        oImg.onload = () => resolve();
        oImg.onerror = reject;
        oImg.src = dataUrl;
      });

      const dimensions = {
        width: oImg.naturalWidth || 800,
        height: oImg.naturalHeight || 1000,
      };

      // Store original image data
      setImages((prev) =>
        prev.map((it) =>
          it.id === item.id ? { ...it, originalDataUrl: dataUrl, dimensions } : it
        )
      );

      if (activeImageIdRef.current === item.id) {
        setOriginalFile(item.file);
        setOriginalDataUrl(dataUrl);
        originalImgRef.current = oImg;
        setOriginalDimensions(dimensions);
      }

      // Step C: Execute background removal with secondary object isolation, solid hole filling, and hair/ear edge finishing
      const cutoutBlob = await removeImageBackground(item.file, {
        engine: activeEngine,
        tolerance: mattingTolerance,
        removeSecondaryObjects,
        fillHoles,
        refineHairAndEar: true,
        edgeFinishingLevel: adjustments.hairFinishingLevel || 'crisp',
        removalStrength: activeStrength,
        originalImageSource: dataUrl,
        onProgress: (stage, pct) => {
          setImages((prev) =>
            prev.map((it) =>
              it.id === item.id ? { ...it, progress: pct, statusText: stage } : it
            )
          );
          if (activeImageIdRef.current === item.id) {
            setProgressText(stage);
            setProgressPercent(pct);
          }
        },
      });

      // Step D: Create object URL & load cutout Image Element
      const cutoutUrl = URL.createObjectURL(cutoutBlob);
      const cutoutImg = new Image();
      await new Promise<void>((resolve, reject) => {
        cutoutImg.onload = () => resolve();
        cutoutImg.onerror = () => reject(new Error('Cutout image failed to load'));
        cutoutImg.src = cutoutUrl;
      });

      // Step E: Update batch state with finished cutout
      setImages((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                cutoutBlob,
                cutoutDataUrl: cutoutUrl,
                cutoutImg,
                isProcessing: false,
                progress: 100,
                statusText: lang === 'bn' ? 'সম্পন্ন' : 'Ready',
              }
            : it
        )
      );

      // If this item is currently active, immediately display it on canvas
      if (activeImageIdRef.current === item.id) {
        cutoutImgRef.current = cutoutImg;
        setCutoutImgState(cutoutImg);
        setCutoutDataUrl(cutoutUrl);
        setUndoStack([cutoutUrl]);
        setIsProcessing(false);
        setRenderTrigger((v) => v + 1);
      }
    } catch (err: any) {
      console.error('Batch item processing error:', err);
      setImages((prev) =>
        prev.map((it) =>
          it.id === item.id
            ? {
                ...it,
                isProcessing: false,
                statusText: lang === 'bn' ? 'ত্রুটি' : 'Error',
              }
            : it
        )
      );
      if (activeImageIdRef.current === item.id) {
        setIsProcessing(false);
        setErrorMessage(
          lang === 'bn'
            ? 'ছবি প্রসেস করতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।'
            : 'Failed to process image. Please try again.'
        );
      }
    }
  };

  // Handle Multi-file Selection from Dropzone or Plus button
  const handleFilesSelect = async (files: File[]) => {
    if (!files || files.length === 0) return;
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    const newItems: BatchImageItem[] = validFiles.map((file, idx) => ({
      id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
      file,
      name: file.name,
      originalDataUrl: '',
      cutoutDataUrl: null,
      cutoutBlob: null,
      cutoutImg: null,
      isProcessing: true,
      progress: 10,
      statusText: lang === 'bn' ? 'অপেক্ষা করছে...' : 'Queued...',
      dimensions: { width: 800, height: 1000 },
    }));

    setImages((prev) => [...prev, ...newItems]);

    // Automatically switch active display to the newly added image (not the 1st/previous image)
    const targetItem = newItems[0];
    setActiveImageId(targetItem.id);
    activeImageIdRef.current = targetItem.id;
    setOriginalFile(targetItem.file);
    setCutoutDataUrl(null);
    setCutoutImgState(null);
    cutoutImgRef.current = null;
    setIsProcessing(true);
    setProgressPercent(10);
    setProgressText(lang === 'bn' ? 'ব্যাকগ্রাউন্ড রিমুভ হচ্ছে...' : 'Removing background...');

    // Process all files sequentially in queue, updating active view as each new image processes
    for (const item of newItems) {
      setActiveImageId(item.id);
      activeImageIdRef.current = item.id;
      setOriginalFile(item.file);
      setIsProcessing(true);
      await processBatchItem(item);
    }
  };

  const handleFileSelect = (file: File) => {
    handleFilesSelect([file]);
  };

  const handleSampleSelect = async (url: string, title: string) => {
    try {
      setIsProcessing(true);
      setProgressText(lang === 'bn' ? 'নমুনা ছবি প্রস্তুত হচ্ছে...' : 'Fetching sample photo...');
      const res = await fetch(url);
      const blob = await res.blob();
      const file = new File([blob], `${title}.jpg`, { type: 'image/jpeg' });
      handleFilesSelect([file]);
    } catch (e) {
      console.error('Sample load error', e);
      setIsProcessing(false);
    }
  };

  // Switch Active Image from Thumbnails
  const handleSelectImage = (id: string) => {
    setActiveImageId(id);
    activeImageIdRef.current = id;
    const target = images.find((im) => im.id === id);
    if (!target) return;

    setOriginalFile(target.file);
    setOriginalDataUrl(target.originalDataUrl);
    setOriginalDimensions(target.dimensions);

    if (target.originalDataUrl) {
      const oImg = new Image();
      oImg.src = target.originalDataUrl;
      originalImgRef.current = oImg;
    }

    if (target.cutoutImg) {
      cutoutImgRef.current = target.cutoutImg;
      setCutoutImgState(target.cutoutImg);
      setCutoutDataUrl(target.cutoutDataUrl);
      setUndoStack([target.cutoutDataUrl!]);
      setIsProcessing(false);
      setRenderTrigger((v) => v + 1);
    } else {
      cutoutImgRef.current = null;
      setCutoutImgState(null);
      setCutoutDataUrl(null);
      setIsProcessing(target.isProcessing);
      setProgressPercent(target.progress);
      setProgressText(target.statusText);
    }
  };

  // Remove Image from Queue - Instant & Immediate
  const handleRemoveImage = (id: string) => {
    // 1. Reclaim browser memory by revoking blob URL
    const toRemove = images.find((img) => img.id === id);
    if (toRemove?.cutoutDataUrl && toRemove.cutoutDataUrl.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(toRemove.cutoutDataUrl);
      } catch (e) {}
    }

    const filtered = images.filter((img) => img.id !== id);
    setImages(filtered);

    if (filtered.length === 0) {
      handleResetAll();
      return;
    }

    // 2. If the active image was deleted, immediately switch display to the next available photo
    if (activeImageIdRef.current === id) {
      const nextItem = filtered[0];
      setActiveImageId(nextItem.id);
      activeImageIdRef.current = nextItem.id;

      setOriginalFile(nextItem.file);
      setOriginalDataUrl(nextItem.originalDataUrl);
      setOriginalDimensions(nextItem.dimensions);

      if (nextItem.originalDataUrl) {
        const oImg = new Image();
        oImg.src = nextItem.originalDataUrl;
        originalImgRef.current = oImg;
      } else {
        originalImgRef.current = null;
      }

      if (nextItem.cutoutImg && nextItem.cutoutDataUrl) {
        cutoutImgRef.current = nextItem.cutoutImg;
        setCutoutImgState(nextItem.cutoutImg);
        setCutoutDataUrl(nextItem.cutoutDataUrl);
        setUndoStack([nextItem.cutoutDataUrl]);
        setIsProcessing(false);
      } else {
        cutoutImgRef.current = null;
        setCutoutImgState(null);
        setCutoutDataUrl(null);
        setIsProcessing(nextItem.isProcessing);
        setProgressPercent(nextItem.progress);
        setProgressText(nextItem.statusText);
      }
      setRenderTrigger((v) => v + 1);
    }
  };

  // Reset entire workspace
  const handleResetAll = () => {
    setImages([]);
    setActiveImageId(null);
    activeImageIdRef.current = null;
    setCutoutDataUrl(null);
    setCutoutImgState(null);
    setOriginalDataUrl(null);
    setOriginalFile(null);
    setShowComparison(false);
    setIsBrushActive(false);
  };

  // Batch ZIP Download
  const handleDownloadAllZip = async () => {
    const readyItems = images.filter((img) => !!img.cutoutBlob);
    if (readyItems.length === 0) return;
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();

      readyItems.forEach((item) => {
        const cleanName = item.name.replace(/\.[^/.]+$/, '');
        zip.file(`${cleanName}-solid-object.png`, item.cutoutBlob!);
      });

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `photos-bg-removed-batch-${Date.now()}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);

      try {
        confetti({
          particleCount: 100,
          spread: 90,
          origin: { y: 0.75 },
          colors: ['#00a3e0', '#00c853', '#10b981', '#3b82f6'],
        });
      } catch (e) {}
    } catch (err) {
      console.error('Error generating ZIP:', err);
    } finally {
      setIsDownloadingZip(false);
    }
  };

  // Re-run processing with alternate engine
  const handleSwitchEngine = (newEngine: RemovalEngine) => {
    setRemovalEngine(newEngine);
    if (activeImageId) {
      const active = images.find((i) => i.id === activeImageId);
      if (active) {
        processBatchItem(active, newEngine);
      }
    }
  };

  // 2. Custom background upload
  const handleCustomBgUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setCustomBgImage(img);
        setBgType('custom_image');
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 3. Composite Rendering Trigger
  const renderComposite = useCallback(() => {
    const canvas = displayCanvasRef.current;
    const cutoutImg = cutoutImgRef.current || cutoutImgState;
    if (!canvas || !cutoutImg) return;

    // Ensure image has loaded dimensions
    if ((cutoutImg.naturalWidth || cutoutImg.width) === 0) return;

    renderCompositeToCanvas({
      canvas,
      cutoutImg,
      originalImg: originalImgRef.current,
      bgType,
      solidColor,
      gradientPreset: selectedGradient,
      customBgImg: customBgImage,
      blurAmount,
      adjustments,
      cropPreset: selectedCrop,
      zoom,
      panX,
      panY,
    });
  }, [
    cutoutImgState,
    bgType,
    solidColor,
    selectedGradient,
    customBgImage,
    blurAmount,
    adjustments,
    selectedCrop,
    zoom,
    panX,
    panY,
  ]);

  // High-performance canvas render whenever any setting or image changes (Instant & smooth)
  useEffect(() => {
    if (cutoutDataUrl && (cutoutImgRef.current || cutoutImgState)) {
      renderComposite();
      const frameId = requestAnimationFrame(() => {
        renderComposite();
      });
      return () => {
        cancelAnimationFrame(frameId);
      };
    }
  }, [cutoutDataUrl, cutoutImgState, renderTrigger, renderComposite]);

  // Edge finishing live re-apply state
  const [isRefiningEdges, setIsRefiningEdges] = useState(false);

  const handleRefineEdges = async (level: 'silky' | 'soft' | 'crisp') => {
    const activeItem = images.find((i) => i.id === activeImageId);
    if (!activeItem || !activeItem.cutoutBlob) return;

    try {
      setIsRefiningEdges(true);
      const refinedBlob = await refineCutoutEdges(activeItem.cutoutBlob, level);
      const newCutoutUrl = URL.createObjectURL(refinedBlob);
      const newImg = new Image();
      await new Promise<void>((resolve, reject) => {
        newImg.onload = () => resolve();
        newImg.onerror = () => reject(new Error('Failed to load refined cutout'));
        newImg.src = newCutoutUrl;
      });

      setCutoutDataUrl(newCutoutUrl);
      cutoutImgRef.current = newImg;
      setCutoutImgState(newImg);
      setImages((prev) =>
        prev.map((it) =>
          it.id === activeItem.id
            ? {
                ...it,
                cutoutBlob: refinedBlob,
                cutoutDataUrl: newCutoutUrl,
                cutoutImg: newImg,
              }
            : it
        )
      );
      setRenderTrigger((prev) => prev + 1);
    } catch (err) {
      console.error('Edge refinement error:', err);
    } finally {
      setIsRefiningEdges(false);
    }
  };

  // Re-process with Ultra-Strong AI
  const [isReProcessing, setIsReProcessing] = useState(false);

  const handleReProcessStrongAI = async (strength: 'ultra' | 'strong' | 'balanced' = 'ultra') => {
    const activeItem = images.find((i) => i.id === activeImageId);
    if (!activeItem) return;

    setIsReProcessing(true);
    try {
      setAdjustments((prev) => ({
        ...prev,
        removalStrength: strength,
      }));
      await processBatchItem(activeItem, 'ai', strength);
    } finally {
      setIsReProcessing(false);
    }
  };

  // 4. Download Handler (with chosen background)
  const handleDownload = () => {
    if (!displayCanvasRef.current) return;
    const baseName = originalFile?.name || 'photo-bg-removed';
    downloadCanvasImage(displayCanvasRef.current, baseName, exportFormat);

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 70,
        spread: 80,
        origin: { y: 0.75 },
        colors: ['#00a3e0', '#00c853', '#3b82f6', '#ffffff'],
      });
    } catch (e) {
      // ignore
    }
  };

  // Dedicated Transparent PNG Download (Pure Solid Object)
  const handleDownloadTransparent = () => {
    const img = cutoutImgRef.current || cutoutImgState;
    if (!img) return;
    const baseName = (originalFile?.name || 'photo').replace(/\.[^/.]+$/, '');
    const downloadName = `${baseName}-solid-object-transparent.png`;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      try {
        confetti({
          particleCount: 65,
          spread: 75,
          origin: { y: 0.75 },
          colors: ['#38bdf8', '#34d399', '#ffffff'],
        });
      } catch (e) {}
    }, 'image/png');
  };

  // 5. Copy image to clipboard
  const handleCopyToClipboard = async () => {
    if (!displayCanvasRef.current) return;
    try {
      displayCanvasRef.current.toBlob(async (blob) => {
        if (!blob) return;
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/png': blob,
          }),
        ]);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2500);
      }, 'image/png');
    } catch (err) {
      console.warn('Clipboard write error', err);
    }
  };

  // 6. Brush Touch-up Events
  const startPainting = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isBrushActive || !brushCanvasRef.current) return;
    isPainting.current = true;
    paint(e);
  };

  const stopPainting = () => {
    if (!isPainting.current) return;
    isPainting.current = false;

    // Save state to undo stack
    if (brushCanvasRef.current) {
      const newCutoutUrl = brushCanvasRef.current.toDataURL('image/png');
      setUndoStack((prev) => [...prev, newCutoutUrl]);
      setCutoutDataUrl(newCutoutUrl);

      const newImg = new Image();
      newImg.onload = () => {
        cutoutImgRef.current = newImg;
        setCutoutImgState(newImg);
        renderComposite();
      };
      newImg.src = newCutoutUrl;
    }
  };

  const paint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isPainting.current || !brushCanvasRef.current || !originalImgRef.current) return;
    const canvas = brushCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    ctx.save();
    if (brushMode === 'erase') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, brushSize * (scaleX / 2), 0, Math.PI * 2);
      ctx.fill();
    } else if (brushMode === 'restore') {
      // Draw from original image inside circular clip
      ctx.beginPath();
      ctx.arc(x, y, brushSize * (scaleX / 2), 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(originalImgRef.current, 0, 0, canvas.width, canvas.height);
    }
    ctx.restore();
  };

  const handleBrushUndo = () => {
    if (undoStack.length <= 1) return;
    const nextStack = [...undoStack];
    nextStack.pop();
    const prevUrl = nextStack[nextStack.length - 1];
    setUndoStack(nextStack);
    setCutoutDataUrl(prevUrl);

    const newImg = new Image();
    newImg.onload = () => {
      cutoutImgRef.current = newImg;
      setCutoutImgState(newImg);
      renderComposite();
    };
    newImg.src = prevUrl;
  };

  // Sync brush canvas when entering brush mode
  useEffect(() => {
    const activeCutout = cutoutImgRef.current || cutoutImgState;
    if (isBrushActive && activeCutout && brushCanvasRef.current) {
      const bCanvas = brushCanvasRef.current;
      bCanvas.width = activeCutout.naturalWidth || activeCutout.width;
      bCanvas.height = activeCutout.naturalHeight || activeCutout.height;
      const bCtx = bCanvas.getContext('2d');
      if (bCtx) {
        bCtx.clearRect(0, 0, bCanvas.width, bCanvas.height);
        bCtx.drawImage(activeCutout, 0, 0);
      }
    }
  }, [isBrushActive, cutoutImgState]);

  // Compute active dimensions based on crop
  const activeCrop = calculateCropDimensions(
    originalDimensions.width || 1000,
    originalDimensions.height || 1000,
    selectedCrop
  );

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-blue-500 selection:text-white">
      {/* Hidden Multi-file input for the + button */}
      <input
        ref={plusFileInputRef}
        type="file"
        multiple
        accept="image/png, image/jpeg, image/webp, image/jpg"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFilesSelect(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      {/* Top Header */}
      <Header
        lang={lang}
        setLang={setLang}
        hasImage={images.length > 0 || !!cutoutDataUrl}
        onReset={handleResetAll}
        onAddImage={() => plusFileInputRef.current?.click()}
      />

      {/* Multi-Image Batch Strip with prominent + button & thumbnails */}
      {images.length > 0 && (
        <BatchImageStrip
          images={images}
          activeId={activeImageId}
          onSelectImage={handleSelectImage}
          onAddImages={() => plusFileInputRef.current?.click()}
          onRemoveImage={handleRemoveImage}
          onDownloadAllZip={handleDownloadAllZip}
          isDownloadingZip={isDownloadingZip}
          lang={lang}
        />
      )}

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col">
        {images.length === 0 && !cutoutDataUrl ? (
          // Upload and Welcome View
          <div className="flex-1 flex items-center justify-center p-4">
            <UploadZone
              lang={lang}
              onFileSelect={handleFileSelect}
              onFilesSelect={handleFilesSelect}
              onSampleSelect={handleSampleSelect}
              isProcessing={isProcessing}
              progressText={progressText}
              progressPercent={progressPercent}
              engine={removalEngine}
              setEngine={setRemovalEngine}
            />
          </div>
        ) : (
          // Editor Workspace
          <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto p-3 sm:p-5 gap-5">
            {/* Left: Interactive Canvas Stage */}
            <div className="flex-1 flex flex-col rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden shadow-2xl backdrop-blur-sm">
              {/* Canvas Top Bar */}
              <div className="p-3 border-b border-slate-800/80 flex items-center justify-between flex-wrap gap-2 bg-slate-900/90">
                {/* Resolution & Engine indicator */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs text-emerald-400 font-semibold flex items-center space-x-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {activeCrop.width} × {activeCrop.height} px
                    </span>
                  </span>

                  {/* Engine mode badge */}
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center space-x-1 border ${
                      removalEngine === 'fast'
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                        : 'bg-purple-500/10 border-purple-500/30 text-purple-300'
                    }`}
                  >
                    {removalEngine === 'fast' ? (
                      <>
                        <Zap className="w-3 h-3 text-amber-300" />
                        <span>{lang === 'bn' ? '⚡ সুপার ফাস্ট মোড' : '⚡ Fast Mode'}</span>
                      </>
                    ) : (
                      <>
                        <Cpu className="w-3 h-3 text-purple-300" />
                        <span>{lang === 'bn' ? '🧠 এআই ডিপ মোড' : '🧠 AI Deep HD'}</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Canvas Toolbar Actions */}
                <div className="flex items-center space-x-1.5 sm:space-x-2">
                  {/* Switch Engine Re-process Button */}
                  <button
                    onClick={() => handleSwitchEngine(removalEngine === 'fast' ? 'ai' : 'fast')}
                    disabled={isProcessing || isReProcessing}
                    title={
                      removalEngine === 'fast'
                        ? (lang === 'bn' ? 'এআই ডিপ নিউরাল দিয়ে রি-প্রসেস করুন' : 'Reprocess with AI Deep Neural')
                        : (lang === 'bn' ? 'সুপার ফাস্ট মোডে রি-প্রসেস করুন' : 'Reprocess with Super Fast')
                    }
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    <span>
                      {removalEngine === 'fast'
                        ? (lang === 'bn' ? 'এআই মোডে টেস্ট' : 'Try AI Mode')
                        : (lang === 'bn' ? 'ফাস্ট মোডে টেস্ট' : 'Try Fast Mode')}
                    </span>
                  </button>

                  {/* Ultra Strong AI Re-Clean Button */}
                  <button
                    onClick={() => handleReProcessStrongAI('ultra')}
                    disabled={isProcessing || isReProcessing}
                    title={lang === 'bn' ? 'আল্ট্রা স্ট্রং এআই দিয়ে সব দাগ ও ছায়া একদম ক্লিয়ার করুন' : 'Deep clean with Ultra Strong AI'}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-blue-500/50 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isProcessing || isReProcessing ? 'animate-spin' : ''}`} />
                    <span>{lang === 'bn' ? '⚡ স্ট্রং রি-রিমুভ' : '⚡ Strong Clean'}</span>
                  </button>

                  {/* Compare Button */}
                  <button
                    onClick={() => setShowComparison(!showComparison)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      showComparison
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'আসল ছবি তুলনা' : 'Compare Original'}</span>
                  </button>

                  {/* Delete Current/Previous Photo Button (when multiple images exist) */}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => activeImageId && handleRemoveImage(activeImageId)}
                      title={lang === 'bn' ? 'এই ছবিটি ডিলিট করুন' : 'Delete this photo'}
                      className="flex items-center space-x-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 hover:text-white border border-rose-500/40 transition-all cursor-pointer shadow-xs"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>{lang === 'bn' ? 'ছবি ডিলিট' : 'Delete'}</span>
                    </button>
                  )}

                  {/* Manual Brush Touch-up toggle */}
                  <button
                    onClick={() => setIsBrushActive(!isBrushActive)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
                      isBrushActive
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                    }`}
                  >
                    <Brush className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ব্রাশ টাচ-আপ' : 'Refine Brush'}</span>
                  </button>
                </div>
              </div>

              {/* Canvas Center Area */}
              <div className="flex-1 relative min-h-[380px] sm:min-h-[500px] flex items-center justify-center p-4 sm:p-8 bg-[#090d16] overflow-hidden">
                {/* Subtle checkerboard pattern for transparency */}
                <div
                  className="absolute inset-0 opacity-15 pointer-events-none"
                  style={{
                    backgroundImage: `linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)`,
                    backgroundSize: '24px 24px',
                    backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
                  }}
                ></div>

                {/* Main Content Display */}
                {isProcessing && !cutoutDataUrl ? (
                  <div className="py-12 flex flex-col items-center justify-center text-center max-w-md mx-auto z-10">
                    <div className="relative w-16 h-16 mb-4">
                      <div className="absolute inset-0 rounded-full border-4 border-slate-700"></div>
                      <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-blue-400">
                        {progressPercent}%
                      </div>
                    </div>
                    <h4 className="text-base font-bold text-white mb-1">
                      {progressText || (lang === 'bn' ? 'ব্যাকগ্রাউন্ড রিমুভ হচ্ছে...' : 'Removing background...')}
                    </h4>
                    <p className="text-xs text-slate-400">
                      {lang === 'bn'
                        ? 'শুধু মূল অবজেক্টকে সলিড রেখে নিখুঁতভাবে কাটআউট তৈরি হচ্ছে...'
                        : 'Extracting clean solid main subject and filling internal holes...'}
                    </p>
                    <div className="w-56 h-2 bg-slate-800 rounded-full mt-4 overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      ></div>
                    </div>
                  </div>
                ) : showComparison && originalDataUrl ? (
                  <div className="w-full h-full max-h-[600px] flex items-center justify-center">
                    <ComparisonSlider
                      originalUrl={originalDataUrl}
                      compositeCanvas={displayCanvasRef.current}
                      lang={lang}
                    />
                  </div>
                ) : isBrushActive ? (
                  // Brush Touch-up interactive canvas
                  <div className="relative max-h-[600px] flex items-center justify-center">
                    <canvas
                      ref={brushCanvasRef}
                      onPointerDown={startPainting}
                      onPointerMove={paint}
                      onPointerUp={stopPainting}
                      onPointerLeave={stopPainting}
                      className="max-h-[550px] max-w-full object-contain rounded-xl shadow-2xl border border-purple-500/50 cursor-crosshair touch-none"
                    />
                  </div>
                ) : (
                  // Real-time Composite Canvas with robust ref callback & Download icon toolbar beside the photo
                  <div className="relative flex flex-col md:flex-row items-center justify-center gap-3 sm:gap-4 max-w-full">
                    {/* The Canvas itself */}
                    <div className="relative max-h-[600px] flex items-center justify-center group shadow-2xl rounded-xl">
                      <canvas
                        ref={(el) => {
                          displayCanvasRef.current = el;
                          if (el && (cutoutImgRef.current || cutoutImgState)) {
                            renderComposite();
                          }
                        }}
                        className="max-h-[520px] max-w-full object-contain rounded-xl shadow-2xl border border-slate-800 transition-transform duration-200"
                      />

                      {/* Passport Alignment Overlay Guides (if passport crop selected) */}
                      {(selectedCrop.id === '7:9' || selectedCrop.id === '1:1') && (
                        <div className="absolute inset-0 pointer-events-none border border-blue-500/30 rounded-xl flex flex-col justify-between p-4">
                          <div className="w-full border-b border-dashed border-blue-400/40 text-[10px] text-blue-300 font-mono pl-1">
                            {lang === 'bn' ? 'মাথার উপরিভাগ (Top of Head)' : 'Top of Head'}
                          </div>
                          <div className="w-full border-b border-dashed border-blue-400/40 text-[10px] text-blue-300 font-mono pl-1">
                            {lang === 'bn' ? 'চোখের রেখা (Eye Line)' : 'Eye Line'}
                          </div>
                          <div className="w-full border-b border-dashed border-blue-400/40 text-[10px] text-blue-300 font-mono pl-1">
                            {lang === 'bn' ? 'থুতনি রেখা (Chin Line)' : 'Chin Line'}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* BESIDE THE IMAGE (chobi pase) - Download Icons & Quick Actions */}
                    <div className="flex md:flex-col items-center gap-2.5 z-20 shrink-0 bg-slate-900/95 backdrop-blur-md p-2 sm:p-2.5 rounded-2xl border border-slate-700/80 shadow-2xl">
                      {/* 1. Main Download Icon (With selected background) */}
                      <button
                        type="button"
                        id="btn-image-side-download"
                        onClick={handleDownload}
                        title={lang === 'bn' ? 'ছবি ডাউনলোড করুন' : 'Download Photo'}
                        className="relative p-3 sm:p-3.5 rounded-xl bg-gradient-to-br from-blue-600 via-blue-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white shadow-lg shadow-blue-600/30 hover:scale-110 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer group"
                      >
                        <Download className="w-5 h-5 sm:w-6 sm:h-6 drop-shadow group-hover:translate-y-0.5 transition-transform" />
                        <span className="text-[10px] font-bold mt-1 tracking-tight">
                          {lang === 'bn' ? 'ডাউনলোড' : 'Download'}
                        </span>
                        <span className="absolute -top-1.5 -right-1.5 bg-emerald-400 text-slate-950 font-black text-[9px] px-1 rounded-full uppercase shadow">
                          {exportFormat}
                        </span>
                      </button>

                      {/* 2. Transparent Cutout PNG Download Icon */}
                      <button
                        type="button"
                        id="btn-image-side-download-transparent"
                        onClick={handleDownloadTransparent}
                        title={lang === 'bn' ? 'শুধু মূল অবজেক্ট স্বচ্ছ PNG ডাউনলোড' : 'Download Transparent Cutout PNG'}
                        className="p-2.5 sm:p-3 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-emerald-500/40 hover:border-emerald-400 shadow-md hover:scale-110 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer group"
                      >
                        <Layers className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                        <span className="text-[9px] font-bold text-slate-200 mt-1">PNG</span>
                      </button>

                      {/* 3. Copy to clipboard icon */}
                      <button
                        type="button"
                        id="btn-image-side-copy"
                        onClick={handleCopyToClipboard}
                        title={lang === 'bn' ? 'ক্লিপবোর্ডে কপি করুন' : 'Copy to Clipboard'}
                        className="p-2 sm:p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 shadow-sm hover:scale-110 active:scale-95 transition-all flex flex-col items-center justify-center cursor-pointer"
                      >
                        {isCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        <span className="text-[9px] font-semibold text-slate-400 mt-0.5">
                          {isCopied ? (lang === 'bn' ? 'কপি' : 'Done') : (lang === 'bn' ? 'কপি' : 'Copy')}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Canvas Bottom Quick Bar: Compact Small Color Icons (no oversized icons) */}
              {!isBrushActive && (
                <div className="py-2 px-3 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto py-0.5 no-scrollbar">
                    {/* Transparent PNG swatch icon - small */}
                    <button
                      type="button"
                      onClick={() => setBgType('transparent')}
                      title={lang === 'bn' ? 'স্বচ্ছ ব্যাকগ্রাউন্ড (Transparent PNG)' : 'Transparent PNG'}
                      className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full border transition-all shrink-0 cursor-pointer flex items-center justify-center relative overflow-hidden shadow-xs hover:scale-110 ${
                        bgType === 'transparent'
                          ? 'border-blue-400 ring-2 ring-blue-500/60 scale-110'
                          : 'border-slate-700 hover:border-slate-500 bg-slate-800'
                      }`}
                    >
                      <div
                        className="w-full h-full"
                        style={{
                          backgroundImage: `linear-gradient(45deg, #64748b 25%, transparent 25%), linear-gradient(-45deg, #64748b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #64748b 75%), linear-gradient(-45deg, transparent 75%, #64748b 75%)`,
                          backgroundSize: '6px 6px',
                          backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
                        }}
                      />
                      {bgType === 'transparent' && (
                        <Check className="w-3 h-3 text-white drop-shadow absolute inset-0 m-auto" />
                      )}
                    </button>

                    {/* Quick color swatches - ONLY small compact color dots */}
                    {[
                      '#00a3e0', // Passport Cyan Blue
                      '#003366', // Classic Passport Navy
                      '#1d4ed8', // Royal Studio Blue
                      '#00c853', // Studio Chroma Green
                      '#047857', // Deep Emerald Green
                      '#ffffff', // Visa White
                      '#e2e8f0', // Off White
                      '#64748b', // Slate
                      '#dc2626', // Red
                      '#ea580c', // Orange
                      '#8b5cf6', // Studio Purple
                      '#fbcfe8', // Soft Pink
                      '#121212', // Black
                    ].map((colorHex) => {
                      const isActive = bgType === 'solid' && solidColor.toLowerCase() === colorHex.toLowerCase();
                      const isLight = ['#ffffff', '#e2e8f0', '#fbcfe8'].includes(colorHex.toLowerCase());
                      return (
                        <button
                          key={colorHex}
                          type="button"
                          onClick={() => {
                            setSolidColor(colorHex);
                            setBgType('solid');
                          }}
                          title={colorHex}
                          className={`w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full border transition-all shrink-0 cursor-pointer flex items-center justify-center relative shadow-xs hover:scale-110 active:scale-95 ${
                            isActive
                              ? 'border-blue-400 ring-2 ring-blue-500/70 scale-110'
                              : 'border-slate-700/80 hover:border-slate-500'
                          }`}
                          style={{ backgroundColor: colorHex }}
                        >
                          {isActive && (
                            <Check
                              className="w-3 h-3 drop-shadow"
                              style={{ color: isLight ? '#0f172a' : '#ffffff' }}
                            />
                          )}
                        </button>
                      );
                    })}

                    {/* Small compact color picker palette icon */}
                    <div
                      className="relative w-5.5 h-5.5 sm:w-6 sm:h-6 rounded-full overflow-hidden border border-slate-700 hover:border-slate-500 shrink-0 cursor-pointer shadow-xs hover:scale-110 transition-transform"
                      title={lang === 'bn' ? 'কাস্টম কালার' : 'Custom Color'}
                    >
                      <input
                        type="color"
                        value={solidColor}
                        onChange={(e) => {
                          setSolidColor(e.target.value);
                          setBgType('solid');
                        }}
                        className="absolute -inset-2 w-10 h-10 cursor-pointer opacity-0"
                      />
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-tr from-rose-500 via-emerald-500 to-sky-500">
                        <Palette className="w-2.5 h-2.5 text-white drop-shadow" />
                      </div>
                    </div>
                  </div>

                  {/* Fast Download button on quick bar */}
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white text-xs font-bold transition-all shrink-0 cursor-pointer shadow-md"
                    title={lang === 'bn' ? 'ছবি ডাউনলোড করুন' : 'Download Photo'}
                  >
                    <Download className="w-3.5 h-3.5 text-white" />
                    <span>{lang === 'bn' ? 'ডাউনলোড' : 'Download'}</span>
                  </button>
                </div>
              )}

              {/* Bottom Brush Panel Overlay if active */}
              {isBrushActive && (
                <div className="p-3 border-t border-slate-800 bg-slate-900/95">
                  <BrushTouchupPanel
                    lang={lang}
                    brushMode={brushMode}
                    setBrushMode={setBrushMode}
                    brushSize={brushSize}
                    setBrushSize={setBrushSize}
                    onUndo={handleBrushUndo}
                    canUndo={undoStack.length > 1}
                    onClose={() => setIsBrushActive(false)}
                  />
                </div>
              )}
            </div>

            {/* Right: Studio Control Panel & Export */}
            <div className="w-full lg:w-96 flex flex-col space-y-4">
              {/* Tab Navigation */}
              <div className="flex p-1 rounded-xl bg-slate-900 border border-slate-800">
                <button
                  onClick={() => setActiveTab('color')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'color'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Palette className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'ব্যাকগ্রাউন্ড' : 'Background'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('crop')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'crop'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CropIcon className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'সাইজ ও ক্রপ' : 'Crop & Size'}</span>
                </button>

                <button
                  onClick={() => setActiveTab('adjust')}
                  className={`flex-1 flex items-center justify-center space-x-1.5 py-2.5 rounded-lg text-xs font-bold transition-all ${
                    activeTab === 'adjust'
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Sliders className="w-4 h-4" />
                  <span>{lang === 'bn' ? 'লাইটিং ও এজ' : 'Refine'}</span>
                </button>
              </div>

              {/* Tab Contents Card */}
              <div className="flex-1 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl overflow-y-auto max-h-[500px]">
                {activeTab === 'color' && (
                  <ColorPickerPanel
                    lang={lang}
                    bgType={bgType}
                    setBgType={setBgType}
                    solidColor={solidColor}
                    setSolidColor={setSolidColor}
                    selectedGradient={selectedGradient}
                    setSelectedGradient={setSelectedGradient}
                    blurAmount={blurAmount}
                    setBlurAmount={setBlurAmount}
                    onCustomBgUpload={handleCustomBgUpload}
                    hasCustomBgImage={!!customBgImage}
                  />
                )}

                {activeTab === 'crop' && (
                  <CropControls
                    lang={lang}
                    selectedCrop={selectedCrop}
                    setSelectedCrop={setSelectedCrop}
                    zoom={zoom}
                    setZoom={setZoom}
                    panX={panX}
                    setPanX={setPanX}
                    panY={panY}
                    setPanY={setPanY}
                    onResetPosition={() => {
                      setZoom(1);
                      setPanX(0);
                      setPanY(0);
                    }}
                    computedWidth={activeCrop.width}
                    computedHeight={activeCrop.height}
                  />
                )}

                {activeTab === 'adjust' && (
                  <AdjustmentsPanel
                    lang={lang}
                    adjustments={adjustments}
                    setAdjustments={setAdjustments}
                    onApplyPresetColor={(hex) => {
                      setSolidColor(hex);
                      setBgType('solid');
                    }}
                    onRefineEdges={handleRefineEdges}
                    isRefining={isRefiningEdges}
                    onReProcessStrongAI={handleReProcessStrongAI}
                    isReProcessing={isReProcessing}
                  />
                )}
              </div>

              {/* Export / Download Station */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">
                    {lang === 'bn' ? 'ডাউনলোড ফরম্যাট' : 'Export Format'}
                  </span>
                  <div className="flex items-center space-x-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800">
                    {(['png', 'jpeg', 'webp'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        onClick={() => setExportFormat(fmt)}
                        className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase transition-colors ${
                          exportFormat === fmt
                            ? 'bg-blue-600 text-white'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {fmt === 'jpeg' ? 'JPG' : fmt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Primary Download Button (with chosen background or transparent) */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full flex items-center justify-center space-x-2 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-emerald-500 hover:from-blue-500 hover:to-emerald-400 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    {lang === 'bn'
                      ? (bgType === 'transparent'
                          ? `স্বচ্ছ ব্যাকগ্রাউন্ড ডাউনলোড (${exportFormat.toUpperCase()})`
                          : `কালার ব্যাকগ্রাউন্ড সহ ডাউনলোড (${exportFormat.toUpperCase()})`)
                      : `Download with Background (${exportFormat.toUpperCase()})`}
                  </span>
                </button>

                {/* Secondary Button: Pure Solid Object Transparent PNG */}
                <button
                  type="button"
                  onClick={handleDownloadTransparent}
                  className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 font-semibold text-xs transition-all cursor-pointer shadow-sm"
                >
                  <Layers className="w-4 h-4 text-sky-400" />
                  <span>
                    {lang === 'bn'
                      ? '📥 শুধু মেইন অবজেক্ট স্বচ্ছ পিএনজি ডাউনলোড (PNG)'
                      : '📥 Download Solid Subject Only (Transparent PNG)'}
                  </span>
                </button>

                {/* Copy & Info */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                  <span className="flex items-center space-x-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {lang === 'bn' ? '১০০% আসল রেজোলিউশন সংরক্ষিত' : 'Original Quality Preserved'}
                    </span>
                  </span>

                  <button
                    onClick={handleCopyToClipboard}
                    className="flex items-center space-x-1 text-slate-300 hover:text-white transition-colors"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">{lang === 'bn' ? 'কপি হয়েছে' : 'Copied!'}</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>{lang === 'bn' ? 'ক্লিপবোর্ডে কপি' : 'Copy'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
