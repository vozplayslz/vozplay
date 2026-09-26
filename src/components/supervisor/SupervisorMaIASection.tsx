/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - SEÇÃO GERENCIAL DA MAIA (SUPERVISOR)
 * Controle de modelos, provedores, perfis de custo, identidade vocal, limites e testes.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Bot,
  Volume2,
  DollarSign,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Sliders,
  ShieldAlert,
  Radio,
  Tv
} from 'lucide-react';
import { MaIAConfig, MaIACostTier, MaIAUsageMetrics } from '../../types.js';
import { apiFetch as fetch } from '../../utils/apiClient.js';

interface SupervisorMaIASectionProps {
  establishmentId: string;
}

export const SupervisorMaIASection: React.FC<SupervisorMaIASectionProps> = ({ establishmentId }) => {
  const [config, setConfig] = useState<MaIAConfig | null>(null);
  const [metrics, setMetrics] = useState<MaIAUsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testSpeechText, setTestSpeechText] = useState('João, chegou a sua vez! Prepare-se para cantar Evidências no palco do VozPlay.');
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    loadMaIAData();
  }, [establishmentId]);

  const loadMaIAData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/maia/config');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setConfig(json.data.config);
          setMetrics(json.data.metrics);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados da MaIA:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCostTierChange = (tier: MaIACostTier) => {
    if (!config) return;
    setConfig({
      ...config,
      cost_tier: tier
    });
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    try {
      setSaving(true);
      const res = await fetch('/api/v1/maia/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        await loadMaIAData();
      }
    } catch (err) {
      console.error('Erro ao salvar configuração da MaIA:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestSpeech = async (sendToTv = false) => {
    try {
      setIsTestingSpeech(true);
      setTestStatus(sendToTv ? 'Transmitindo para a TV...' : 'Sintetizando áudio da MaIA...');
      const res = await fetch('/api/v1/maia/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: testSpeechText, sendToTv })
      });
      const json = await res.json();
      if (json.success && json.data) {
        if (json.data.audioBase64) {
          const audio = new Audio(`data:${json.data.mimeType};base64,${json.data.audioBase64}`);
          await audio.play().catch(e => console.warn('Autoplay bloqueado pelo navegador:', e));
          setTestStatus('Áudio reproduzido com sucesso!');
        } else {
          setTestStatus('Modo contingência: Texto exibido no telão com sucesso.');
        }
      } else {
        setTestStatus('Falha ao sintetizar áudio.');
      }
    } catch (err) {
      setTestStatus('Erro de conexão com o sintetizador vocal.');
    } finally {
      setIsTestingSpeech(false);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  const handleTestTvCall = async () => {
    try {
      setIsTestingSpeech(true);
      setTestStatus('Disparando chamada teste para o telão...');
      const res = await fetch('/api/v1/maia/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        setTestStatus('Chamada teste exibida no telão!');
      }
    } catch (err) {
      setTestStatus('Erro ao enviar chamada teste.');
    } finally {
      setIsTestingSpeech(false);
      setTimeout(() => setTestStatus(null), 4000);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Activity className="w-6 h-6 animate-spin mr-3 text-purple-400" />
        <span>Carregando módulo MaIA...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com Status Geral */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#0e1322] to-slate-900 border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-black text-white">MaIA — Mestre de Cerimônias e Voz Nativa</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${config.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                {config.enabled ? 'ATIVA' : 'DESATIVADA'}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Arquitetura de inteligência vocal, roteador de modelos com seleção por custo-benefício e anúncios no telão.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setConfig({ ...config, enabled: !config.enabled })}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${config.enabled ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {config.enabled ? 'Pausar MaIA' : 'Ativar MaIA'}
          </button>
          <button
            onClick={handleSaveConfig}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition flex items-center gap-2"
          >
            {saving ? <Activity className="w-4 h-4 animate-spin" /> : saveSuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Sliders className="w-4 h-4" />}
            <span>{saveSuccess ? 'Configuração Salva!' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* Grid de Configurações */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna 1: Provedor, Gateway & Perfil de Custo */}
        <div className="space-y-6">
          {/* Card Provedor & Gateway */}
          <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Provedor & Gateway de IA
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Provedor Ativo</label>
                <select
                  value={config.active_provider}
                  onChange={(e) => setConfig({ ...config, active_provider: e.target.value as any })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="gemini">Google Gemini Nativo (@google/genai)</option>
                  <option value="9router">9router Gateway (Corporativo)</option>
                  <option value="custom_gateway">Gateway Customizado (OpenAI/Proxy)</option>
                </select>
              </div>

              {config.active_provider !== 'gemini' && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1.5 font-medium">URL do Gateway</label>
                  <input
                    type="text"
                    value={config.gateway_url || ''}
                    onChange={(e) => setConfig({ ...config, gateway_url: e.target.value })}
                    placeholder="https://api.9router.com"
                    className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Fallback automático para Gemini se o gateway não responder.</p>
                </div>
              )}
            </div>
          </div>

          {/* Card Perfil de Custo-Benefício */}
          <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Perfil de Custo-Benefício
            </h3>

            <div className="space-y-2">
              {(['ECONOMICO', 'BALANCEADO', 'ALTA_CAPACIDADE', 'VOZ', 'PERSONALIZADO'] as MaIACostTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => handleCostTierChange(tier)}
                  className={`w-full p-3 rounded-xl border text-left transition flex items-center justify-between ${config.cost_tier === tier ? 'bg-purple-600/15 border-purple-500/40 text-purple-200 font-bold' : 'bg-[#090d16] border-white/5 text-slate-400 hover:border-white/10'}`}
                >
                  <div className="text-xs">
                    <div className="capitalize">{tier.toLowerCase().replace('_', ' ')}</div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      {tier === 'ECONOMICO' && 'Flash Lite TTS + Flash 3.8 (Menor custo)'}
                      {tier === 'BALANCEADO' && 'Flash TTS + Flash 3.8 (Melhor equilíbrio)'}
                      {tier === 'ALTA_CAPACIDADE' && 'Gemini 3.1 Pro + Flash TTS (Raciocínio avançado)'}
                      {tier === 'VOZ' && 'Gemini 3.8 Live + Flash TTS (Baixa latência vocal)'}
                      {tier === 'PERSONALIZADO' && 'Configuração granular manual por tarefa'}
                    </div>
                  </div>
                  {config.cost_tier === tier && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coluna 2: Identidade Vocal & Modelos por Tarefa */}
        <div className="space-y-6">
          {/* Card Identidade Vocal */}
          <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-pink-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Identidade da Voz (Humanizada)
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Voz Ativa</label>
                <select
                  value={config.voice.voice_id}
                  onChange={(e) => setConfig({
                    ...config,
                    voice: { ...config.voice, voice_id: e.target.value }
                  })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="Aoede">Aoede (Feminina, calorosa, brasileira)</option>
                  <option value="Kore">Kore (Feminina, suave, clara)</option>
                  <option value="Puck">Puck (Masculina, expressiva, jovem)</option>
                  <option value="Fenrir">Fenrir (Masculina, encorpada)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Estilo de Apresentação</label>
                <select
                  value={config.voice.style}
                  onChange={(e) => setConfig({
                    ...config,
                    voice: { ...config.voice, style: e.target.value }
                  })}
                  className="w-full px-3 py-2 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="acolhedora_profissional">Acolhedora & Profissional</option>
                  <option value="animada">Animada & Festiva (Mestre de Cerimônias)</option>
                  <option value="cerimoniosa">Cerimoniosa & Elegante</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Idioma & Região</label>
                <input
                  type="text"
                  disabled
                  value="Português Brasileiro (pt-BR)"
                  className="w-full px-3 py-2 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Card Modelos Mapeados por Tarefa */}
          <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Roteamento de Modelos
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Conversação (Chat):</span>
                <span className="font-mono text-purple-300 font-semibold">{config.models.CHAT}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Voz ao Vivo (Live):</span>
                <span className="font-mono text-pink-300 font-semibold">{config.models.LIVE_VOICE}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Síntese de Fala (TTS):</span>
                <span className="font-mono text-amber-300 font-semibold">{config.models.TTS}</span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Raciocínio Complexo:</span>
                <span className="font-mono text-blue-300 font-semibold">{config.models.REASONING}</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Transcrição:</span>
                <span className="font-mono text-teal-300 font-semibold">{config.models.TRANSCRIPTION}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Coluna 3: Testes de Áudio, Automações de Fila & Métricas */}
        <div className="space-y-6">
          {/* Card Automações da Fila */}
          <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
              <Radio className="w-4 h-4" /> Anúncios Vocais Automáticos
            </h3>

            <div className="space-y-3 text-xs">
              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.announce_queue_calls}
                  onChange={(e) => setConfig({ ...config, announce_queue_calls: e.target.checked })}
                  className="rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#090d16]"
                />
                <span>Chamar participante pelo nome ao convocar para o palco</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.announce_absences}
                  onChange={(e) => setConfig({ ...config, announce_absences: e.target.checked })}
                  className="rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#090d16]"
                />
                <span>Anunciar ausência e perda da vez (1ª e 2ª chamadas)</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.announce_duets}
                  onChange={(e) => setConfig({ ...config, announce_duets: e.target.checked })}
                  className="rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#090d16]"
                />
                <span>Chamar ambos os cantores quando for dueto musical</span>
              </label>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.tv_audio_enabled}
                  onChange={(e) => setConfig({ ...config, tv_audio_enabled: e.target.checked })}
                  className="rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#090d16]"
                />
                <span>Transmitir voz da MaIA diretamente para a TV / Telão</span>
              </label>
            </div>
          </div>

          {/* Card Teste de Voz ao Vivo */}
          <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-3">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Play className="w-4 h-4" /> Testar Voz da MaIA ao Vivo
            </h3>

            <textarea
              rows={2}
              value={testSpeechText}
              onChange={(e) => setTestSpeechText(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTestSpeech(false)}
                disabled={isTestingSpeech}
                className="px-3 py-2 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-bold text-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Ouvir no Painel</span>
              </button>
              <button
                onClick={() => handleTestSpeech(true)}
                disabled={isTestingSpeech}
                className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>Falar no Telão</span>
              </button>
            </div>

            <button
              onClick={handleTestTvCall}
              disabled={isTestingSpeech}
              className="w-full py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Simular Chamada da Fila na TV</span>
            </button>

            {testStatus && (
              <div className="p-2 rounded-lg bg-black/40 text-[11px] text-purple-300 text-center animate-in fade-in">
                {testStatus}
              </div>
            )}
          </div>

          {/* Card Métricas & Consumo */}
          {metrics && (
            <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Consumo & Métricas do Estabelecimento
              </h3>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-slate-400">Total de Chamadas</div>
                  <div className="text-base font-black text-white">{metrics.totalCalls}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-slate-400">Custo Estimado</div>
                  <div className="text-base font-black text-emerald-400">${metrics.estimatedCostUsd.toFixed(4)}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-slate-400">Latência Média</div>
                  <div className="text-base font-black text-purple-400">{metrics.averageLatencyMs}ms</div>
                </div>
                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5">
                  <div className="text-[10px] text-slate-400">Fallbacks Seguros</div>
                  <div className="text-base font-black text-amber-400">{metrics.fallbackCalls}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
