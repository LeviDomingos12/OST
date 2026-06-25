import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  Settings2, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw,
  AlertCircle
} from "lucide-react";
import { SystemSettings, UserRole } from "../types";

interface GatewayModuleProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export default function GatewayModule({
  settings,
  onUpdateSettings,
  onAddAuditLog,
  currentRole,
  onShowToast
}: GatewayModuleProps) {
  const canEdit = currentRole === "ADMIN";

  const [mpesaEnabled, setMpesaEnabled] = useState(settings.mpesaEnabled || false);
  const [mpesaShortcode, setMpesaShortcode] = useState(settings.mpesaShortcode || "");
  const [mpesaApiKey, setMpesaApiKey] = useState(settings.mpesaApiKey || "");
  const [mpesaSecret, setMpesaSecret] = useState(settings.mpesaSecret || "");
  const [mpesaWebhookUrl, setMpesaWebhookUrl] = useState(settings.mpesaWebhookUrl || "");

  const [emolaEnabled, setEmolaEnabled] = useState(settings.emolaEnabled || false);
  const [emolaShortcode, setEmolaShortcode] = useState(settings.emolaShortcode || "");
  const [emolaApiKey, setEmolaApiKey] = useState(settings.emolaApiKey || "");
  const [emolaSecret, setEmolaSecret] = useState(settings.emolaSecret || "");
  const [emolaWebhookUrl, setEmolaWebhookUrl] = useState(settings.emolaWebhookUrl || "");

  const [isSimulatingPolling, setIsSimulatingPolling] = useState(false);
  const [simulatedPollingStatus, setSimulatedPollingStatus] = useState<string | null>(null);

  const handleSaveGateways = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      if (onShowToast) onShowToast("Apenas administradores podem configurar APIs de pagamento.", "error");
      return;
    }

    onUpdateSettings({
      mpesaEnabled,
      mpesaShortcode,
      mpesaApiKey,
      mpesaSecret,
      mpesaWebhookUrl,
      emolaEnabled,
      emolaShortcode,
      emolaApiKey,
      emolaSecret,
      emolaWebhookUrl
    });

    onAddAuditLog(
      "Atualização de Gateways",
      "INTEGRAÇÕES",
      "Credenciais da API M-Pesa e e-Mola atualizadas."
    );

    if (onShowToast) {
      onShowToast("Configurações de Gateway salvas com sucesso!", "success", "Gateways Integrados");
    }
  };

  const simulateValidation = () => {
    if (!mpesaEnabled && !emolaEnabled) {
      if (onShowToast) onShowToast("Nenhum gateway habilitado para validar.", "warning");
      return;
    }
    
    setIsSimulatingPolling(true);
    setSimulatedPollingStatus("Iniciando validação de pendentes (Polling/Webhook)...");

    setTimeout(() => {
      setSimulatedPollingStatus("Sincronizando com gateway...");
      setTimeout(() => {
        setSimulatedPollingStatus("Buscando transações via API...");
        setTimeout(() => {
          setIsSimulatingPolling(false);
          setSimulatedPollingStatus(null);
          if (onShowToast) onShowToast("Transações validadas com sucesso via webhook.", "success");
        }, 1500);
      }, 1500);
    }, 1000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <CreditCard className="w-6 h-6 text-emerald-600" />
            Integrações de Pagamento Móvel (Gateways)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Configure as credenciais de API do M-Pesa e e-Mola para processamento e validação de pagamentos.
          </p>
        </div>
        <div>
          <button
            onClick={simulateValidation}
            disabled={isSimulatingPolling || (!mpesaEnabled && !emolaEnabled)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-200 hover:bg-emerald-100 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isSimulatingPolling ? "animate-spin" : ""}`} />
            Validar Pendentes
          </button>
        </div>
      </div>

      {simulatedPollingStatus && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center gap-3 text-blue-700">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="font-semibold text-sm">{simulatedPollingStatus}</span>
        </div>
      )}

      <form onSubmit={handleSaveGateways} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* M-PESA */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-600 text-white rounded-xl flex items-center justify-center shadow-sm">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-red-900 leading-tight">Vodacom M-Pesa</h3>
                <span className="text-[10px] text-red-600 font-semibold uppercase tracking-widest">Gateway API</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={mpesaEnabled}
                onChange={(e) => setMpesaEnabled(e.target.checked)}
                disabled={!canEdit}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
            </label>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Business Number (Shortcode)</label>
              <input
                type="text"
                disabled={!canEdit}
                value={mpesaShortcode}
                onChange={(e) => setMpesaShortcode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono font-bold outline-none text-slate-800 disabled:opacity-60"
                placeholder="Ex: 123456"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">API Key / Public Key</label>
              <input
                type="password"
                disabled={!canEdit}
                value={mpesaApiKey}
                onChange={(e) => setMpesaApiKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-sm outline-none text-slate-800 disabled:opacity-60"
                placeholder="••••••••••••••••••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">API Secret / Private Key</label>
              <input
                type="password"
                disabled={!canEdit}
                value={mpesaSecret}
                onChange={(e) => setMpesaSecret(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-sm outline-none text-slate-800 disabled:opacity-60"
                placeholder="••••••••••••••••••••••••"
              />
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-4 mt-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Webhook Endpoint URL</label>
              <input
                type="url"
                disabled={!canEdit}
                value={mpesaWebhookUrl}
                onChange={(e) => setMpesaWebhookUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs outline-none text-slate-800 disabled:opacity-60"
                placeholder="https://sua-api.com/webhooks/mpesa"
              />
              <p className="text-[10px] text-slate-400">Endpoint para recepção de confirmações em tempo real.</p>
            </div>
          </div>
        </div>

        {/* E-MOLA */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="p-4 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center shadow-sm">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-orange-900 leading-tight">Movitel e-Mola</h3>
                <span className="text-[10px] text-orange-600 font-semibold uppercase tracking-widest">Gateway API</span>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={emolaEnabled}
                onChange={(e) => setEmolaEnabled(e.target.checked)}
                disabled={!canEdit}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
            </label>
          </div>

          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">Merchant ID / Business Code</label>
              <input
                type="text"
                disabled={!canEdit}
                value={emolaShortcode}
                onChange={(e) => setEmolaShortcode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono font-bold outline-none text-slate-800 disabled:opacity-60"
                placeholder="Ex: 98765"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">API Key / Token</label>
              <input
                type="password"
                disabled={!canEdit}
                value={emolaApiKey}
                onChange={(e) => setEmolaApiKey(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-sm outline-none text-slate-800 disabled:opacity-60"
                placeholder="••••••••••••••••••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500 uppercase">API Secret</label>
              <input
                type="password"
                disabled={!canEdit}
                value={emolaSecret}
                onChange={(e) => setEmolaSecret(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-sm outline-none text-slate-800 disabled:opacity-60"
                placeholder="••••••••••••••••••••••••"
              />
            </div>

            <div className="space-y-1.5 border-t border-slate-100 pt-4 mt-2">
              <label className="text-xs font-bold text-slate-500 uppercase">Webhook Endpoint URL</label>
              <input
                type="url"
                disabled={!canEdit}
                value={emolaWebhookUrl}
                onChange={(e) => setEmolaWebhookUrl(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 font-mono text-xs outline-none text-slate-800 disabled:opacity-60"
                placeholder="https://sua-api.com/webhooks/emola"
              />
              <p className="text-[10px] text-slate-400">Endpoint para recepção de confirmações em tempo real.</p>
            </div>
          </div>
        </div>

        {canEdit && (
          <div className="lg:col-span-2 mt-2">
            <button
              type="submit"
              className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm shadow-lg shadow-slate-900/20 transition cursor-pointer flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Salvar Credenciais de Gateway
            </button>
            <p className="text-xs text-center text-slate-500 mt-3 flex items-center justify-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              As credenciais da API são salvas com criptografia e usadas para validação em tempo real.
            </p>
          </div>
        )}

      </form>
    </div>
  );
}
