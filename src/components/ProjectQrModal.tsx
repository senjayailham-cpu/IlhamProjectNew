import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project } from '../types';
import { showToast } from './Toast';
import { 
  QrCode, X, Copy, Check, Printer, ExternalLink, 
  WifiOff, AlertCircle, Building2, Tag, Calendar, Layers 
} from 'lucide-react';

export interface ProjectQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: Project | null;
}

export default function ProjectQrModal({
  isOpen,
  onClose,
  project
}: ProjectQrModalProps) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isOffline, setIsOffline] = useState(
    typeof window !== 'undefined' ? !navigator.onLine : false
  );
  const printAreaRef = useRef<HTMLDivElement>(null);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Reset states on project or open change
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      setImageError(false);
      setImageLoaded(false);
    }
  }, [isOpen, project?.id]);

  // Deep Link URL format
  const qrUrl = useMemo(() => {
    if (!project || typeof window === 'undefined') return '';
    return `${window.location.origin}${window.location.pathname}?projectId=${encodeURIComponent(project.id)}&mode=qr`;
  }, [project]);

  // QR Code Image API
  const qrImageUrl = useMemo(() => {
    if (!qrUrl) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=10&data=${encodeURIComponent(qrUrl)}`;
  }, [qrUrl]);

  if (!isOpen || !project) return null;

  // Copy Link Handler
  const handleCopyLink = async () => {
    if (!qrUrl) return;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(qrUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = qrUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      setCopied(true);
      showToast('Deep link copied to clipboard!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast('Failed to copy link', 'error');
    }
  };

  // Print Handler: Opens a printable document card for shopfloor sticking
  const handlePrint = () => {
    if (!project) return;

    const printWindow = window.open('', '_blank', 'width=700,height=800');
    if (!printWindow) {
      // Fallback: window.print directly
      window.print();
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${project.name}</title>
          <meta charset="utf-8" />
          <style>
            @page {
              size: A5 portrait;
              margin: 10mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
              color: #111827;
              background: #ffffff;
              padding: 20px;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .card {
              border: 3px solid #111827;
              border-radius: 12px;
              padding: 24px;
              max-width: 420px;
              width: 100%;
              text-align: center;
              box-sizing: border-box;
            }
            .header {
              border-bottom: 2px solid #e5e7eb;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .org {
              font-size: 11px;
              font-weight: 800;
              letter-spacing: 2px;
              text-transform: uppercase;
              color: #4b5563;
              margin-bottom: 4px;
            }
            .title {
              font-size: 20px;
              font-weight: 800;
              line-height: 1.2;
              color: #111827;
              margin: 0 0 6px 0;
            }
            .badges {
              display: flex;
              gap: 6px;
              justify-content: center;
              flex-wrap: wrap;
              margin-top: 8px;
            }
            .badge {
              font-size: 11px;
              font-weight: 700;
              padding: 3px 8px;
              border-radius: 4px;
              border: 1px solid #111827;
              background: #f3f4f6;
            }
            .badge-wo {
              background: #111827;
              color: #ffffff;
            }
            .qr-container {
              margin: 16px 0;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .qr-image {
              width: 220px;
              height: 220px;
              object-fit: contain;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 6px;
            }
            .url-text {
              font-family: monospace;
              font-size: 9px;
              word-break: break-all;
              color: #6b7280;
              background: #f9fafb;
              padding: 6px 8px;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
              margin-top: 10px;
            }
            .instruction {
              font-size: 11px;
              font-weight: 600;
              color: #374151;
              margin-top: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header">
              <div class="org">Austin Batam Operations</div>
              <h1 class="title">${project.name}</h1>
              <div class="badges">
                ${project.client ? `<span class="badge badge-wo">WO: ${project.client}</span>` : ''}
                ${project.customer ? `<span class="badge">Cust: ${project.customer}</span>` : ''}
                <span class="badge">Category: ${project.category || 'General'}</span>
                ${project.location ? `<span class="badge">${project.location}</span>` : ''}
              </div>
            </div>

            <div class="qr-container">
              <img src="${qrImageUrl}" alt="Project QR Code" class="qr-image" />
            </div>

            <div class="instruction">
              Scan with camera to open Progress, Timesheet & Status
            </div>

            <div class="url-text">
              ${qrUrl}
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        className="bg-base-bg border border-base-border w-full max-w-md rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-base-border bg-base-surface flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-base-accent-dim border border-base-accent/30 text-base-accent flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-condensed font-extrabold text-base text-base-text uppercase tracking-wider">
                Project QR Code
              </h3>
              <p className="text-[11px] text-base-muted">
                Scan on mobile to open live action panel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-base-muted hover:text-base-text hover:bg-base-surface3 transition cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Printable Card Area */}
          <div 
            ref={printAreaRef}
            className="bg-base-surface border border-base-border rounded-xl p-4 flex flex-col items-center text-center space-y-3 shadow-inner"
          >
            {/* Project Labels */}
            <div className="w-full space-y-1">
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {project.client && (
                  <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-base-accent text-white">
                    WO: {project.client}
                  </span>
                )}
                <span className="text-[10px] font-condensed font-bold uppercase px-2 py-0.5 rounded bg-base-surface2 border border-base-border text-base-muted">
                  {project.category || 'General'}
                </span>
                {project.location && (
                  <span className="text-[10px] font-condensed font-bold uppercase px-2 py-0.5 rounded bg-base-surface2 border border-base-border text-base-muted">
                    {project.location}
                  </span>
                )}
              </div>
              <h4 className="font-condensed font-extrabold text-lg text-base-text line-clamp-2 mt-1">
                {project.name}
              </h4>
              {project.customer && (
                <p className="text-xs text-base-muted font-medium">
                  Client / Customer: <span className="text-base-text font-bold">{project.customer}</span>
                </p>
              )}
            </div>

            {/* QR Code Presentation */}
            <div className="relative p-2 bg-white rounded-xl shadow-xs border border-neutral-200 w-52 h-52 flex items-center justify-center">
              {!isOffline && !imageError ? (
                <>
                  {!imageLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 rounded-xl animate-pulse">
                      <QrCode className="w-10 h-10 text-neutral-400" />
                    </div>
                  )}
                  <img
                    src={qrImageUrl}
                    alt={`QR Code for ${project.name}`}
                    className={`w-full h-full object-contain rounded transition-opacity duration-300 ${
                      imageLoaded ? 'opacity-100' : 'opacity-0'
                    }`}
                    onLoad={() => setImageLoaded(true)}
                    onError={() => setImageError(true)}
                  />
                </>
              ) : (
                /* Offline / Network Fallback */
                <div className="flex flex-col items-center justify-center p-3 text-neutral-800 text-center space-y-1.5">
                  <WifiOff className="w-8 h-8 text-neutral-500" />
                  <span className="text-xs font-bold">Image Offline</span>
                  <span className="text-[10px] text-neutral-600 leading-tight">
                    QR image requires network, but the direct URL link below is fully active.
                  </span>
                </div>
              )}
            </div>

            {/* Scan Prompt */}
            <p className="text-[11px] text-base-muted font-condensed font-bold uppercase tracking-wider">
              Scan to update Progress • Timesheet • Status
            </p>
          </div>

          {/* Deep Link URL Box */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-condensed font-bold uppercase tracking-wider text-base-muted">
                Direct Deep Link URL
              </span>
              <a
                href={qrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base-accent hover:underline flex items-center gap-1 text-[11px]"
              >
                <span>Test Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-2 bg-base-surface border border-base-border rounded-xl p-2.5">
              <input
                type="text"
                readOnly
                value={qrUrl}
                className="w-full bg-transparent font-mono text-xs text-base-muted truncate focus:outline-hidden select-all"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="p-1.5 rounded-lg bg-base-surface2 hover:bg-base-surface3 text-base-text transition cursor-pointer shrink-0"
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Actions: Copy & Print */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={handleCopyLink}
              className="py-2.5 px-3 rounded-xl border border-base-border bg-base-surface hover:bg-base-surface2 text-base-text font-condensed font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span>Link Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-base-muted" />
                  <span>Copy Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="py-2.5 px-3 rounded-xl bg-base-accent hover:bg-base-accent/90 text-white font-condensed font-bold uppercase tracking-wider text-xs flex items-center justify-center gap-2 transition cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4" />
              <span>Print Badge</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
