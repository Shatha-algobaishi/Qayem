import { useEffect, useRef, useState } from 'react';

interface Props {
  userId: string;
  isAr: boolean;
  onClose: () => void;
}

const SIG_KEY = (uid: string) => `qayem_sig_${uid}`;

export function getSignature(userId: string): string | null {
  return localStorage.getItem(SIG_KEY(userId));
}

export default function SignatureModal({ userId, isAr, onClose }: Props) {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const [uploadedSrc, setUploadedSrc] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const label = (ar: string, en: string) => isAr ? ar : en;

  /* Load existing signature into canvas when switching to draw tab */
  useEffect(() => {
    if (tab !== 'draw') return;
    const existing = getSignature(userId);
    if (existing && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, 400, 150); ctx.drawImage(img, 0, 0); };
      img.src = existing;
    }
  }, [tab, userId]);

  /* ── Canvas drawing helpers ── */
  const getPos = (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ('touches' in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    lastPos.current = getPos(e);
    setSaved(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current || !canvasRef.current || !lastPos.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => {
    isDrawing.current = false;
    lastPos.current = null;
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSaved(false);
  };

  /* ── Save ── */
  const handleSave = () => {
    if (tab === 'draw') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL('image/png');
      localStorage.setItem(SIG_KEY(userId), dataUrl);
    } else {
      if (!uploadedSrc) return;
      localStorage.setItem(SIG_KEY(userId), uploadedSrc);
    }
    setSaved(true);
    setTimeout(onClose, 900);
  };

  const handleRemove = () => {
    localStorage.removeItem(SIG_KEY(userId));
    clearCanvas();
    setUploadedSrc(null);
    setSaved(false);
  };

  /* ── Upload ── */
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { if (ev.target?.result) setUploadedSrc(ev.target.result as string); };
    reader.readAsDataURL(file);
    setSaved(false);
  };

  const existing = getSignature(userId);

  return (
    /* Backdrop */
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16, width: '100%', maxWidth: 480,
          boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
          overflow: 'hidden',
          fontFamily: 'inherit',
        }}
        dir={isAr ? 'rtl' : 'ltr'}
      >
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0f172a' }}>
              {label('التوقيع الإلكتروني', 'Electronic Signature')}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: '#94a3b8' }}>
              {label('يظهر التوقيع عند طباعة التقييم', 'Signature appears when printing evaluations')}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: 20, lineHeight: 1, padding: 4 }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          {(['draw', 'upload'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setSaved(false); }}
              style={{
                flex: 1, padding: '12px 0', background: 'none',
                border: 'none', borderBottom: tab === t ? '2.5px solid #1d4ed8' : '2.5px solid transparent',
                color: tab === t ? '#1d4ed8' : '#64748b',
                cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400,
                transition: 'all 0.15s', fontFamily: 'inherit',
              }}
            >
              {t === 'draw' ? label('رسم التوقيع', 'Draw Signature') : label('رفع صورة', 'Upload Image')}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>

          {tab === 'draw' && (
            <>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
                {label('ارسم توقيعك في المربع أدناه', 'Draw your signature in the box below')}
              </p>
              <canvas
                ref={canvasRef}
                width={432}
                height={150}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={endDraw}
                onMouseLeave={endDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={endDraw}
                style={{
                  width: '100%', height: 150, display: 'block',
                  border: '1.5px solid #cbd5e1', borderRadius: 10,
                  cursor: 'crosshair', background: '#f8fafc',
                  touchAction: 'none',
                }}
              />
              <div style={{ marginTop: 8, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={clearCanvas}
                  style={{ background: 'none', border: '1px solid #e2e8f0', borderRadius: 6, padding: '5px 12px', fontSize: 12, color: '#64748b', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  {label('مسح', 'Clear')}
                </button>
              </div>
            </>
          )}

          {tab === 'upload' && (
            <>
              <p style={{ fontSize: 12, color: '#94a3b8', margin: '0 0 12px' }}>
                {label('ارفع صورة توقيعك (PNG/JPG)', 'Upload a photo of your signature (PNG/JPG)')}
              </p>
              <label style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                height: 130, border: '2px dashed #cbd5e1', borderRadius: 10,
                cursor: 'pointer', background: '#f8fafc', color: '#94a3b8', fontSize: 13, gap: 8,
                transition: 'border-color 0.15s',
              }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#cbd5e1">
                  <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
                </svg>
                {label('انقر لاختيار ملف', 'Click to choose file')}
                <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
              </label>
              {uploadedSrc && (
                <div style={{ marginTop: 12, border: '1px solid #e2e8f0', borderRadius: 10, padding: 8, background: '#f8fafc' }}>
                  <img src={uploadedSrc} alt="signature preview" style={{ maxWidth: '100%', maxHeight: 120, display: 'block', margin: '0 auto' }} />
                </div>
              )}
            </>
          )}

          {/* Existing signature preview */}
          {existing && tab === 'draw' && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: '#f0f9ff', borderRadius: 10, border: '1px solid #bae6fd', display: 'flex', alignItems: 'center', gap: 12 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#0ea5e9"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z"/></svg>
              <p style={{ margin: 0, fontSize: 12, color: '#0369a1' }}>
                {label('يوجد توقيع محفوظ. ارسم توقيعاً جديداً لاستبداله.', 'A saved signature exists. Draw a new one to replace it.')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '0 24px 20px', display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
          {existing && (
            <button
              onClick={handleRemove}
              style={{ padding: '9px 16px', background: 'none', border: '1px solid #fca5a5', borderRadius: 8, color: '#dc2626', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
            >
              {label('حذف التوقيع', 'Remove Signature')}
            </button>
          )}
          <button
            onClick={onClose}
            style={{ padding: '9px 16px', background: 'none', border: '1px solid #e2e8f0', borderRadius: 8, color: '#64748b', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
          >
            {label('إلغاء', 'Cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={tab === 'upload' && !uploadedSrc}
            style={{
              padding: '9px 20px',
              background: (tab === 'upload' && !uploadedSrc) ? '#94a3b8' : '#1d4ed8',
              border: 'none', borderRadius: 8, color: '#fff',
              cursor: (tab === 'upload' && !uploadedSrc) ? 'not-allowed' : 'pointer',
              fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            {saved ? (label('✓ تم الحفظ', '✓ Saved')) : label('حفظ التوقيع', 'Save Signature')}
          </button>
        </div>
      </div>
    </div>
  );
}
