/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - SEÇÃO GERENCIAL DA MAIA (SUPERVISOR)
 * Painel completo de orquestração de IA: Model Router, Semáforo de Quotas, Credenciais (Meu Projeto Gemini / 9router),
 * Cadeia de Fallback Resiliente, Identidade Vocal e Auditoria.
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Volume2,
  DollarSign,
  Cpu,
  Layers,
  Activity,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Play,
  Sliders,
  Radio,
  Tv,
  Key,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  History,
  Zap,
  Server
} from 'lucide-react';
import {
  MaIAConfig,
  MaIACostTier,
  MaIAUsageMetrics,
  MaIADashboardDTO,
  AICredential,
  ValidationResult,
  AIAuditEvent,
  MaIAProviderType
} from '../../types.js';
import { apiFetch as fetch } from '../../utils/apiClient.js';

interface SupervisorMaIASectionProps {
  establishmentId: string;
}

type TabType = 'overview' | 'providers' | 'fallback' | 'tiers' | 'voice' | 'audit';

export const SupervisorMaIASection: React.FC<SupervisorMaIASectionProps> = ({ establishmentId }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [dashboard, setDashboard] = useState<MaIADashboardDTO | null>(null);
  const [config, setConfig] = useState<MaIAConfig | null>(null);
  const [metrics, setMetrics] = useState<MaIAUsageMetrics | null>(null);
  const [credentials, setCredentials] = useState<AICredential[]>([]);
  const [auditEvents, setAuditEvents] = useState<AIAuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form states para "Meu projeto Gemini"
  const [customerGeminiKey, setCustomerGeminiKey] = useState('');
  const [customerGeminiProject, setCustomerGeminiProject] = useState('');
  const [customerGeminiName, setCustomerGeminiName] = useState('Meu projeto Gemini');
  const [testingGemini, setTestingGemini] = useState(false);
  const [geminiValidationResult, setGeminiValidationResult] = useState<ValidationResult | null>(null);

  // Form states para 9router
  const [routerUrl, setRouterUrl] = useState('');
  const [routerKey, setRouterKey] = useState('');
  const [testingRouter, setTestingRouter] = useState(false);
  const [routerValidationResult, setRouterValidationResult] = useState<ValidationResult | null>(null);

  // Testes de áudio e telão
  const [testSpeechText, setTestSpeechText] = useState('Bora, João! Chegou a sua vez! O palco é seu pra cantar Evidências! 🎤');
  const [isTestingSpeech, setIsTestingSpeech] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    loadAllData();
  }, [establishmentId]);

  const loadAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadDashboard(),
        loadConfigAndMetrics(),
        loadCredentials(),
        loadAudit()
      ]);
    } catch (err) {
      console.error('Erro ao carregar dados da MaIA:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await fetch('/api/v1/maia/dashboard');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setDashboard(json.data);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar dashboard de IA:', err);
    }
  };

  const loadConfigAndMetrics = async () => {
    try {
      const res = await fetch('/api/v1/maia/config');
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          setConfig(json.data.config);
          setMetrics(json.data.metrics);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar configuração de MaIA:', err);
    }
  };

  const loadCredentials = async () => {
    try {
      const res = await fetch('/api/v1/maia/credentials');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setCredentials(json.data);
          const cust = json.data.find((c: AICredential) => c.provider === 'gemini_customer');
          if (cust) {
            setCustomerGeminiProject(cust.project_id || '');
            setCustomerGeminiName(cust.display_name || 'Meu projeto Gemini');
          }
          const router = json.data.find((c: AICredential) => c.provider === '9router');
          if (router) {
            setRouterUrl(router.project_id || '');
          }
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar credenciais:', err);
    }
  };

  const loadAudit = async () => {
    try {
      const res = await fetch('/api/v1/maia/audit');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setAuditEvents(json.data);
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar eventos de auditoria:', err);
    }
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
        await loadConfigAndMetrics();
        await loadDashboard();
      }
    } catch (err) {
      console.error('Erro ao salvar configuração:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTestGeminiConnection = async () => {
    try {
      setTestingGemini(true);
      setGeminiValidationResult(null);

      const res = await fetch('/api/v1/maia/credentials/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gemini_customer',
          apiKey: customerGeminiKey,
          projectId: customerGeminiProject
        })
      });

      const json = await res.json();
      if (json.success && json.data) {
        setGeminiValidationResult(json.data);
      }
    } catch (err) {
      console.error('Erro ao testar conexão com Gemini:', err);
    } finally {
      setTestingGemini(false);
    }
  };

  const handleSaveCustomerGemini = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/v1/maia/credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'gemini_customer',
          apiKey: customerGeminiKey,
          projectId: customerGeminiProject,
          displayName: customerGeminiName,
          allowedTasks: ['CHAT', 'LIVE_VOICE', 'REASONING', 'TTS', 'TRANSCRIPTION', 'MUSIC_ASSISTANCE'],
          priority: 2
        })
      });

      if (res.ok) {
        setCustomerGeminiKey('');
        await loadCredentials();
        await loadDashboard();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Erro ao salvar Gemini do Cliente:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleActivateProvider = async (provider: MaIAProviderType) => {
    try {
      setSaving(true);
      const res = await fetch('/api/v1/maia/credentials/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider })
      });

      if (res.ok) {
        await loadAllData();
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Erro ao ativar provedor:', err);
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

  const handleResetRateLimit = async () => {
    try {
      await fetch('/api/v1/maia/quota/reset-rate-limit', { method: 'POST' });
      await loadDashboard();
    } catch (err) {
      console.error('Erro ao resetar status de rate limit:', err);
    }
  };

  if (loading || !config) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-400">
        <Activity className="w-6 h-6 animate-spin mr-3 text-purple-400" />
        <span>Carregando orquestrador de IA da MaIA...</span>
      </div>
    );
  }

  const semaphore = dashboard?.quota_semaphore;
  const semaphoreColor =
    semaphore?.status === 'EXHAUSTED'
      ? 'bg-rose-500'
      : semaphore?.status === 'CRITICAL'
      ? 'bg-amber-500'
      : semaphore?.status === 'WARNING'
      ? 'bg-yellow-400'
      : 'bg-emerald-400';

  const semaphoreText =
    semaphore?.status === 'EXHAUSTED'
      ? 'ESGOTADO / CONTINGÊNCIA'
      : semaphore?.status === 'CRITICAL'
      ? 'CRÍTICO (> 85%)'
      : semaphore?.status === 'WARNING'
      ? 'ATENÇÃO (> 70%)'
      : 'NORMAL (OPERACIONAL)';

  return (
    <div className="space-y-6">
      {/* Header com Status Geral e Semáforo de Quota */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-[#0e1322] to-slate-900 border border-purple-500/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20 text-white shrink-0">
            <Sparkles className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-black text-white">MaIA — AI Orchestration Core</h2>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${config.enabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}>
                {config.enabled ? 'ATIVA' : 'PAUSADA'}
              </span>
              <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-white/5 border border-white/10 text-slate-300">
                <span className={`w-2 h-2 rounded-full ${semaphoreColor} animate-pulse`} />
                <span>{semaphoreText}</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Roteamento de modelos, cofre de credenciais seguras, quotas em tempo real e fallback resiliente.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const newEnabled = !config.enabled;
              setConfig({ ...config, enabled: newEnabled });
              fetch('/api/v1/maia/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ enabled: newEnabled })
              });
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${config.enabled ? 'bg-white/10 hover:bg-white/15 text-slate-200' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
          >
            {config.enabled ? 'Pausar MaIA' : 'Ativar MaIA'}
          </button>
          <button
            onClick={loadAllData}
            title="Atualizar dados"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs de Navegação */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-white/10 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${activeTab === 'overview' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Activity className="w-4 h-4" />
          <span>Visão Geral & Semáforo</span>
        </button>
        <button
          onClick={() => setActiveTab('providers')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${activeTab === 'providers' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Key className="w-4 h-4" />
          <span>Provedores & Credenciais</span>
        </button>
        <button
          onClick={() => setActiveTab('fallback')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${activeTab === 'fallback' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Cadeia de Fallback</span>
        </button>
        <button
          onClick={() => setActiveTab('tiers')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${activeTab === 'tiers' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Perfis de Custo & Modelos</span>
        </button>
        <button
          onClick={() => setActiveTab('voice')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${activeTab === 'voice' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <Volume2 className="w-4 h-4" />
          <span>Identidade Vocal & Testes</span>
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2.5 rounded-xl transition flex items-center gap-2 shrink-0 ${activeTab === 'audit' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
        >
          <History className="w-4 h-4" />
          <span>Auditoria & Eventos</span>
        </button>
      </div>

      {/* CONTEÚDO DAS ABAS */}

      {/* ABA 1: VISÃO GERAL & SEMÁFORO DE QUOTA */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Card do Semáforo em Destaque */}
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1">
                  Saúde Operacional de Quotas (Tempo Real)
                </span>
                <div className="flex items-center gap-3">
                  <div className={`w-4 h-4 rounded-full ${semaphoreColor} shadow-lg`} />
                  <span className="text-xl font-black text-white">{semaphoreText}</span>
                  <span className="text-xs font-mono text-slate-400">
                    ({semaphore?.percentage?.toFixed(1) || 0}% de utilização pico)
                  </span>
                </div>
              </div>

              {semaphore?.status === 'EXHAUSTED' && (
                <button
                  onClick={handleResetRateLimit}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-rose-600/30"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Resetar Estado de Rate Limit</span>
                </button>
              )}
            </div>

            {semaphore?.alert_message && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{semaphore.alert_message}</span>
              </div>
            )}

            {/* Barras de Quotas Detalhadas */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">RPM (Requisições / min)</span>
                  <span className="font-mono text-white font-bold">
                    {dashboard?.quotas?.rpm?.used || 0} / {dashboard?.quotas?.rpm?.limit || 60}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${semaphoreColor}`}
                    style={{ width: `${Math.min(100, dashboard?.quotas?.rpm?.percentage || 0)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block text-right font-mono">
                  Fonte: {dashboard?.quotas?.rpm?.source || 'ESTIMATED'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">RPD (Requisições diárias)</span>
                  <span className="font-mono text-white font-bold">
                    {dashboard?.quotas?.rpd?.used || 0} / {dashboard?.quotas?.rpd?.limit || 1500}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full ${semaphoreColor}`}
                    style={{ width: `${Math.min(100, dashboard?.quotas?.rpd?.percentage || 0)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block text-right font-mono">
                  Fonte: {dashboard?.quotas?.rpd?.source || 'ESTIMATED'}
                </span>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-white/5 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Live Áudio Simultâneo</span>
                  <span className="font-mono text-white font-bold">
                    {dashboard?.quotas?.concurrency?.used || 0} / {dashboard?.quotas?.concurrency?.limit || 5}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.min(100, dashboard?.quotas?.concurrency?.percentage || 0)}%` }}
                  />
                </div>
                <span className="text-[10px] text-slate-500 block text-right font-mono">
                  Status: Normal
                </span>
              </div>
            </div>
          </div>

          {/* Cards de Métricas e Custos */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Provedor Ativo
              </span>
              <div className="text-base font-black text-white truncate">
                {dashboard?.active_provider?.display_name || 'Gemini Enlace'}
              </div>
              <div className="text-xs text-purple-400 font-mono mt-1">
                Projeto: {dashboard?.active_provider?.project_id || 'enlace-ai-platform'}
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Chamadas Hoje
              </span>
              <div className="text-2xl font-black text-white">
                {dashboard?.usage?.requests_today || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Latência média: <span className="text-purple-300 font-mono">{dashboard?.usage?.average_latency_ms || 0}ms</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Custo Estimado Hoje
              </span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                ${dashboard?.costs?.estimated_usd_today?.toFixed(4) || '0.0000'}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Faturamento: <span className="text-slate-200 font-bold">{dashboard?.costs?.billing_owner || 'Enlace'}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#0e1322] border border-white/[0.08]">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                Fallbacks Acionados
              </span>
              <div className="text-2xl font-black text-amber-400">
                {dashboard?.usage?.fallbacks_today || 0}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                Resiliência: <span className="text-emerald-400 font-bold">100% Protegido</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: PROVEDORES & CREDENCIAIS */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          {/* Card 1: Gemini Enlace (Padrão) */}
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center font-black">
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">Gemini Enlace (Padrão da Plataforma)</h3>
                    {config.active_provider === 'gemini_enlace' || config.active_provider === 'gemini' ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ATIVO NO MOMENTO
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-slate-400">
                    Provedor nativo gerenciado pela Enlace. Quota compartilhada pela plataforma sem necessidade de configuração do estabelecimento.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleActivateProvider('gemini_enlace')}
                  disabled={config.active_provider === 'gemini_enlace' || config.active_provider === 'gemini'}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {config.active_provider === 'gemini_enlace' || config.active_provider === 'gemini' ? 'Já Ativo' : 'Ativar como Principal'}
                </button>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-black/30 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-slate-400">Chave de Acesso:</span>
              <span className="font-mono text-slate-300">Gerenciada com segurança pelo cofre da plataforma Enlace</span>
            </div>
          </div>

          {/* Card 2: Meu Projeto Gemini (Google Cloud do Estabelecimento) */}
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-purple-500/30 space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">
                  <Key className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-white">Meu projeto Gemini (Google Cloud Próprio)</h3>
                    {config.active_provider === 'gemini_customer' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        ATIVO NO MOMENTO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">
                    Conecte o projeto Google Cloud do próprio bar/lounge para utilizar sua própria cota e faturamento direto com o Google.
                  </p>
                </div>
              </div>

              {config.active_provider !== 'gemini_customer' && (
                <button
                  onClick={() => handleActivateProvider('gemini_customer')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition shadow-lg shadow-purple-600/20"
                >
                  Ativar Meu Projeto
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Nome Amigável</label>
                <input
                  type="text"
                  value={customerGeminiName}
                  onChange={(e) => setCustomerGeminiName(e.target.value)}
                  placeholder="Ex: Karaokê Music SLZ - Gemini"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">ID do Projeto Google Cloud</label>
                <input
                  type="text"
                  value={customerGeminiProject}
                  onChange={(e) => setCustomerGeminiProject(e.target.value)}
                  placeholder="Ex: karaoke-music-slz-prod"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">
                  Chave de API do Projeto Google (API Key)
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={customerGeminiKey}
                    onChange={(e) => setCustomerGeminiKey(e.target.value)}
                    placeholder="Cole aqui a nova chave de API (AIzaSy...)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                  />
                  <button
                    onClick={handleTestGeminiConnection}
                    disabled={testingGemini}
                    className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white transition flex items-center gap-2 shrink-0 border border-white/10"
                  >
                    {testingGemini ? <Activity className="w-4 h-4 animate-spin text-purple-400" /> : <Play className="w-4 h-4 text-purple-400" />}
                    <span>Testar conexão</span>
                  </button>
                  <button
                    onClick={handleSaveCustomerGemini}
                    disabled={saving}
                    className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition flex items-center gap-2 shrink-0 shadow-lg shadow-purple-600/30"
                  >
                    <span>Salvar Credencial</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  A chave é criptografada com AES-256-GCM e nunca será exibida em texto puro após ser salva.
                </p>
              </div>
            </div>

            {/* Resultado do Teste de Conexão com Checklist em 6 etapas */}
            {geminiValidationResult && (
              <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {geminiValidationResult.valid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                    )}
                    <span className="text-xs font-bold text-white">
                      {geminiValidationResult.valid
                        ? 'Conexão validada com sucesso! Provedor pronto para uso.'
                        : 'Falha na validação da credencial.'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Projeto: {geminiValidationResult.projectId}
                  </span>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/5">
                  {geminiValidationResult.checks?.map((chk, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs py-1">
                      <div className="flex items-center gap-2">
                        {chk.passed ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        )}
                        <span className="text-slate-300 font-medium">{chk.name}</span>
                      </div>
                      <span className="text-slate-400 text-[11px]">{chk.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card 3: 9router Gateway (Corporativo / Opcional) */}
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">9router Gateway (Corporativo)</h3>
                <p className="text-xs text-slate-400">
                  Roteador corporativo intermediário para agregação de múltiplos modelos e otimização avançada de custos.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">URL do Endpoint 9router</label>
                <input
                  type="text"
                  value={routerUrl}
                  onChange={(e) => setRouterUrl(e.target.value)}
                  placeholder="https://api.9router.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 block mb-1.5 font-medium">Token de Acesso / API Key</label>
                <input
                  type="password"
                  value={routerKey}
                  onChange={(e) => setRouterKey(e.target.value)}
                  placeholder="Cole aqui o token do gateway"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 3: CADEIA DE FALLBACK & RESILIÊNCIA */}
      {activeTab === 'fallback' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Cadeia de Fallback Resiliente</h3>
                <p className="text-xs text-slate-400">
                  Em caso de cota esgotada (429), lentidão ou instabilidade de rede, a MaIA transfere a chamada de forma transparente.
                </p>
              </div>
            </div>

            {/* Diagrama da Cadeia */}
            <div className="p-5 rounded-xl bg-black/40 border border-white/5 space-y-4">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400 block">
                Ordem Automática de Execução
              </span>

              <div className="flex flex-col md:flex-row items-center gap-3 text-xs">
                <div className="flex-1 p-3.5 rounded-xl bg-purple-600/20 border border-purple-500/40 text-center w-full">
                  <div className="text-[10px] text-purple-300 font-bold uppercase">1º Prioritário</div>
                  <div className="text-white font-black mt-0.5">
                    {dashboard?.active_provider?.display_name || 'Gemini Enlace'}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Execução padrão</div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block shrink-0" />

                <div className="flex-1 p-3.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-center w-full">
                  <div className="text-[10px] text-blue-300 font-bold uppercase">2º Fallback</div>
                  <div className="text-white font-black mt-0.5">Gemini Enlace (Plataforma)</div>
                  <div className="text-[10px] text-slate-400 mt-1">Acionado em 429 ou erro</div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block shrink-0" />

                <div className="flex-1 p-3.5 rounded-xl bg-teal-600/20 border border-teal-500/40 text-center w-full">
                  <div className="text-[10px] text-teal-300 font-bold uppercase">3º Redundância</div>
                  <div className="text-white font-black mt-0.5">9router Gateway</div>
                  <div className="text-[10px] text-slate-400 mt-1">Gateway alternativo</div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-500 hidden md:block shrink-0" />

                <div className="flex-1 p-3.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-center w-full">
                  <div className="text-[10px] text-emerald-300 font-bold uppercase">Garantia Absoluta</div>
                  <div className="text-white font-black mt-0.5">Contingência Local</div>
                  <div className="text-[10px] text-slate-400 mt-1">A festa nunca para</div>
                </div>
              </div>
            </div>

            {/* Último Fallback Registrado */}
            {dashboard?.fallback_policy?.last_fallback ? (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <span className="font-bold">Último Fallback Registrado:</span> de{' '}
                  <span className="font-mono font-bold">{dashboard.fallback_policy.last_fallback.provider_from}</span> para{' '}
                  <span className="font-mono font-bold">{dashboard.fallback_policy.last_fallback.provider_to}</span> (Motivo:{' '}
                  {dashboard.fallback_policy.last_fallback.reason}) às{' '}
                  {new Date(dashboard.fallback_policy.last_fallback.timestamp).toLocaleTimeString('pt-BR')}.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Nenhuma falha ou necessidade de chaveamento emergencial recente. Provedor primário operando perfeitamente.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 4: PERFIS DE CUSTO & MODELOS */}
      {activeTab === 'tiers' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
              <DollarSign className="w-4 h-4" /> Seleção de Perfil de Custo
            </h3>

            <div className="space-y-2">
              {(['ECONOMICO', 'BALANCEADO', 'ALTA_CAPACIDADE', 'VOZ', 'PERSONALIZADO'] as MaIACostTier[]).map((tier) => (
                <button
                  key={tier}
                  onClick={() => {
                    const updated = { ...config, cost_tier: tier };
                    setConfig(updated);
                  }}
                  className={`w-full p-3.5 rounded-xl border text-left transition flex items-center justify-between ${config.cost_tier === tier ? 'bg-purple-600/15 border-purple-500/40 text-purple-200 font-bold' : 'bg-[#090d16] border-white/5 text-slate-400 hover:border-white/10'}`}
                >
                  <div className="text-xs">
                    <div className="capitalize">{tier.toLowerCase().replace('_', ' ')}</div>
                    <div className="text-[10px] text-slate-500 font-normal mt-0.5">
                      {tier === 'ECONOMICO' && 'Flash Lite TTS + Flash 3.8 (Menor custo por requisição)'}
                      {tier === 'BALANCEADO' && 'Flash TTS + Flash 3.8 (Melhor equilíbrio geral)'}
                      {tier === 'ALTA_CAPACIDADE' && 'Gemini 3.1 Pro + Flash TTS (Raciocínio avançado)'}
                      {tier === 'VOZ' && 'Gemini 3.8 Live + Flash TTS (Baixa latência vocal)'}
                      {tier === 'PERSONALIZADO' && 'Mapeamento granular manual por capability'}
                    </div>
                  </div>
                  {config.cost_tier === tier && <CheckCircle2 className="w-4 h-4 text-purple-400 shrink-0" />}
                </button>
              ))}
            </div>

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
            >
              {saving ? <Activity className="w-4 h-4 animate-spin" /> : <Sliders className="w-4 h-4" />}
              <span>{saveSuccess ? 'Configuração Salva!' : 'Salvar Perfil de Custo'}</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-blue-400 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Mapeamento de Modelos por Capability
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Conversação (CHAT):</span>
                <span className="font-mono text-purple-300 font-semibold">{config.models.CHAT}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Voz ao Vivo (LIVE_VOICE):</span>
                <span className="font-mono text-pink-300 font-semibold">{config.models.LIVE_VOICE}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Síntese Vocal (TTS):</span>
                <span className="font-mono text-amber-300 font-semibold">{config.models.TTS}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Raciocínio (REASONING):</span>
                <span className="font-mono text-blue-300 font-semibold">{config.models.REASONING}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-slate-400">Transcrição de Áudio:</span>
                <span className="font-mono text-teal-300 font-semibold">{config.models.TRANSCRIPTION}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-slate-400">Curadoria Musical:</span>
                <span className="font-mono text-purple-300 font-semibold">{config.models.MUSIC_ASSISTANCE}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ABA 5: IDENTIDADE VOCAL & TESTES */}
      {activeTab === 'voice' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-pink-400 flex items-center gap-2">
              <Volume2 className="w-4 h-4" /> Configuração da Voz e Estilo
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="Aoede">Aoede (Feminina, calorosa, brasileira — Oficial VozPlay)</option>
                  <option value="Kore">Kore (Feminina, suave, clara)</option>
                  <option value="Puck">Puck (Masculina, jovem, descontraída)</option>
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
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="animada">Animada & Festiva (Mestre de Cerimônias Oficial)</option>
                  <option value="acolhedora_profissional">Acolhedora & Profissional</option>
                  <option value="cerimoniosa">Cerimoniosa & Elegante</option>
                </select>
              </div>

              <div className="pt-2 space-y-2 text-xs">
                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.announce_queue_calls}
                    onChange={(e) => setConfig({ ...config, announce_queue_calls: e.target.checked })}
                    className="rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#090d16]"
                  />
                  <span>Chamar cantor pelo nome ao ser convocado para o palco</span>
                </label>

                <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.announce_absences}
                    onChange={(e) => setConfig({ ...config, announce_absences: e.target.checked })}
                    className="rounded border-white/20 text-purple-600 focus:ring-purple-500 bg-[#090d16]"
                  />
                  <span>Anunciar ausência com humor leve e reposicionamento</span>
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

            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition flex items-center justify-center gap-2"
            >
              <span>{saveSuccess ? 'Configuração Salva!' : 'Salvar Preferências de Voz'}</span>
            </button>
          </div>

          <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
            <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400 flex items-center gap-2">
              <Play className="w-4 h-4" /> Testar Voz da MaIA ao Vivo
            </h3>

            <textarea
              rows={3}
              value={testSpeechText}
              onChange={(e) => setTestSpeechText(e.target.value)}
              className="w-full p-3 rounded-xl bg-[#090d16] border border-white/10 text-xs text-slate-200 focus:outline-none focus:border-purple-500"
            />

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleTestSpeech(false)}
                disabled={isTestingSpeech}
                className="px-4 py-2.5 rounded-xl bg-white/[0.08] hover:bg-white/[0.12] text-xs font-bold text-slate-200 transition flex items-center justify-center gap-1.5"
              >
                <Volume2 className="w-4 h-4" />
                <span>Ouvir no Painel</span>
              </button>
              <button
                onClick={() => handleTestSpeech(true)}
                disabled={isTestingSpeech}
                className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold text-white transition flex items-center justify-center gap-1.5 shadow-lg shadow-purple-600/20"
              >
                <Tv className="w-4 h-4" />
                <span>Falar no Telão</span>
              </button>
            </div>

            <button
              onClick={handleTestTvCall}
              disabled={isTestingSpeech}
              className="w-full py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition flex items-center justify-center gap-2"
            >
              <Radio className="w-4 h-4" />
              <span>Simular Chamada da Fila na TV</span>
            </button>

            {testStatus && (
              <div className="p-2.5 rounded-xl bg-black/40 text-xs text-purple-300 text-center animate-in fade-in">
                {testStatus}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA 6: AUDITORIA & EVENTOS DE IA */}
      {activeTab === 'audit' && (
        <div className="p-6 rounded-2xl bg-[#0e1322] border border-white/[0.08] space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <History className="w-4 h-4" /> Registro de Auditoria e Eventos de IA
            </h3>
            <span className="text-xs text-slate-500">{auditEvents.length} eventos registrados</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-white/10 text-slate-400">
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Tipo do Evento</th>
                  <th className="py-2.5 px-3">Provedor</th>
                  <th className="py-2.5 px-3">Autor</th>
                  <th className="py-2.5 px-3">Detalhes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {auditEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-500">
                      Nenhum evento registrado ainda.
                    </td>
                  </tr>
                ) : (
                  auditEvents.map((evt) => (
                    <tr key={evt.id} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 px-3 font-mono text-slate-400">
                        {new Date(evt.timestamp).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-purple-300">{evt.event_type}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{evt.provider}</td>
                      <td className="py-2.5 px-3 text-slate-400">{evt.actor}</td>
                      <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">{evt.reason || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
