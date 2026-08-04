import React, { useState, useEffect, useRef } from 'react';
import { Smartphone, Download, X } from 'lucide-react';

export default function InstallPrompt() {
  const [showAndroidBanner, setShowAndroidBanner] = useState(false);
  const [showIosBanner, setShowIosBanner] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    // Check if user already dismissed prompt
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed === 'true') {
      return;
    }

    // Check if already in standalone mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      return;
    }

    // Android / Chrome beforeinstallprompt event handler
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setShowAndroidBanner(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // iOS Detection
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos && !isStandalone) {
      setShowIosBanner(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPromptRef.current) {
      deferredPromptRef.current.prompt();
      const choiceResult = await deferredPromptRef.current.userChoice;
      if (choiceResult?.outcome === 'accepted') {
        setShowAndroidBanner(false);
      }
      deferredPromptRef.current = null;
    }
  };

  const handleDismiss = () => {
    localStorage.getItem('pwa_install_dismissed') || localStorage.setItem('pwa_install_dismissed', 'true');
    setShowAndroidBanner(false);
    setShowIosBanner(false);
  };

  if (!showAndroidBanner && !showIosBanner) {
    return null;
  }

  return (
    <div className="md:hidden fixed bottom-14 left-0 right-0 z-40 px-3 pb-1 animate-in slide-in-from-bottom duration-300">
      <div className="bg-base-accent text-white rounded-t-xl rounded-b-lg shadow-2xl p-3.5 flex items-center justify-between gap-3 border border-white/20">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 bg-white/20 rounded-lg shrink-0">
            <Smartphone className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h4 className="font-condensed font-bold text-xs uppercase tracking-wide leading-tight">
              Install AB Console ke Homescreen
            </h4>
            <p className="text-[11px] text-white/90 leading-tight truncate">
              {showIosBanner
                ? "Tap ⬆ lalu 'Add to Home Screen' untuk install"
                : "Akses cepat &amp; tampilan full-screen di HP"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {showAndroidBanner && (
            <button
              onClick={handleInstallClick}
              className="px-3 py-1.5 bg-white text-base-accent rounded-lg font-condensed font-bold text-xs uppercase tracking-wider hover:bg-white/90 transition-all cursor-pointer flex items-center gap-1 shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install</span>
            </button>
          )}
          <button
            onClick={handleDismiss}
            className="px-2 py-1.5 bg-black/20 hover:bg-black/30 text-white/80 hover:text-white rounded-lg font-condensed font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            {showAndroidBanner ? 'Nanti' : <X className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
