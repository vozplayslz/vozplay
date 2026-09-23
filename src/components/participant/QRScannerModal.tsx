/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Leitor de QR Code para Smartphone / PWA
 * Permite ao participante escanear o QR Code da mesa ou do telão
 * para conectar instantaneamente sua comanda/mesa à sessão.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, QrCode, Flashlight, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (sessionOrTableCode: string) => void;
  currentCode?: string;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  currentCode = 'SLZ-704'
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const scanIntervalRef = useRef<number | null>(null);

  // Reproduzir som de bip positivo ao ler com sucesso
  const playScanBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(987.77, ctx.currentTime); // B5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.19);
    } catch {
      // Ignorar erros de áudio de fundo
    }
  };

  // Parser inteligente para links do VozPlay
  const extractCodeFromRaw = (raw: string): string => {
    try {
      if (raw.includes('s=') || raw.includes('table=') || raw.includes('mesa=')) {
        const urlObj = new URL(raw, 'https://vozplay.ai.slz.br');
        const s = urlObj.searchParams.get('s') || urlObj.searchParams.get('table') || urlObj.searchParams.get('mesa');
        if (s) return s.toUpperCase();
      }
    } catch {
      // Not a valid URL, treat as raw text
    }

    const cleaned = raw.trim().replace(/^.*[?&]s=/, '').split('&')[0];
    return cleaned.toUpperCase();
  };

  const handleDetectedValue = (raw: string) => {
    const parsed = extractCodeFromRaw(raw);
    if (!parsed) return;

    setIsScanning(false);
    setScannedCode(parsed);
    playScanBeep();

    if (navigator.vibrate) {
      try {
        navigator.vibrate(80);
      } catch {}
    }

    setTimeout(() => {
      onScanSuccess(parsed);
      onClose();
    }, 900);
  };

  // Iniciar câmera quando o modal abrir
  useEffect(() => {
    if (!isOpen) {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        setStream(null);
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      setScannedCode(null);
      setCameraError(null);
      setIsScanning(false);
      return;
    }

    let activeStream: MediaStream | null = null;

    const startCamera = async () => {
      setCameraError(null);
      setIsScanning(true);
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Câmera não suportada neste navegador.');
        }

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play().catch(() => {});
        }

        // Checar suporte à lanterna (torch)
        const track = mediaStream.getVideoTracks()[0];
        const capabilities = (track.getCapabilities?.() as any) || {};
        if (capabilities.torch) {
          setHasTorch(true);
        }

        // Iniciar detector de código de barras nativo se disponível
        if ('BarcodeDetector' in window) {
          const BarcodeDetectorClass = (window as any).BarcodeDetector;
          const barcodeDetector = new BarcodeDetectorClass({ formats: ['qr_code'] });

          scanIntervalRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const barcodes = await barcodeDetector.detect(videoRef.current);
              if (barcodes && barcodes.length > 0) {
                const detected = barcodes[0].rawValue;
                if (detected) {
                  clearInterval(scanIntervalRef.current!);
                  scanIntervalRef.current = null;
                  handleDetectedValue(detected);
                }
              }
            } catch {
              // Frame sem código legível
            }
          }, 250);
        }
      } catch (err: any) {
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Acesso à câmera foi recusado. Ative a permissão ou selecione sua mesa abaixo.'
            : 'Não foi possível acessar a câmera do dispositivo.'
        );
        setIsScanning(false);
      }
    };

    startCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  // Alternar lanterna
  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    try {
      const nextTorch = !torchOn;
      await (track as any).applyConstraints({
        advanced: [{ torch: nextTorch }]
      });
      setTorchOn(nextTorch);
    } catch {
      // Ignorar caso o dispositivo recuse
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDetectedValue(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-md rounded-3xl bg-[#0b0f1e] border border-white/10 p-5 sm:p-6 shadow-2xl relative overflow-hidden text-slate-100 flex flex-col max-h-[90vh]"
      >
        {/* Glow Effects */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-pink-600/15 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md shadow-purple-600/30">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-black text-white text-base sm:text-lg">
                Escanear QR Code
              </h3>
              <p className="text-[11px] text-slate-400">
                Aponte para a placa da sua mesa ou para o telão da TV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera Viewport or Fallback */}
        <div className="relative my-4 rounded-2xl overflow-hidden bg-black aspect-square max-h-72 border border-white/15 flex items-center justify-center">
          {scannedCode ? (
            <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 p-6 text-center z-30">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 flex items-center justify-center text-emerald-300">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-widest text-emerald-400 font-black block">
                  QR Code Reconhecido!
                </span>
                <h4 className="text-2xl font-black text-white mt-1">
                  Mesa / Sessão: {scannedCode}
                </h4>
              </div>
            </div>
          ) : cameraError ? (
            <div className="p-5 text-center flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-300 max-w-xs">{cameraError}</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold text-white flex items-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Alternar Câmera
                </button>
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* Futuristic Scanner HUD Overlay */}
              <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                {/* Target Frame Box */}
                <div className="w-48 h-48 sm:w-56 sm:h-56 relative rounded-2xl border-2 border-dashed border-purple-400/40">
                  {/* Corner brackets */}
                  <span className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-pink-400 rounded-tl-lg" />
                  <span className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-pink-400 rounded-tr-lg" />
                  <span className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-pink-400 rounded-bl-lg" />
                  <span className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-pink-400 rounded-br-lg" />

                  {/* Scanning Laser Line */}
                  <motion.div
                    animate={{ y: [0, 180, 0] }}
                    transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                    className="w-full h-0.5 bg-gradient-to-r from-transparent via-pink-400 to-transparent shadow-[0_0_12px_#ec4899]"
                  />
                </div>
                <span className="mt-3 text-[11px] font-bold text-purple-200 bg-black/60 px-3 py-1 rounded-full border border-white/10 backdrop-blur-sm">
                  Posicione o QR Code no quadrado
                </span>
              </div>

              {/* Controls on Top of Video */}
              <div className="absolute top-3 right-3 flex items-center gap-2 z-20">
                {hasTorch && (
                  <button
                    onClick={toggleTorch}
                    className={`p-2 rounded-xl transition backdrop-blur-md border ${
                      torchOn
                        ? 'bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/30'
                        : 'bg-black/60 text-white border-white/20 hover:bg-black/80'
                    }`}
                    title="Alternar lanterna"
                  >
                    <Flashlight className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
                  className="p-2 rounded-xl bg-black/60 text-white border border-white/20 hover:bg-black/80 transition backdrop-blur-md"
                  title="Trocar câmera"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        {/* 1-Tap Quick Table Selectors */}
        <div className="space-y-2 relative z-10">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span>Ou escolha sua mesa rapidamente:</span>
            <span className="text-purple-300 font-mono">Atual: {currentCode}</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {['SLZ-704', 'Mesa 01', 'Mesa 02', 'Mesa VIP'].map((table) => (
              <button
                key={table}
                type="button"
                onClick={() => handleDetectedValue(table)}
                className="px-2 py-2 rounded-xl bg-white/[0.04] hover:bg-purple-600/20 hover:border-purple-500/40 border border-white/[0.08] text-xs font-bold text-slate-200 transition text-center truncate active:scale-95"
              >
                {table}
              </button>
            ))}
          </div>
        </div>

        {/* Manual Code Input Form */}
        <form onSubmit={handleManualSubmit} className="mt-3 pt-3 border-t border-white/[0.08] flex gap-2 relative z-10">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder="Digite o código (ex: SLZ-704 ou Mesa 05)"
            className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={!manualInput.trim()}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-bold text-xs transition"
          >
            Conectar
          </button>
        </form>
      </motion.div>
    </div>
  );
};
