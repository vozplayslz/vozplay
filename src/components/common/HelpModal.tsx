/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Central de Ajuda & Guia Operacional
 * Documentação interativa multi-perfil e guia de deploy
 */

import React, { useState } from 'react';
import {
  HelpCircle,
  X,
  Smartphone,
  Sliders,
  Shield,
  Tv,
  Rocket,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Copy,
  Check,
  Terminal,
  ExternalLink,
  QrCode,
  Mic,
  Radio,
  Volume2,
  Clock,
  AlertTriangle,
  KeyRound,
  Sparkles,
  Heart,
  Headphones,
  Users,
  Camera
} from 'lucide-react';
import { VozPlayMascotIcon } from './VozPlayLogo.js';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultSection?: 'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV' | 'TRACKER' | 'DEPLOY';
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  defaultSection = 'PARTICIPANT'
}) => {
  const [activeSection, setActiveSection] = useState<'PARTICIPANT' | 'CONTROLLER' | 'SUPERVISOR' | 'TV' | 'TRACKER' | 'DEPLOY'>(defaultSection);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(label);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const navItems = [
    {
      id: 'PARTICIPANT' as const,
      label: 'Participante (PWA)',
      icon: Smartphone,
      color: 'from-pink-500 to-rose-600',
      description: 'Como pedir músicas e cantar'
    },
    {
      id: 'CONTROLLER' as const,
      label: 'Controlador (Operador)',
      icon: Sliders,
      color: 'from-purple-600 to-indigo-600',
      description: 'Gestão da fila e DJ Soundboard'
    },
    {
      id: 'SUPERVISOR' as const,
      label: 'Supervisor (Gerência)',
      icon: Shield,
      color: 'from-amber-500 to-orange-600',
      description: 'Autoridade, sessões e leads'
    },
    {
      id: 'TV' as const,
      label: 'TV Telão (Lounge)',
      icon: Tv,
      color: 'from-blue-500 to-cyan-600',
      description: 'Configuração de tela e letras'
    },
    {
      id: 'TRACKER' as const,
      label: 'Acompanhar Minha Vez',
      icon: ExternalLink,
      color: 'from-cyan-500 to-teal-600',
      description: 'Link público /v/:id sem login'
    },
    {
      id: 'DEPLOY' as const,
      label: 'Deploy & DevOps',
      icon: Rocket,
      color: 'from-emerald-500 to-teal-600',
      description: 'Docker, portas e variáveis'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0e1b] border border-white/10 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-200">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-white/[0.08] flex items-center justify-between bg-[#0e1324]/80">
          <div className="flex items-center gap-3">
            <div className="relative flex-shrink-0">
              <VozPlayMascotIcon size={40} animated />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight flex items-center gap-2">
                Central de Ajuda & Guia Operacional
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  VozPlay v1.2
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Instruções passo a passo para cada perfil de acesso e manual de deploy
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition active:scale-95"
            aria-label="Fechar Central de Ajuda"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body with Left Sidebar Tabs */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Navigation Sidebar */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/[0.08] bg-[#080B14] p-3 flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto no-scrollbar shrink-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveSection(item.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all duration-200 shrink-0 md:shrink ${
                    isActive
                      ? 'bg-gradient-to-r from-white/[0.12] to-white/[0.04] text-white border border-white/20 shadow-lg'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isActive ? `bg-gradient-to-tr ${item.color} text-white shadow-md` : 'bg-white/[0.06] text-slate-400'
                  }`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="hidden sm:block min-w-0">
                    <div className="text-xs font-bold truncate leading-snug">{item.label}</div>
                    <div className="text-[10px] text-slate-500 truncate leading-snug">{item.description}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detailed Content Panel */}
          <div className="flex-1 p-5 sm:p-7 overflow-y-auto space-y-6">
            
            {/* 1. GUIA DO PARTICIPANTE */}
            {activeSection === 'PARTICIPANT' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-300 border border-pink-500/30 flex items-center justify-center">
                    <Smartphone className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Guia do Participante (Cliente do Karaokê)</h3>
                    <p className="text-xs text-slate-400">Como entrar na sessão, escolher músicas e cantar no palco</p>
                  </div>
                </div>

                <div className="grid gap-3.5 sm:grid-cols-2">
                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider">
                      <QrCode className="w-4 h-4" /> 1. Conexão na Sessão
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Escaneie o <strong>QR Code</strong> exibido no telão da TV ou no cardápio de mesa. O código da sessão (ex: <code className="text-pink-300 font-mono">SLZ-704</code>) é vinculado automaticamente.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                      <KeyRound className="w-4 h-4" /> 2. Código de Presença (4 Dígitos)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Para evitar pedidos remotos ou de clientes ausentes, solicite o <strong>código de 4 dígitos</strong> visível na mesa do operador ou na TV e digite no banner de validação para liberar o microfone.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <div className="flex items-center gap-2 text-purple-400 font-bold text-xs uppercase tracking-wider">
                      <Mic className="w-4 h-4" /> 3. Escolha & Ajuste de Tom
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Pesquise pelo título, artista ou gênero. Você pode selecionar a versão musical (Karaokê clássico, Acústico, Ao Vivo) e transpor o tom de <strong>-3 a +3 semitons</strong> para adequar à sua voz.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                      <Clock className="w-4 h-4" /> 4. Acompanhe Sua Vez & Chamada ao Palco (30s)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Monitore sua posição na fila (<code className="text-emerald-300 font-mono">#1, #2...</code>) e o tempo estimado. Quando sua música for chamada pelo operador, você receberá um alerta sonoro/vibratório com o botão <strong>Começar a Cantar Agora</strong>. A música inicia no telão e as <strong>Letras Sincronizadas</strong> abrem na tela do seu celular!
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-pink-500/20 space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2 text-pink-400 font-bold text-xs uppercase tracking-wider">
                      <Heart className="w-4 h-4 fill-pink-500/30" /> 5. Lista de Desejos (Próximas Rodadas)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Encontrou músicas incríveis que quer cantar mais tarde? Toque no botão de coração <strong>♡</strong> no catálogo ou no modal. Suas músicas ficam salvas na aba <strong>Lista de Desejos</strong> com o tom vocal configurado, permitindo entrar na fila com apenas 1 clique quando for o momento da sua próxima apresentação.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-purple-500/30 space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-pink-400" /> 6. Playlist Recomendada por IA (Gemini)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Em dúvida sobre o que cantar? Abra a aba <strong>Playlist IA</strong> ou toque em <em>Sugerir Playlist</em> ao filtrar um gênero musical. A IA do Gemini analisa o catálogo do bar e sugere uma seleção equilibrada de hinos para karaokê, completa com indicação de tons vocais confortáveis, nível de energia e dicas práticas de palco para animar o público.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-cyan-500/30 space-y-2 sm:col-span-2">
                    <div className="flex items-center gap-2 text-cyan-300 font-bold text-xs uppercase tracking-wider">
                      <Headphones className="w-4 h-4 text-cyan-400" /> 7. Ouvir Prévia no Próprio Aparelho (Sem Surpresas no Palco)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Para evitar desistências ou ficar pulando músicas no palco, toque no ícone de <strong>fones de ouvido 🎧</strong> ou em <strong>Ouvir Prévia</strong> no modal da música. O áudio e vídeo tocam exclusivamente no seu celular (fones ou alto-falante), permitindo que você confira a introdução, o tom e a versão antes de enviar para o telão da TV.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-pink-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-pink-300 font-bold text-xs uppercase tracking-wider">
                      <Users className="w-4 h-4 text-pink-400" /> 8. Apresentação em Dupla (Dueto)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Vai cantar com um amigo? No modal de escolha, marque <strong>Cantar em Dupla</strong> e digite o nome do(a) parceiro(a). A TV exibe a dupla no telão e a cabine de som do operador recebe o aviso antecipado para disponibilizar <strong>2 microfones ativos</strong> no palco.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-purple-500/30 space-y-2">
                    <div className="flex items-center gap-2 text-purple-300 font-bold text-xs uppercase tracking-wider">
                      <Camera className="w-4 h-4 text-purple-400" /> 9. Leitor de QR Code Integrado
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Mudou de mesa ou quer se conectar ao telão do lounge? Toque no botão <strong>Escanear Mesa</strong> no login ou no seu passe VIP para abrir o scanner com câmera ao vivo, suporte a lanterna noturna e atalhos rápidos com 1 toque.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 to-pink-950/40 border border-purple-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-purple-300 font-bold text-xs">
                    <Radio className="w-4 h-4 text-pink-400 animate-pulse" /> Reações da Plateia no Telão
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Durante as apresentações, toque nos botões de reação (👏 Aplausos, 🔥 Energia, ❤️ Amei, 🎤 Show, 🍻 Saúde). Seus aplausos sobem ao vivo como animações flutuantes na tela da TV!
                  </p>
                </div>
              </div>
            )}

            {/* 2. GUIA DO CONTROLADOR */}
            {activeSection === 'CONTROLLER' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
                    <Sliders className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Guia do Controlador (Operador de Mesa de Som)</h3>
                    <p className="text-xs text-slate-400">Operação musical, fila contínua, soundboard e validação</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                      <KeyRound className="w-4 h-4" /> Código de Presença de 60 Segundos
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O card superior exibe o <strong>Código de 4 Dígitos</strong> atual e o cronômetro decrescente de expiração. O código se renova automaticamente a cada 60 segundos. Informe-o verbalmente aos clientes que comparecerem à mesa para pedir música.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                      <Volume2 className="w-4 h-4" /> Fila e Controles de Playback
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      - <strong>Chamar Próximo (30s):</strong> Aciona a tela de convocação no telão da TV e notifica o smartphone do participante. Um cronômetro decrescente de 30s orienta o cantor a subir ao palco e confirmar presença.<br />
                      - <strong>Tocar / Iniciar:</strong> Inicia imediatamente a próxima música ou a música chamada na TV.<br />
                      - <strong>Pausar / Retomar:</strong> Interrompe temporariamente a reprodução para avisos sonoros.<br />
                      - <strong>Pular Música:</strong> Encerra a música atual e avança para o próximo participante.<br />
                      - <strong>Controle de Volume:</strong> Ajusta o volume master da TV remotamente em tempo real.<br />
                      - <strong>Gestão de Ausências Justa:</strong> Se o cantor não comparecer na 1ª chamada, a música continua na fila com 1 aviso de tolerância. Na 2ª ausência consecutiva, a música é movida para o final da fila sem prejudicar os demais clientes.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-pink-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4" /> DJ Soundboard Profissional & Broadcast (TV + Mobile)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Painel com <strong>10 efeitos sonoros sintetizados em tempo real via Web Audio</strong> (Aplausos, Assobios & Torcida, Gritos & Festa, Coro / Arerê, Air Horn, Tambores de Suspense, Ba-Dum-Tss, Uhhh / Vaia Amiga, Vinheta VozPlay e Laser Drop):<br />
                      - <strong>Disparo Geral (Broadcast):</strong> Transmite instantaneamente para a TV do lounge e para todos os celulares dos participantes conectados.<br />
                      - <strong>Pré-escuta no Fone:</strong> O ícone de fone permite ouvir o efeito apenas na mesa/fone de ouvido sem tocar no salão.<br />
                      - <strong>Atalhos de Teclado:</strong> Use as teclas numéricas <code className="text-pink-300 font-mono font-bold">[1]</code> a <code className="text-pink-300 font-mono font-bold">[9]</code> e <code className="text-pink-300 font-mono font-bold">[0]</code> para disparos imediatos com apenas uma mão na mesa.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <Mic className="w-4 h-4" /> Inserção Manual de Balcão & Transposição de Tom
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      - <strong>Inserir Pedido na Fila:</strong> Atenda clientes no balcão inserindo música, artista e nome do cantor diretamente pela aba <em>Inserir Pedido</em>, definindo versão de estúdio, tom vocal de -3 a +3 e se a apresentação será em dupla.<br />
                      - <strong>Ajuste de Tom em Tempo Real:</strong> Durante a reprodução no palco ou na lista de espera, use os botões <code className="text-amber-300 font-mono font-bold">[-1]</code> e <code className="text-amber-300 font-mono font-bold">[+1]</code> para calibrar a tonalidade perfeitamente para o cantor sem interrupções.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 3. GUIA DO SUPERVISOR */}
            {activeSection === 'SUPERVISOR' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
                    <Shield className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Guia do Supervisor (Gerência & Caixa)</h3>
                    <p className="text-xs text-slate-400">Autoridade geral, prorrogação, auditoria e marketing</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Encerramento Programado & Prorrogações
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      A plataforma respeita o horário combinado de encerramento da casa. Ao atingir o horário limite, novas inclusões na fila são bloqueadas. Para permitir mais músicas, use os botões <strong>+15 min</strong> ou <strong>+30 min</strong>. No encerramento final, músicas não cantadas são descartadas de forma segura.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-rose-300 uppercase tracking-wider flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" /> Assunção Emergencial (Emergency Takeover)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Se o operador faltar ou abandonar a mesa, o supervisor pode acionar o <strong>Controle de Emergência</strong>. Isso revoga imediatamente a sessão do controlador anterior, assume o controle das músicas e renova o código de presença na hora.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                      <Radio className="w-4 h-4" /> Avisos na TV & Coleta de Leads
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      - <strong>Broadcast de Alertas:</strong> Digite avisos como &quot;Última chamada para o rodízio&quot; ou &quot;Parabéns à mesa 4&quot; e envie instantaneamente para o rodapé do telão.<br />
                      - <strong>Leads de Marketing:</strong> Visualize a lista completa de participantes cadastrados com WhatsApp e consentimento LGPD, pronta para campanhas de retorno e fidelidade.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-purple-500/30 space-y-2">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-pink-400" /> Identidade Visual, Cores & Logo Favicon
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      - <strong>Personalização Completa de Cores:</strong> Na aba <em>Identidade Visual</em>, altere as cores Principal, Secundária, Destaque, Fundo e Painéis com seletor visual e código hexadecimal.<br />
                      - <strong>Logo & Mascote Ajustáveis:</strong> O mascote Polvo Cantor 3D adapta automaticamente seus gradientes ao tom escolhido da casa (modo <em>Tom da Casa</em>) ou preserva o clássico <em>Azul Oficial</em>.<br />
                      - <strong>Favicon SVG Automático:</strong> O mascote também atua como favicon oficial da aplicação, adaptando-se a abas claras e escuras do navegador.<br />
                      - <strong>Auditoria de Contraste WCAG 2.1:</strong> O sistema analisa a legibilidade das letras em tempo real e fornece um botão para ajuste automático de contraste caso necessário.<br />
                      - <strong>Sincronização em Tempo Real:</strong> Ao clicar em <em>Salvar Identidade</em>, todas as alterações são propagadas via WebSocket para a TV, os smartphones dos clientes e a mesa de som sem precisar reiniciar a sessão.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-amber-500/30 space-y-2">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-amber-400" /> Gestão de Usuários, Papéis & Senhas (RBAC)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      - <strong>Troca de Senhas Mestras:</strong> Na aba <em>Usuários & Senhas</em>, você pode alterar a qualquer momento a senha do <strong>Supervisor/Admin</strong> e a senha do <strong>Controlador da Mesa de Som</strong>.<br />
                      - <strong>Cadastro de Operadores:</strong> Cadastre operadores específicos da equipe (com nome, e-mail, função e senha inicial) para rastreabilidade de acessos nos logs de auditoria.<br />
                      - <strong>Senhas Seguras:</strong> O sistema não utiliza senhas padrão em código. Defina suas senhas exclusivas via variáveis de ambiente <code className="text-purple-300 font-mono">SUPERVISOR_PASSWORD</code> e <code className="text-purple-300 font-mono">CONTROLLER_PASSWORD</code> no arquivo <code className="text-purple-300 font-mono">.env</code>.<br />
                      - <strong>Persistência em Produção:</strong> Credenciais são hasheadas com Argon2id e vinculadas a sessões criptográficas com Bearer Token.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. GUIA DA TV TELÃO */}
            {activeSection === 'TV' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center justify-center">
                    <Tv className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Guia da TV Telão (Lounge Display)</h3>
                    <p className="text-xs text-slate-400">Configuração de tela 10-foot, modo Fullscreen e áudio HDMI</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                      1. Como colocar em Tela Cheia (Fullscreen)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Abra a aba <strong>TV Telão</strong> no navegador da Smart TV ou no computador conectado ao cabo HDMI do telão. Pressione a tecla <kbd className="px-2 py-0.5 rounded bg-white/10 text-white font-mono text-[11px]">F11</kbd> ou clique no botão <strong>&quot;Tela Cheia&quot;</strong> no canto superior direito para ocultar barras de navegação.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                      2. Letras Sincronizadas & Transição Automática
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ao término de cada música, a TV exibe automaticamente uma vinheta comemorativa (&quot;Show de Carisma&quot; / &quot;Voz de Ouro&quot;), disparando aplausos virtuais e uma contagem regressiva de 7 segundos antes de iniciar o próximo cantor da fila.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                      3. QR Code Permanente de Conexão
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O canto inferior direito exibe permanentemente o QR Code com a URL oficial da unidade. Clientes que apontam a câmera do celular entram diretamente na sessão ativa sem precisar digitar códigos ou endereços complexos.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-amber-500/20 space-y-2">
                    <h4 className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center gap-2">
                      <Mic className="w-4 h-4 text-amber-400" /> 4. Tela de Convocação ao Palco (30s)
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Quando o operador aciona a chamada do próximo cantor, a TV entra em modo holofote de palco com contagem regressiva de 30 segundos, exibindo o nome do participante ou dupla em letras gigantes, instruindo o cliente a se posicionar no microfone.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 5. ACOMPANHAR MINHA VEZ (TRACKER PÚBLICO) */}
            {activeSection === 'TRACKER' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 flex items-center justify-center">
                    <ExternalLink className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Acompanhar Minha Vez (Link Público / Tracker)</h3>
                    <p className="text-xs text-slate-400">Rastreamento leve da fila pelo WhatsApp ou navegador, sem necessidade de login</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                      <Clock className="w-4 h-4" /> Como Funciona o Link de Acompanhamento
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ao adicionar uma música à fila, o participante pode tocar no botão <strong>Compartilhar Minha Vez</strong> para gerar um link direto (ex: <code className="text-cyan-300 font-mono">vozplay.ai.slz.br/v/:queueItemId</code>). Esse link pode ser enviado para o WhatsApp de amigos da mesa ou aberto em segundo plano no celular.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-emerald-300 uppercase tracking-wider flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Privacidade e LGPD Garantidas
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      O Tracker público <strong>nunca expõe dados confidenciais</strong>, como número de WhatsApp, token de sessão ou identificadores internos. Ele exibe apenas o nome artístico do cantor, a música escolhida, o tom e a posição atual na fila.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <h4 className="text-xs font-bold text-purple-300 uppercase tracking-wider flex items-center gap-2">
                      <Radio className="w-4 h-4" /> Atualização em Tempo Real & Alerta de Palco
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      A tela do Tracker atualiza automaticamente a posição na fila (ex: <em>Faltam 2 músicas</em>, <em>Tempo estimado: 8 min</em>). Quando a música é convocada pelo operador para o palco, o status muda para <strong>Chamado ao Palco!</strong> com efeito visual pulsante.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 6. GUIA DE DEPLOY & DEVOPS */}
            {activeSection === 'DEPLOY' && (
              <div className="space-y-6 animate-in fade-in duration-150">
                <div className="flex items-center gap-3 pb-3 border-b border-white/[0.08]">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
                    <Rocket className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-white">Guia de Deploy & DevOps (Produção)</h3>
                    <p className="text-xs text-slate-400">Instruções para subir via Docker Compose, PostgreSQL 16 e bateria de testes</p>
                  </div>
                </div>

                {/* Docker Quickstart */}
                <div className="p-4 rounded-2xl bg-[#090d18] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                      <Terminal className="w-4 h-4" /> Execução com Docker Compose (Produção)
                    </span>
                    <button
                      onClick={() => handleCopy('docker compose up --build -d', 'docker-cmd')}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 transition active:scale-95"
                    >
                      {copiedText === 'docker-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'docker-cmd' ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-black/60 text-emerald-300 font-mono text-xs overflow-x-auto">
                    {`# 1. Clone o repositório e configure as credenciais obrigatórias
cp .env.example .env

# 2. Suba os containers da aplicação e do PostgreSQL com healthcheck
docker compose up --build -d

# 3. Acesse a aplicação na porta única 3000
http://localhost:3000`}
                  </pre>
                </div>

                {/* Test Suite Execution */}
                <div className="p-4 rounded-2xl bg-[#090d18] border border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-purple-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Bateria de Testes Automatizados (81 Testes)
                    </span>
                    <button
                      onClick={() => handleCopy('npm run test', 'test-cmd')}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/10 text-[11px] font-semibold text-slate-300 flex items-center gap-1.5 transition active:scale-95"
                    >
                      {copiedText === 'test-cmd' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedText === 'test-cmd' ? 'Copiado!' : 'Copiar'}</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-black/60 text-purple-300 font-mono text-xs overflow-x-auto">
                    {`# Executa a bateria de 81 testes de integração & segurança:
npm run test

# Executa checagem de tipos TypeScript estrita:
npm run lint

# Executa empacotamento completo de produção (Vite + esbuild):
npm run build`}
                  </pre>
                </div>

                {/* Production Facts */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <div className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                      Regra de Porta Única (3000)
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Tanto em desenvolvimento com Vite Middleware quanto em produção no Cloud Run/Docker, o servidor escuta <strong>exclusivamente na porta 3000</strong> e no host <code className="text-amber-300 font-mono">0.0.0.0</code>.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                    <div className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                      Healthchecks & Observabilidade
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Probes de integridade expostos para orquestradores (Kubernetes/Cloud Run):<br />
                      - <code className="text-blue-300 font-mono">/liveness</code> (Status de execução do processo)<br />
                      - <code className="text-blue-300 font-mono">/readiness</code> (Conexão do banco de dados)<br />
                      - <code className="text-blue-300 font-mono">/api/health</code> (Status do serviço e domínio)
                    </p>
                  </div>
                </div>

                {/* Environment Variables Table */}
                <div className="p-4 rounded-2xl bg-[#111728] border border-white/[0.07] space-y-2">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Variáveis de Ambiente Obrigatórias (.env)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs font-mono">
                      <thead>
                        <tr className="border-b border-white/10 text-slate-400">
                          <th className="py-2">Variável</th>
                          <th className="py-2">Exemplo / Padrão</th>
                          <th className="py-2">Descrição</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.05] text-slate-300">
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">PORT</td>
                          <td className="py-2">3000</td>
                          <td className="py-2 font-sans">Porta de escuta HTTP REST e WebSockets</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">NODE_ENV</td>
                          <td className="py-2">production</td>
                          <td className="py-2 font-sans">Modo de execução (startup falha se senhas ausentes em prod)</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">DOMAIN</td>
                          <td className="py-2">vozplay.ai.slz.br</td>
                          <td className="py-2 font-sans">Domínio oficial base dos QR Codes e links</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">DATABASE_URL</td>
                          <td className="py-2">postgresql://...</td>
                          <td className="py-2 font-sans">String de conexão com o banco PostgreSQL 16</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">SUPERVISOR_PASSWORD</td>
                          <td className="py-2 text-rose-400 italic">Obrigatório no .env</td>
                          <td className="py-2 font-sans">Senha mestra do Supervisor (sem fallbacks inseguros)</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">CONTROLLER_PASSWORD</td>
                          <td className="py-2 text-rose-400 italic">Obrigatório no .env</td>
                          <td className="py-2 font-sans">Senha mestra da Mesa de Som (sem fallbacks inseguros)</td>
                        </tr>
                        <tr>
                          <td className="py-2 text-purple-300 font-bold">SEED_DEMO</td>
                          <td className="py-2">false</td>
                          <td className="py-2 font-sans">Se true, popula cantores fictícios em ambiente de teste</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-white/[0.08] bg-[#0c1020] flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>VozPlay Karaoke Platform • Desenvolvido para Bares, Lounges e Eventos</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-purple-600/20 transition active:scale-95"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};
