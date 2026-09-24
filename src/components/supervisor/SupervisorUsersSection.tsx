/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * VOZPLAY - Módulo de Gestão de Usuários, Papéis (RBAC) e Credenciais
 * Painel Administrativo do Supervisor para cadastro de operadores e troca de senhas
 */

import React, { useState, useEffect } from 'react';
import {
  Shield,
  KeyRound,
  UserPlus,
  Users,
  Lock,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
  Sliders,
  Server
} from 'lucide-react';
import { apiFetch as fetch } from '../../utils/apiClient.js';

interface OperationalUser {
  id: string;
  name: string;
  email: string;
  role: 'SUPERVISOR' | 'CONTROLLER';
  createdAt: string;
  lastLogin?: string;
}

export const SupervisorUsersSection: React.FC = () => {
  const [users, setUsers] = useState<OperationalUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Estados de troca de senha mestra
  const [supervisorNewPass, setSupervisorNewPass] = useState('');
  const [controllerNewPass, setControllerNewPass] = useState('');
  const [showSupervisorPass, setShowSupervisorPass] = useState(false);
  const [showControllerPass, setShowControllerPass] = useState(false);
  const [isUpdatingSupervisor, setIsUpdatingSupervisor] = useState(false);
  const [isUpdatingController, setIsUpdatingController] = useState(false);

  // Estados de criação de novo usuário
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<'SUPERVISOR' | 'CONTROLLER'>('CONTROLLER');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showNewUserForm, setShowNewUserForm] = useState(false);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/v1/supervisor/users');
      const data = await res.json();
      if (data.success && data.data?.users) {
        setUsers(data.data.users);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const triggerFeedback = (message: string, type: 'success' | 'error') => {
    setFeedback({ message, type });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleUpdatePassword = async (targetRole: 'SUPERVISOR' | 'CONTROLLER') => {
    const password = targetRole === 'SUPERVISOR' ? supervisorNewPass : controllerNewPass;
    if (!password || password.length < 4) {
      triggerFeedback('A nova senha deve possuir no mínimo 4 caracteres.', 'error');
      return;
    }

    if (targetRole === 'SUPERVISOR') setIsUpdatingSupervisor(true);
    else setIsUpdatingController(true);

    try {
      const res = await fetch('/api/v1/supervisor/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetRole, newPassword: password })
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback(data.message, 'success');
        if (targetRole === 'SUPERVISOR') setSupervisorNewPass('');
        else setControllerNewPass('');
        loadUsers();
      } else {
        triggerFeedback(data.error || 'Erro ao atualizar senha.', 'error');
      }
    } catch (err) {
      triggerFeedback('Falha de conexão ao atualizar senha.', 'error');
    } finally {
      if (targetRole === 'SUPERVISOR') setIsUpdatingSupervisor(false);
      else setIsUpdatingController(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim() || !newUserPassword) {
      triggerFeedback('Preencha todos os campos obrigatórios.', 'error');
      return;
    }

    if (newUserPassword.length < 4) {
      triggerFeedback('A senha deve ter no mínimo 4 caracteres.', 'error');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await fetch('/api/v1/supervisor/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          role: newUserRole,
          password: newUserPassword
        })
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback(`Usuário "${newUserName}" cadastrado com sucesso!`, 'success');
        setNewUserName('');
        setNewUserEmail('');
        setNewUserPassword('');
        setShowNewUserForm(false);
        loadUsers();
      } else {
        triggerFeedback(data.error || 'Erro ao criar usuário.', 'error');
      }
    } catch (err) {
      triggerFeedback('Falha de conexão ao criar usuário.', 'error');
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente remover o usuário "${name}"?`)) return;

    try {
      const res = await fetch(`/api/v1/supervisor/users/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        triggerFeedback(`Usuário "${name}" removido com sucesso.`, 'success');
        loadUsers();
      } else {
        triggerFeedback(data.error || 'Erro ao remover usuário.', 'error');
      }
    } catch (err) {
      triggerFeedback('Falha de conexão ao remover usuário.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between shadow-xl transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200'
              : 'bg-rose-950/80 border-rose-500/40 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[10px] uppercase font-bold opacity-60 hover:opacity-100 cursor-pointer"
          >
            Dispensar
          </button>
        </div>
      )}

      {/* Grid: Cartões de Senha Mestre (Supervisor & Controlador) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Senha Mestre do Supervisor / Admin */}
        <div className="rounded-3xl bg-[#0d1222] border border-amber-500/20 p-6 space-y-4 shadow-xl ring-1 ring-white/5 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-black text-white">Senha do Supervisor / Caixa</h3>
              <p className="text-xs text-slate-400">Acesso administrativo completo, relatórios e prorrogações</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Definir Nova Senha do Supervisor:
            </label>
            <div className="relative">
              <input
                type={showSupervisorPass ? 'text' : 'password'}
                value={supervisorNewPass}
                onChange={(e) => setSupervisorNewPass(e.target.value)}
                placeholder="Digite a nova senha (mínimo 4 caracteres)"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-[#080c16] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-amber-500/80 transition"
              />
              <button
                type="button"
                onClick={() => setShowSupervisorPass(!showSupervisorPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                title={showSupervisorPass ? 'Ocultar' : 'Exibir'}
              >
                {showSupervisorPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Padrão inicial: <code className="text-amber-400/80 font-mono">vozplay@super2026</code>
              </span>
              <button
                type="button"
                onClick={() => handleUpdatePassword('SUPERVISOR')}
                disabled={isUpdatingSupervisor || !supervisorNewPass}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-amber-500/20"
              >
                {isUpdatingSupervisor ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Salvar Senha</span>
              </button>
            </div>
          </div>
        </div>

        {/* Card 2: Senha da Mesa de Som (Controlador) */}
        <div className="rounded-3xl bg-[#0d1222] border border-blue-500/20 p-6 space-y-4 shadow-xl ring-1 ring-white/5 relative overflow-hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-black text-white">Senha do Controlador (Mesa de Som)</h3>
              <p className="text-xs text-slate-400">Controle de reprodução, DJ soundboard e fila de cantores</p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Definir Nova Senha do Controlador:
            </label>
            <div className="relative">
              <input
                type={showControllerPass ? 'text' : 'password'}
                value={controllerNewPass}
                onChange={(e) => setControllerNewPass(e.target.value)}
                placeholder="Digite a nova senha da mesa"
                className="w-full px-4 py-3 pr-11 rounded-xl bg-[#080c16] border border-white/10 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-blue-500/80 transition"
              />
              <button
                type="button"
                onClick={() => setShowControllerPass(!showControllerPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-1 cursor-pointer"
                title={showControllerPass ? 'Ocultar' : 'Exibir'}
              >
                {showControllerPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-[11px] text-slate-500">
                Padrão inicial: <code className="text-blue-400/80 font-mono">vozplay@ctrl704</code>
              </span>
              <button
                type="button"
                onClick={() => handleUpdatePassword('CONTROLLER')}
                disabled={isUpdatingController || !controllerNewPass}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-blue-600/20"
              >
                {isUpdatingController ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <KeyRound className="w-3.5 h-3.5" />}
                <span>Salvar Senha</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Seção de Cadastro e Gerenciamento de Usuários Operacionais */}
      <div className="rounded-3xl bg-[#0d1222] border border-white/10 p-6 space-y-6 shadow-2xl ring-1 ring-white/5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-300">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-display font-black text-white">Usuários & Operadores da Casa</h3>
              <p className="text-xs text-slate-400">Contas individuais de acesso com controle de papéis (RBAC)</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowNewUserForm(!showNewUserForm)}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition flex items-center gap-2 cursor-pointer shadow-md shadow-purple-900/30"
          >
            <UserPlus className="w-4 h-4" />
            <span>{showNewUserForm ? 'Fechar Formulário' : 'Novo Usuário'}</span>
          </button>
        </div>

        {/* Formulário de Novo Usuário (Retrátil) */}
        {showNewUserForm && (
          <form onSubmit={handleCreateUser} className="p-5 rounded-2xl bg-[#080c16] border border-purple-500/30 space-y-4">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-purple-400" />
              Cadastrar Novo Operador ou Supervisor
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Nome Completo:
                </label>
                <input
                  type="text"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="Ex: Carlos Silva - Mesa 01"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0e1324] border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  E-mail de Acesso:
                </label>
                <input
                  type="email"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  placeholder="Ex: carlos@lounge.com"
                  required
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0e1324] border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Papel / Nível de Permissão:
                </label>
                <select
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as 'SUPERVISOR' | 'CONTROLLER')}
                  className="w-full px-4 py-2.5 rounded-xl bg-[#0e1324] border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                >
                  <option value="CONTROLLER">Controlador (Mesa de Som & Fila)</option>
                  <option value="SUPERVISOR">Supervisor (Administrador Geral)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Senha Inicial:
                </label>
                <div className="relative">
                  <input
                    type={showNewUserPassword ? 'text' : 'password'}
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres"
                    required
                    className="w-full px-4 py-2.5 pr-10 rounded-xl bg-[#0e1324] border border-slate-700 text-white text-xs focus:outline-none focus:border-purple-500 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showNewUserPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowNewUserForm(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isCreatingUser}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md shadow-purple-900/30 disabled:opacity-50"
              >
                {isCreatingUser ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                <span>Salvar Usuário</span>
              </button>
            </div>
          </form>
        )}

        {/* Tabela de Usuários Cadastrados */}
        {isLoading ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-purple-400" />
            Carregando usuários cadastrados...
          </div>
        ) : users.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-xs">
            Nenhum usuário cadastrado no momento.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-[#080c16] text-slate-400 border-b border-white/[0.08] uppercase tracking-wider text-[10px] font-mono">
                <tr>
                  <th className="p-3.5">Nome / Operador</th>
                  <th className="p-3.5">E-mail de Acesso</th>
                  <th className="p-3.5">Função (Papel)</th>
                  <th className="p-3.5">Cadastrado em</th>
                  <th className="p-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition">
                    <td className="p-3.5 font-bold text-white flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-mono text-[11px]">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <span>{u.name}</span>
                    </td>
                    <td className="p-3.5 font-mono text-slate-400">{u.email}</td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          u.role === 'SUPERVISOR'
                            ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            : 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
                        }`}
                      >
                        {u.role === 'SUPERVISOR' ? 'Supervisor (Admin)' : 'Controlador (Mesa)'}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-500 text-[11px]">
                      {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3.5 text-right">
                      {/* Não permite deletar contas principais do sistema */}
                      {u.id !== 'usr-admin-01' ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(u.id, u.name)}
                          className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition cursor-pointer"
                          title="Remover usuário"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-600 font-mono">Principal</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Guia Informativo DevOps */}
      <div className="rounded-3xl bg-[#080c16] border border-white/10 p-5 text-xs text-slate-400 space-y-2 ring-1 ring-white/5">
        <div className="flex items-center gap-2 text-white font-bold">
          <Server className="w-4 h-4 text-purple-400" />
          <span>Configuração em Produção (Docker & Variáveis de Ambiente)</span>
        </div>
        <p className="leading-relaxed">
          Para definir senhas fixas e automáticas ao inicializar o servidor em produção (Docker Compose ou Cloud Run), adicione ao seu arquivo <code className="text-purple-300 font-mono">.env</code>:
        </p>
        <div className="p-3 rounded-xl bg-black/60 font-mono text-[11px] text-emerald-400 border border-white/5 space-y-1">
          <div>SUPERVISOR_PASSWORD=sua_senha_segura_de_supervisor</div>
          <div>CONTROLLER_PASSWORD=sua_senha_da_mesa_de_som</div>
        </div>
      </div>
    </div>
  );
};
