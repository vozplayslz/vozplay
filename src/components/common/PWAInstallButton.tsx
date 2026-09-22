/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { usePWAInstall } from '../../hooks/usePWAInstall.js';
import { Download, Share2, X } from 'lucide-react';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        id="btn-install-pwa"
        onClick={install}
        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-purple-600/25 transition active:scale-95"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Instalar App</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          id="btn-install-ios"
          onClick={() => setShowIOSGuide(true)}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] px-3 py-1.5 text-xs font-bold text-slate-200 transition active:scale-95"
        >
          <Share2 className="w-3.5 h-3.5 text-purple-400" />
          <span>Instalar no iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
            <div className="w-full max-w-sm rounded-3xl bg-[#0d1222] border border-white/10 p-6 shadow-2xl text-slate-100 ring-1 ring-white/10">
              <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                <h3 className="text-base font-display font-black text-white">Instalar VozPlay no iPhone</h3>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="mt-4 space-y-3.5 text-xs text-slate-300">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-black flex items-center justify-center text-xs border border-purple-500/30">1</span>
                  <p>No navegador Safari, toque no botão de <strong>Compartilhar</strong> (ícone com quadrado e seta para cima).</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-black flex items-center justify-center text-xs border border-purple-500/30">2</span>
                  <p>Role a lista para baixo e selecione <strong>Adicionar à Tela de Início</strong>.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-600/30 text-purple-300 font-black flex items-center justify-center text-xs border border-purple-500/30">3</span>
                  <p>Toque em <strong>Adicionar</strong> para fixar o VozPlay como aplicativo nativo em tela cheia.</p>
                </div>
              </div>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-6 w-full rounded-2xl bg-gradient-to-r from-purple-600 to-pink-600 py-3 text-xs font-black text-white hover:from-purple-500 hover:to-pink-500 transition shadow-lg shadow-purple-600/25 active:scale-95"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
