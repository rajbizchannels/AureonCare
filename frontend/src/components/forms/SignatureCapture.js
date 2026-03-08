import React, { useRef, useState, useEffect, useCallback } from 'react';
import { PenLine, RotateCcw, Check, Type } from 'lucide-react';

const SignatureCapture = ({
  onSave,
  onCancel,
  signerName = '',
  signerRole = 'patient',
  theme = 'light',
  label = 'Signature',
  required = false
}) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [mode, setMode] = useState('draw'); // 'draw' | 'type'
  const [typedName, setTypedName] = useState(signerName || '');
  const [hasSignature, setHasSignature] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);

  const dark = theme === 'dark';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = dark ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = dark ? '#e2e8f0' : '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [dark, mode]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const pos = getPos(e, canvas);
    setLastPoint(pos);
  }, []);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setLastPoint(pos);
    setHasSignature(true);
  }, [isDrawing, lastPoint]);

  const stopDrawing = useCallback((e) => {
    e.preventDefault();
    setIsDrawing(false);
    setLastPoint(null);
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = dark ? '#1e293b' : '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const getSignatureData = () => {
    if (mode === 'type') {
      if (!typedName.trim()) return null;
      // Render typed name onto a canvas
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = dark ? '#1e293b' : '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = 'italic 36px "Dancing Script", cursive, Georgia, serif';
      ctx.fillStyle = dark ? '#e2e8f0' : '#1e293b';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(typedName, canvas.width / 2, canvas.height / 2);
      return canvas.toDataURL('image/png');
    }
    if (!hasSignature) return null;
    return canvasRef.current.toDataURL('image/png');
  };

  const handleSave = () => {
    const data = getSignatureData();
    if (!data) return;
    onSave({
      signature_data: data,
      signature_type: mode === 'type' ? 'typed' : 'drawn',
      signer_name: mode === 'type' ? typedName : signerName,
    });
  };

  const canSave = mode === 'type' ? typedName.trim().length > 0 : hasSignature;

  return (
    <div className={`rounded-xl border p-4 ${dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${dark ? 'text-slate-200' : 'text-gray-700'}`}>
          {label}{required && <span className="text-red-500 ml-1">*</span>}
        </span>
        <div className={`flex rounded-lg overflow-hidden border ${dark ? 'border-slate-600' : 'border-gray-200'}`}>
          <button
            onClick={() => { setMode('draw'); setHasSignature(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'draw'
                ? 'bg-blue-600 text-white'
                : dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <PenLine className="w-3 h-3" /> Draw
          </button>
          <button
            onClick={() => setMode('type')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
              mode === 'type'
                ? 'bg-blue-600 text-white'
                : dark ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Type className="w-3 h-3" /> Type
          </button>
        </div>
      </div>

      {mode === 'draw' ? (
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className={`w-full rounded-lg border-2 border-dashed cursor-crosshair touch-none ${
              dark ? 'border-slate-600 bg-slate-900' : 'border-gray-300 bg-gray-50'
            }`}
            style={{ height: '120px' }}
          />
          {!hasSignature && (
            <div className={`absolute inset-0 flex items-center justify-center pointer-events-none text-sm ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
              Sign here
            </div>
          )}
        </div>
      ) : (
        <div className={`rounded-lg border-2 border-dashed p-4 ${dark ? 'border-slate-600 bg-slate-900' : 'border-gray-300 bg-gray-50'}`}>
          <input
            type="text"
            value={typedName}
            onChange={e => setTypedName(e.target.value)}
            placeholder="Type your full name"
            className={`w-full text-2xl text-center italic bg-transparent border-none outline-none ${dark ? 'text-slate-200 placeholder-slate-600' : 'text-gray-800 placeholder-gray-300'}`}
            style={{ fontFamily: 'Georgia, serif' }}
          />
          <canvas ref={canvasRef} width={600} height={100} className="hidden" />
        </div>
      )}

      <p className={`text-xs mt-2 ${dark ? 'text-slate-500' : 'text-gray-400'}`}>
        By signing, you agree that this electronic signature is legally binding.
      </p>

      <div className="flex gap-2 mt-3">
        {mode === 'draw' && (
          <button
            onClick={clearCanvas}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <RotateCcw className="w-3 h-3" /> Clear
          </button>
        )}
        {onCancel && (
          <button
            onClick={onCancel}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              dark ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
            }`}
          >
            Cancel
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg transition-colors ml-auto ${
            canSave
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : dark ? 'bg-slate-700 text-slate-500 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          <Check className="w-3 h-3" /> Apply Signature
        </button>
      </div>
    </div>
  );
};

export default SignatureCapture;
