import React, { useState, useRef, useEffect } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Check, X, Move } from 'lucide-react';

interface ImageCropperModalProps {
  file: File;
  docLabel: string;
  onCropComplete: (croppedFile: File) => void;
  onCancel: () => void;
}

export default function ImageCropperModal({ file, docLabel, onCropComplete, onCancel }: ImageCropperModalProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  
  const imageRef = useRef<HTMLImageElement>(null);
  const dragStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const startPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Viewport dimensions (standard A4 aspect ratio 1:1.414)
  const cw = 280;
  const ch = 396;

  // Load the file as an object URL
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
  };

  // Calculate base fitted size of the image covering or containing the crop box at 0 degrees
  const getFittedSize = () => {
    if (naturalSize.w === 0 || naturalSize.h === 0) return { fw: cw, fh: ch };
    const imageAspect = naturalSize.w / naturalSize.h;
    const frameAspect = cw / ch;

    let fw, fh;
    // We fit containment style so they can see the whole document and then zoom in
    if (imageAspect > frameAspect) {
      fw = cw;
      fh = cw / imageAspect;
    } else {
      fh = ch;
      fw = ch * imageAspect;
    }
    return { fw, fh };
  };

  const { fw: fw0, fh: fh0 } = getFittedSize();

  // Mouse Drag Events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    startPanRef.current = { x: pan.x, y: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPan({
      x: startPanRef.current.x + dx,
      y: startPanRef.current.y + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch Drag Events (Mobile Friendly)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    startPanRef.current = { x: pan.x, y: pan.y };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - dragStartRef.current.x;
    const dy = e.touches[0].clientY - dragStartRef.current.y;
    setPan({
      x: startPanRef.current.x + dx,
      y: startPanRef.current.y + dy,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
    // Reset panning to avoid flying off-screen when rotated
    setPan({ x: 0, y: 0 });
  };

  const handleCrop = () => {
    if (!imageRef.current || naturalSize.w === 0) return;

    const canvas = document.createElement('canvas');
    // High-res output size (preserving standard document aspect ratio)
    const outputWidth = 1200;
    const outputHeight = 1697; // 1200 * 1.414

    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    // Fill background with white
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    const scaleFactor = outputWidth / cw;

    // 1. Translate to canvas center + pan offset scaled
    ctx.translate(outputWidth / 2 + pan.x * scaleFactor, outputHeight / 2 + pan.y * scaleFactor);

    // 2. Rotate
    ctx.rotate((rotation * Math.PI) / 180);

    // 3. Scale by zoom and mapping factor
    ctx.scale(zoom * scaleFactor, zoom * scaleFactor);

    // 4. Draw original image centered
    ctx.drawImage(imageRef.current, -fw0 / 2, -fh0 / 2, fw0, fh0);

    // Export to JPEG
    canvas.toBlob((blob) => {
      if (blob) {
        // Retain original name, but convert file type to jpeg
        const croppedFile = new File([blob], file.name, { type: 'image/jpeg' });
        onCropComplete(croppedFile);
      } else {
        alert('Cropping failed. Please try again.');
      }
    }, 'image/jpeg', 0.95);
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(2, 11, 30, 0.9)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '16px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <div style={{
        backgroundColor: '#111827',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '20px',
        padding: '24px',
        maxWidth: '440px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        color: '#FFFFFF'
      }}>
        {/* Title / Description */}
        <div style={{ textAlign: 'center', marginBottom: '16px', width: '100%' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 4px', color: '#FFFFFF' }}>Adjust Scanned File</h3>
          <p style={{ fontSize: '12px', color: '#9CA3AF', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Filing: <span style={{ color: '#4FA3FF', fontWeight: '600' }}>{docLabel}</span>
          </p>
        </div>

        {/* Viewport Frame */}
        <div 
          style={{
            width: `${cw}px`,
            height: `${ch}px`,
            position: 'relative',
            overflow: 'hidden',
            borderRadius: '12px',
            border: '2.5px solid #4FA3FF',
            backgroundColor: '#030712',
            boxShadow: '0 0 20px rgba(79, 163, 255, 0.15)',
            touchAction: 'none', // Prevents default scrolling when dragging on mobile
            cursor: isDragging ? 'grabbing' : 'grab',
            userSelect: 'none'
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Image */}
          {imageSrc && (
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop Source"
              onLoad={handleImageLoad}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: `${fw0}px`,
                height: `${fh0}px`,
                transform: `translate(-50%, -50%) translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                transformOrigin: 'center center',
                maxWidth: 'none',
                maxHeight: 'none',
                pointerEvents: 'none' // Critical so standard img drag doesn't conflict with our drag listeners
              }}
            />
          )}

          {/* Grid lines overlay */}
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gridTemplateRows: '1fr 1fr 1fr',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}>
            <div style={{ borderRight: '1px dashed rgba(255,255,255,0.2)', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderRight: '1px dashed rgba(255,255,255,0.2)', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderRight: '1px dashed rgba(255,255,255,0.2)', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderRight: '1px dashed rgba(255,255,255,0.2)', borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderBottom: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderRight: '1px dashed rgba(255,255,255,0.2)' }} />
            <div style={{ borderRight: '1px dashed rgba(255,255,255,0.2)' }} />
            <div />
          </div>

          {/* Helper Drag Icon Overlay */}
          <div style={{
            position: 'absolute',
            bottom: '10px',
            right: '10px',
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: '6px',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none'
          }}>
            <Move size={14} color="#FFF" style={{ opacity: 0.8 }} />
          </div>
        </div>

        {/* Zoom Slider */}
        <div style={{ width: '100%', marginTop: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ZoomOut size={16} color="#9CA3AF" />
          <input
            type="range"
            min="1"
            max="4"
            step="0.05"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{
              flex: 1,
              height: '6px',
              borderRadius: '3px',
              outline: 'none',
              cursor: 'pointer',
              accentColor: '#4FA3FF'
            }}
          />
          <ZoomIn size={16} color="#9CA3AF" />
        </div>

        {/* Crop Controls */}
        <div style={{
          display: 'flex',
          gap: '12px',
          width: '100%',
          marginTop: '24px'
        }}>
          {/* Cancel */}
          <button
            onClick={onCancel}
            style={{
              flex: 1,
              padding: '12px',
              borderRadius: '10px',
              border: '1.5px solid rgba(255,255,255,0.15)',
              backgroundColor: 'transparent',
              color: '#F3F4F6',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={15} /> Cancel
          </button>

          {/* Rotate */}
          <button
            onClick={handleRotate}
            style={{
              padding: '12px 16px',
              borderRadius: '10px',
              border: '1.5px solid rgba(79, 163, 255, 0.3)',
              backgroundColor: 'rgba(79, 163, 255, 0.1)',
              color: '#4FA3FF',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
            onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(79, 163, 255, 0.2)'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = 'rgba(79, 163, 255, 0.1)'}
          >
            <RotateCw size={15} /> Rotate
          </button>

          {/* Crop & Apply */}
          <button
            onClick={handleCrop}
            style={{
              flex: 1.2,
              padding: '12px',
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #0056b3, #002147)',
              color: '#FFFFFF',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s',
              boxShadow: '0 4px 12px rgba(0, 86, 179, 0.3)'
            }}
            onMouseOver={e => e.currentTarget.style.filter = 'brightness(1.1)'}
            onMouseOut={e => e.currentTarget.style.filter = 'none'}
          >
            <Check size={15} /> Apply Crop
          </button>
        </div>
      </div>
    </div>
  );
}
