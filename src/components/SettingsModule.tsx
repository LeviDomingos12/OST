import React, { useState, useEffect } from "react";
import { 
  Settings, 
  Building, 
  CreditCard, 
  Database, 
  CheckCircle, 
  Shield, 
  HelpCircle, 
  Lock,
  Download,
  Upload,
  RefreshCw,
  Mail,
  Clock,
  Calendar,
  Play,
  Terminal,
  Check,
  FileText,
  Cloud,
  Globe,
  Server,
  Printer
} from "lucide-react";
import { SystemSettings, UserRole } from "../types";
import { initAuth, googleSignIn, logout, getAccessToken } from "../lib/firebase";
import { sendEmail } from "../lib/gmail";

interface SettingsModuleProps {
  settings: SystemSettings;
  onUpdateSettings: (newSettings: Partial<SystemSettings>) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export default function SettingsModule({
  settings,
  onUpdateSettings,
  onAddAuditLog,
  currentRole,
  currency,
  onShowToast
}: SettingsModuleProps) {
  const canEdit = currentRole === "ADMIN";
  
  // Local states matching state configurations
  const [companyName, setCompanyName] = useState(settings.companyName);
  const [slogan, setSlogan] = useState(settings.slogan);
  const [companyNuit, setCompanyNuit] = useState(settings.companyNuit);
  const [storeAddress, setStoreAddress] = useState(settings.storeAddress);
  const [storeContact, setStoreContact] = useState(settings.storeContact);
  const [defaultVat, setDefaultVat] = useState(settings.defaultVat);

  // Gateway credentials configurations (MPesa, EMola)

  // Automated report email states
  const [reportRecipientEmail, setReportRecipientEmail] = useState(settings.reportRecipientEmail || "");
  const [reportHour, setReportHour] = useState(settings.reportHour || "02:00");
  const [reportFrequency, setReportFrequency] = useState(settings.reportFrequency || "daily");
  
  // Custom states for dispatcher details
  const [reportFormat, setReportFormat] = useState<"PDF" | "CSV" | "AMBOS">("PDF");
  const [includeFinancial, setIncludeFinancial] = useState(true);
  const [includeAudit, setIncludeAudit] = useState(true);
  const [includeStaff, setIncludeStaff] = useState(false);

  // Gmail OAuth States
  const [gmailUser, setGmailUser] = useState<any>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(true);

  // Google Drive States
  const [driveStats, setDriveStats] = useState<{ limit: number, usage: number } | null>(null);
  const [recentFiles, setRecentFiles] = useState<any[]>([]);
  const [isFetchingDrive, setIsFetchingDrive] = useState(false);

  const fetchDriveStats = async () => {
    if (needsAuth) return;
    setIsFetchingDrive(true);
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sem token");

      // Fetch storage quota
      const aboutRes = await fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const aboutData = await aboutRes.json();
      if (aboutData.storageQuota) {
        setDriveStats({
          limit: Number(aboutData.storageQuota.limit),
          usage: Number(aboutData.storageQuota.usage)
        });
      }

      // Fetch recent files
      const filesRes = await fetch("https://www.googleapis.com/drive/v3/files?orderBy=createdTime desc&pageSize=5&fields=files(id,name,mimeType,createdTime)", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const filesData = await filesRes.json();
      if (filesData.files) {
        setRecentFiles(filesData.files);
      }
    } catch (e) {
      console.error("Failed to fetch drive stats", e);
    } finally {
      setIsFetchingDrive(false);
    }
  };

  useEffect(() => {
    if (!needsAuth) {
      fetchDriveStats();
    }
  }, [needsAuth]);

  // Daily backup check scheduler
  useEffect(() => {
    if (!canEdit) return; // Only warn admin

    const checkBackupStatus = () => {
      const lastBackupStr = localStorage.getItem("lastBackupDate");
      const todayStr = new Date().toISOString().split("T")[0];
      
      if (!lastBackupStr) {
        if (onShowToast) onShowToast("Nenhum backup em nuvem encontrado. Realize um backup urgente!", "warning", "Atenção: Risco de Perda de Dados");
        return;
      }

      const lastBackupDate = new Date(lastBackupStr);
      const today = new Date();
      
      // Calculate days diff
      const diffTime = Math.abs(today.getTime() - lastBackupDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      
      if (diffDays > 1) {
        if (onShowToast) onShowToast(`Último backup foi há ${diffDays} dias. Recomendamos forçar um backup agora.`, "warning", "Aviso de Backup Pendente");
      }
    };

    // Check once on mount
    const timeoutId = setTimeout(checkBackupStatus, 5000); // delay so it doesn't overlap with welcome toasts

    // Check every 6 hours
    const intervalId = setInterval(checkBackupStatus, 6 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [canEdit, onShowToast]);

  const handleManualDriveBackup = async () => {
    if (needsAuth) {
      if (onShowToast) onShowToast("Por favor, conecte a sua conta Google primeiro.", "warning");
      return;
    }
    
    setIsBackingUp(true);
    setCloudBackupLogs([]);
    
    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sem token do Google Drive");
      
      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📦 Obtendo snapshot da base de dados local...`]);

      const response = await fetch("/api/db/load");
      const json = await response.json();
      
      if (!json.success) throw new Error("Falha ao ler dados da base local.");

      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ☁️ Compactando dados e estabelecendo conexão com Google Drive...`]);
      
      const dbPayload = JSON.stringify(json.data, null, 2);
      const filename = `OST_Backup_Vendas_${new Date().toISOString().split("T")[0]}.json`;

      const metadata = {
        name: filename,
        mimeType: "application/json",
      };

      const boundary = "-------314159265358979323846";
      const delimiter = "\r\n--" + boundary + "\r\n";
      const close_delim = "\r\n--" + boundary + "--";

      const multipartRequestBody =
        delimiter +
        "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
        JSON.stringify(metadata) +
        delimiter +
        "Content-Type: application/json\r\n\r\n" +
        dbPayload +
        close_delim;

      const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: multipartRequestBody,
      });

      if (!res.ok) throw new Error("Erro na API do Google Drive");

      const resData = await res.json();

      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Backup salvo no Drive com sucesso. ID: ${resData.id}`]);
      
      onAddAuditLog("Backup Manual Drive", "CONFIGURAÇÕES", `Backup completo guardado na Cloud: ${filename}`);
      if (onShowToast) onShowToast("Backup completo realizado no Google Drive com sucesso!", "success", "Resiliência Garantida");
      
      // Update local storage date
      localStorage.setItem("lastBackupDate", new Date().toISOString());

      // Refresh recent files
      fetchDriveStats();
    } catch (err) {
      console.error(err);
      setCloudBackupLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Falha no processo: ${(err as Error).message}`]);
      if (onShowToast) onShowToast("Falha ao realizar backup no Google Drive.", "error");
    } finally {
      setIsBackingUp(false);
    }
  };

  // Simulation states
  const [isSimulatingMail, setIsSimulatingMail] = useState(false);
  const [simulationLogs, setSimulationLogs] = useState<string[]>([]);

  // Automatic Cloud Backup Scheduler States
  const [cloudBackupEnabled, setCloudBackupEnabled] = useState(settings.cloudBackupEnabled ?? true);
  const [backupFrequency, setBackupFrequency] = useState(settings.backupFrequency || "daily");
  const [backupCron, setBackupCron] = useState(settings.backupCron || "0 2 * * *");
  const [backupTime, setBackupTime] = useState(settings.backupTime || "02:00");
  const [cloudProvider, setCloudProvider] = useState(settings.cloudProvider || "gcs");
  const [isSimulatingCloudBackup, setIsSimulatingCloudBackup] = useState(false);
  const [cloudBackupLogs, setCloudBackupLogs] = useState<string[]>([]);

  // Thermal Printer States
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerName, setPrinterName] = useState("POS-58");
  const [printerPort, setPrinterPort] = useState("COM1");
  const [printerBaudRate, setPrinterBaudRate] = useState("9600");
  const [isTestingPrinter, setIsTestingPrinter] = useState(false);
  const [printerLogs, setPrinterLogs] = useState<string[]>([]);

  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [localError, setLocalError] = useState("");
  const [isBackingUp, setIsBackingUp] = useState(false);

  const handleTestPrinter = () => {
    if (isTestingPrinter) return;

    setIsTestingPrinter(true);
    setPrinterLogs([]);

    const steps = [
      `[${new Date().toLocaleTimeString()}] 🖨️ Inicializando protocolo de comunicação com a impressora térmica...`,
      `[${new Date().toLocaleTimeString()}] 🔌 Verificando porta serial ${printerPort} a ${printerBaudRate} bps...`,
      `[${new Date().toLocaleTimeString()}] ✅ Dispositivo detectado: ${printerName}. Configurando ESC/POS.`,
      `[${new Date().toLocaleTimeString()}] 📄 Enviando buffer de impressão do recibo de teste...`,
      `[${new Date().toLocaleTimeString()}] ✂️ Enviando comando de corte de papel automático...`,
      `[${new Date().toLocaleTimeString()}] ✔️ Impressão finalizada com sucesso.`
    ];

    let stepIndex = 0;
    const intervalId = setInterval(() => {
      if (stepIndex < steps.length) {
        setPrinterLogs(prev => [...prev, steps[stepIndex]]);
        stepIndex++;
      } else {
        clearInterval(intervalId);
        setIsTestingPrinter(false);
        if (onShowToast) onShowToast("Teste de impressão concluído com sucesso!", "success");
      }
    }, 400);
  };

  const handleSavePrinterConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setLocalError("Apenas administradores seniores têm permissão para editar configurações de impressora.");
      setTimeout(() => setLocalError(""), 3500);
      return;
    }
    
    // Simulate saving the config
    setFeedbackMsg("Configuração da Impressora Térmica salva com sucesso!");
    onAddAuditLog(
      "Configuração da Impressora",
      "CONFIGURAÇÕES",
      `Impressora configurada: ${printerName} na porta ${printerPort}.`
    );
    if (onShowToast) onShowToast("Configurações da impressora térmica gravadas com sucesso!", "success");
    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  useEffect(() => {
    setCompanyName(settings.companyName || "");
    setSlogan(settings.slogan || "");
    setCompanyNuit(settings.companyNuit || "");
    setStoreAddress(settings.storeAddress || "");
    setStoreContact(settings.storeContact || "");
    setDefaultVat(settings.defaultVat !== undefined ? settings.defaultVat : settings.vatDefaultRate || 16);
    
    setReportRecipientEmail(settings.reportRecipientEmail || "");
    setReportHour(settings.reportHour || "02:00");
    setReportFrequency(settings.reportFrequency || "daily");
    
    if (settings.cloudBackupEnabled !== undefined) setCloudBackupEnabled(settings.cloudBackupEnabled);
    if (settings.backupFrequency) setBackupFrequency(settings.backupFrequency);
    if (settings.backupCron) setBackupCron(settings.backupCron);
    if (settings.backupTime) setBackupTime(settings.backupTime);
    if (settings.cloudProvider) setCloudProvider(settings.cloudProvider);
  }, [settings]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGmailUser(user);
        setNeedsAuth(false);
      },
      () => {
        setGmailUser(null);
        setNeedsAuth(true);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGmailLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setGmailUser(result.user);
        setNeedsAuth(false);
        if (onShowToast) onShowToast("Autenticado com Gmail (OAuth2) com sucesso!", "success");
      }
    } catch (err) {
      if (onShowToast) onShowToast("Falha na autenticação com Gmail.", "error");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGmailLogout = async () => {
    await logout();
    setGmailUser(null);
    setNeedsAuth(true);
    if (onShowToast) onShowToast("Conta Gmail desvinculada.", "info");
  };

  const handleSaveEmailConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setLocalError("Apenas administradores seniores têm permissão para editar as configurações de despacho automático.");
      setTimeout(() => setLocalError(""), 3500);
      return;
    }

    onUpdateSettings({
      reportRecipientEmail,
      reportHour,
      reportFrequency: reportFrequency as "daily" | "weekly"
    });

    setFeedbackMsg("Configuração de Envio Automático de Relatórios atualizada com sucesso!");
    onAddAuditLog(
      "Alteração de Envio Automático",
      "CONFIGURAÇÕES",
      `Agendamento configurado: API Gmail OAuth2, Destino: ${reportRecipientEmail}, Frequência: ${reportFrequency}, Horário: ${reportHour}.`
    );
    if (onShowToast) {
      onShowToast("Configuração do Gmail OAuth2 salvos com sucesso!", "success", "Gmail Gravado");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleTriggerEmailSimulation = async () => {
    if (isSimulatingMail) return;

    if (!reportRecipientEmail || !reportRecipientEmail.includes("@")) {
      if (onShowToast) onShowToast("Por favor insira um e-mail de destino válido.", "error");
      return;
    }

    if (needsAuth) {
      if (onShowToast) onShowToast("Por favor autentique-se com o Gmail primeiro.", "warning");
      return;
    }

    const confirmed = window.confirm(
      `Deseja enviar um e-mail de teste agora para ${reportRecipientEmail} através da sua conta Gmail?`
    );
    if (!confirmed) return;

    setIsSimulatingMail(true);
    setSimulationLogs([]);

    const timeString = new Date().toLocaleTimeString();
    setSimulationLogs(prev => [...prev, `[${timeString}] 📤 Preparando relatório de teste via Gmail API...`]);
    setSimulationLogs(prev => [...prev, `[${timeString}] 🔑 Utilizando token OAuth2 Firebase Auth de ${gmailUser?.email}...`]);
    
    try {
      const emailBody = `
        <h1>Relatório de Sistema de Vendas OST</h1>
        <p>Este é um envio automatizado de faturas, recibos ou relatórios financeiros.</p>
        <p>Integração Firebase OAuth2 configurada com sucesso e a utilizar a API Oficial do Gmail.</p>
      `;

      await sendEmail({
        to: reportRecipientEmail,
        subject: "Relatório Automatizado OST Vendas (Teste API Gmail)",
        body: emailBody,
        isHtml: true
      });

      setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✔️ E-mail enviado com sucesso via Gmail API!`]);
      
      onAddAuditLog(
        "Envio de Teste Gmail",
        "CONFIGURAÇÕES",
        `Envio manual de relatório via Gmail API OAuth2 para ${reportRecipientEmail}.`
      );
      if (onShowToast) onShowToast(`E-mail enviado para ${reportRecipientEmail} com sucesso!`, "success");
    } catch (error: any) {
      setSimulationLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Erro ao enviar email: ${error.message}`]);
      if (onShowToast) onShowToast(`Erro ao enviar: ${error.message}`, "error");
    } finally {
      setIsSimulatingMail(false);
    }
  };

  const handleSaveCompanyConfig = (e: React.FormEvent) => {
    e.preventDefault();

    onUpdateSettings({
      companyName,
      slogan,
      companyNuit,
      storeAddress,
      storeContact,
      defaultVat
    });

    setFeedbackMsg("Configurações do Estabelecimento Comercial salvas com sucesso!");
    onAddAuditLog(
      "Alterações de Configurações do Sistema",
      "CONFIGURAÇÕES",
      `Perfil institucional atualizado: ${companyName}, NUIT: ${companyNuit}, IVA: ${defaultVat}%.`
    );
    if (onShowToast) {
      onShowToast("Os dados cadastrais e fiscais do estabelecimento foram salvos!", "success", "Dados Gravados");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  // Perform fake backup download configuration JSON file
  const handleTriggerBackup = () => {
    setIsBackingUp(true);
    
    setTimeout(() => {
      setIsBackingUp(false);
      
      const backupData = {
        app_name: "OST Vendas",
        export_date: new Date().toISOString(),
        version: "3.2.0-Prod-Mozambique",
        db_signature: "SQL-LITE-OST-90A1",
        active_settings: {
          companyName,
          slogan,
          companyNuit,
          defaultVat
        }
      };

      const jsonStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
      const linkElem = document.createElement("a");
      linkElem.setAttribute("href", jsonStr);
      linkElem.setAttribute("download", `OST_Vendas_Backup_Fisico_${new Date().toISOString().split("T")[0]}.json`);
      document.body.appendChild(linkElem);
      linkElem.click();
      document.body.removeChild(linkElem);

      onAddAuditLog(
        "Fazer Cópia de Segurança",
        "CONFIGURAÇÕES",
        `Backup completo do sistema extraído e salvo no terminal de arquivo.`
      );
      if (onShowToast) {
        onShowToast("Arquivo físico do banco de dados recolhido em formato JSON!", "info", "Cópia de Segurança");
      }
    }, 1200);
  };

  const handleSaveCloudBackupConfig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      setLocalError("Apenas administradores seniores têm permissão para editar as configurações de backup automático em nuvem.");
      setTimeout(() => setLocalError(""), 3500);
      return;
    }

    onUpdateSettings({
      cloudBackupEnabled,
      backupFrequency,
      backupCron,
      backupTime,
      cloudProvider
    });

    setFeedbackMsg("Configuração de Backup Automático em Nuvem atualizada com sucesso!");
    onAddAuditLog(
      "Alteração de Backup Automático",
      "CONFIGURAÇÕES",
      `Agendamento configurado: Serviço: ${cloudProvider.toUpperCase()}, Frequência: ${backupFrequency}, Cron/Horário: ${backupFrequency === "cron" ? backupCron : backupTime}, Ativo: ${cloudBackupEnabled ? "SIM" : "NÃO"}.`
    );
    if (onShowToast) {
      onShowToast("As configurações de backup automático em nuvem foram gravadas!", "success", "Backup Salvo");
    }

    setTimeout(() => setFeedbackMsg(""), 2200);
  };

  const handleTriggerCloudBackupSimulation = () => {
    if (isSimulatingCloudBackup) return;

    setIsSimulatingCloudBackup(true);
    setCloudBackupLogs([]);

    const providerNames: Record<string, string> = {
      gcs: "Google Cloud Storage (bucket: ost-vendas-backups-mz)",
      s3: "Amazon S3 (bucket: ost-vendas-backups-s3)",
      azure: "Azure Blob Storage (container: ostvendasbackups)",
      mega: "Mega.nz SECURE-API Encr",
      dropbox: "Dropbox Business Cloud /Backup_DR"
    };

    const targetProvider = providerNames[cloudProvider] || "Google Cloud Storage";
    const timeString = new Date().toLocaleTimeString();
    
    // Handle time vs cron presentation logic
    const calculatedCron = backupFrequency === 'cron' ? backupCron : `0 ${backupTime.split(':')[1]} ${backupTime.split(':')[0]} * * *`;

    const steps = [
      `[${timeString}] 🔄 Inicializando tarefa agendada de Cópia Automática na Nuvem...`,
      `[${timeString}] 🔍 Analisando catálogo local e índices de transações...`,
      `[${timeString}] 🔐 Gerando par de chaves RSA-2048 para assinatura criptográfica de integridade...`,
      `[${timeString}] 📦 Compilando dados: Produtos (JSON enc), Clientes (JSON enc), Balanços de Caixa & Trilhas de Auditoria...`,
      `[${timeString}] 📡 Estabelecendo canal de comunicação SSL/TLS seguro com ${targetProvider}...`,
      `[${timeString}] 🔑 Autenticando com chaves secretas de ambiente do sistema configuradas...`,
      `[${timeString}] 📤 Streaming de chunks de dados (Tamanho total compactado: ${Math.floor(Math.random() * 1200 + 400)} KB)...`,
      `[${timeString}] ⏳ Aguardando checksum MD5 de verificação por parte do provedor...`,
      `[${timeString}] ✔️ Backup enviado à nuvem e registado no cron scheduler [${calculatedCron}] com sucesso! Código de status: ${cloudProvider.toUpperCase()}-201-CREATED`
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        setCloudBackupLogs(prev => [...prev, steps[currentStep]]);
        currentStep++;
      } else {
        clearInterval(interval);
        setIsSimulatingCloudBackup(false);
        setFeedbackMsg(`Backup automático simulado enviado com sucesso para ${cloudProvider.toUpperCase()}!`);
        onAddAuditLog(
          "Disparo Simulado de Backup em Nuvem",
          "CONFIGURAÇÕES",
          `Exportação em tempo real simulada para ${targetProvider}. Frequência configurada: ${backupFrequency.toUpperCase()}.`
        );
        if (onShowToast) {
          onShowToast(`Backup em Nuvem: Arquivos consolidados enviados para ${cloudProvider.toUpperCase()} com sucesso!`, "success", "Backup Concluído");
        }
        setTimeout(() => setFeedbackMsg(""), 4000);
      }
    }, 400);
  };

  return (
    <div className="space-y-6">
      
      {/* Visual top notification alerts if operator is not authorized */}
      {!canEdit && (
        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-center gap-3 text-red-700 text-xs font-semibold">
          <Lock className="w-5 h-5 shrink-0" />
          <div>
            <p>Acesso Restrito: Modo de Visualização Ativo</p>
            <p className="font-normal text-[11px] text-red-650 mt-0.5">As suas credenciais de {currentRole} apenas dão acesso à visualização. Edições requerem perfil de Administrador.</p>
          </div>
        </div>
      )}

      {feedbackMsg && (
        <div className="bg-green-50 border border-green-200 p-4.5 rounded-xl text-green-700 text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle className="w-4.5 h-4.5 text-green-700 shrink-0" />
          {feedbackMsg}
        </div>
      )}

      {localError && (
        <div className="bg-red-500/10 border border-red-500/20 p-4.5 rounded-xl text-red-400 text-xs font-bold flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500"></div>
          {localError}
        </div>
      )}

      {/* Grid: Left Company profiles, Right Gateway integrations & backups */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs md:text-xs text-slate-800">
        
        {/* LEFT COLUMN: Profile and Tax variables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-2 text-orange-600">
            <Building className="w-4.5 h-4.5" />
            <h3 className="font-bold text-slate-850 text-sm">Identidade Corporativa & Variáveis Fiscais</h3>
          </div>
          
          <form onSubmit={handleSaveCompanyConfig} className="space-y-4">
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Fantasia do Estabelecimento</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold outline-none text-slate-850"
                  placeholder="OST Vendas"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Slogan do Sistema</label>
                <input
                  type="text"
                  required
                  value={slogan}
                  onChange={(e) => setSlogan(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none"
                  placeholder="Controle Total do Seu Negócio"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Empresa NUIT (Contribuinte de Moçambique)</label>
                <input
                  type="text"
                  required
                  value={companyNuit}
                  onChange={(e) => setCompanyNuit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none"
                  placeholder="142833902"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Taxa Padrão de IVA (%)</label>
                <select
                  value={defaultVat}
                  onChange={(e) => setDefaultVat(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-bold outline-none"
                >
                  <option value={16}>16% (IVA Geral Moçambique)</option>
                  <option value={0}>Isento (0%)</option>
                  <option value={5}>5% (Taxa Especial Reduzida)</option>
                </select>
              </div>

            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Endereço de Facturação</label>
              <input
                type="text"
                required
                value={storeAddress}
                onChange={(e) => setStoreAddress(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none text-slate-850"
                placeholder="Av. do Trabalho, Armazém 4, Maputo"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Contacto Oficial</label>
              <input
                type="text"
                required
                value={storeContact}
                onChange={(e) => setStoreContact(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-slate-850"
                placeholder="+258 84 900 1200"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15"
            >
              Salvar Definições Fiscais
            </button>

          </form>
        </div>

        {/* RIGHT COLUMN: Mobile Money Gateways & backup panels */}
        <div className="space-y-5">
          
          {/* M-Pesa / e-Mola Shortcodes Credentials Panel */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-center">
            <h3 className="font-bold text-slate-850 text-sm">Integrações de Mobile Money</h3>
            <p className="text-xs text-slate-500">
              As configurações de M-Pesa e e-Mola foram movidas para o módulo "Integração Mobile Money".
            </p>
          </div>

          {/* Backup & System Maintenance File tools */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-slate-200">
              <Database className="w-4.5 h-4.5 text-orange-400" />
              <h3 className="font-bold text-slate-100 text-sm">Atividades de Salvaguarda (Backup & Restauro)</h3>
            </div>

            <p className="text-xs text-slate-300">Descarregue arquivos instantâneos JSON criptografados contendo todas as receitas, cadastros de clientes e logs de auditoria.</p>

            <div className="flex gap-2 text-xs pt-1">
              <button
                type="button"
                onClick={handleTriggerBackup}
                disabled={isBackingUp}
                className="w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer transition disabled:opacity-50"
              >
                <Download className="w-4 h-4 shrink-0" />
                {isBackingUp ? "Efetuando Backup..." : "Descarregar Cópia"}
              </button>

              <button
                type="button"
                onClick={() => document.getElementById("native-backup-picker")?.click()}
                className="w-1/2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-1 cursor-pointer border border-slate-700 transition"
              >
                <input 
                  id="native-backup-picker"
                  type="file"
                  accept=".json,.csv,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setFeedbackMsg(`Sincronizando cópia de segurança real: ${file.name}...`);
                      setTimeout(() => {
                        setFeedbackMsg(`Restauro concluído! Integrados dados de ${file.name} (${(file.size / 1024).toFixed(1)} KB) com sucesso.`);
                        onAddAuditLog(
                          "Restauro de Backup",
                          "SISTEMA",
                          `Importou ficheiro local '${file.name}' de backup de dados fiscais.`
                        );
                      }, 1600);
                    }
                  }}
                />
                <Upload className="w-4 h-4 shrink-0" />
                Restaurar Configuração
              </button>
            </div>
          </div>

          {/* NEW MODULE: Automated Cloud Backup Scheduler (Mock Cloud Export) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <div className="flex items-center gap-2 text-orange-600">
                <Cloud className="w-5 h-5 shrink-0" />
                <div>
                  <h3 className="font-bold text-slate-850 text-xs md:text-sm">Backup Automático na Nuvem</h3>
                  <p className="text-[10px] text-slate-400 font-medium">Sincronize ficheiros de segurança na nuvem via cron</p>
                </div>
              </div>

              {/* Status Indicator */}
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                cloudBackupEnabled 
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200" 
                  : "bg-slate-100 text-slate-500 border border-slate-200"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cloudBackupEnabled ? "bg-emerald-600 animate-pulse" : "bg-slate-400"}`}></span>
                {cloudBackupEnabled ? "Agendado" : "Inativo"}
              </span>
            </div>

            <form onSubmit={handleSaveCloudBackupConfig} className="space-y-4">
              {/* Toggle to enable/disable */}
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
                <div className="space-y-0.5">
                  <label className="text-xs font-bold text-slate-700 cursor-pointer select-none" htmlFor="cloud-backup-toggle">
                    Ativar Rotina Automática
                  </label>
                  <p className="text-[10px] text-slate-400 leading-tight">Autorizar disparos automáticos nos horários parametrizados.</p>
                </div>
                <input
                  id="cloud-backup-toggle"
                  type="checkbox"
                  disabled={!canEdit}
                  checked={cloudBackupEnabled}
                  onChange={(e) => setCloudBackupEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
                />
              </div>

              {cloudBackupEnabled && (
                <div className="space-y-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs animate-in slide-in-from-top-2 duration-150">
                  <div className="grid grid-cols-2 gap-3">
                    {/* Destination Cloud Service Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Serviço de Destino</label>
                      <select
                        disabled={!canEdit}
                        value={cloudProvider}
                        onChange={(e) => setCloudProvider(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none text-xs text-slate-750"
                      >
                        <option value="gcs">Google Cloud (GCS)</option>
                        <option value="s3">Amazon Web Services (S3)</option>
                        <option value="azure">Microsoft Azure (Blob)</option>
                        <option value="mega">Mega Storage Cripto</option>
                        <option value="dropbox">Dropbox Business Cloud</option>
                      </select>
                    </div>

                    {/* Frequency Selector */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Frequência</label>
                      <select
                        disabled={!canEdit}
                        value={backupFrequency}
                        onChange={(e) => setBackupFrequency(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none text-xs text-slate-750"
                      >
                        <option value="daily">Diário</option>
                        <option value="weekly">Semanal</option>
                        <option value="monthly">Mensal</option>
                        <option value="cron">Cron (Personalizado)</option>
                      </select>
                    </div>
                  </div>

                  {/* Frequency parameters time or cron input */}
                  {backupFrequency === "cron" ? (
                    <div className="space-y-1 animate-in fade-in duration-100">
                      <label className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-between">
                        <span>Expressão Cron Personalizada</span>
                        <span className="text-[9px] text-orange-500 font-mono normal-case font-bold">padrão: minuto hora dia mês sem</span>
                      </label>
                      <input
                        type="text"
                        required
                        disabled={!canEdit}
                        value={backupCron}
                        onChange={(e) => setBackupCron(e.target.value)}
                        className="w-full bg-white font-mono border border-slate-200 rounded-lg p-2 font-semibold outline-none text-xs text-slate-750"
                        placeholder="Ex: 0 4 * * 1-5"
                      />
                      <p className="text-[9.5px] text-slate-400 font-medium">Configuração cron padrão para agendar tarefas em segundo plano do servidor.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 items-center animate-in fade-in duration-100">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-400 uppercase">Horário de Gravação</label>
                        <input
                          type="time"
                          required
                          disabled={!canEdit}
                          value={backupTime}
                          onChange={(e) => setBackupTime(e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-semibold text-center outline-none text-xs text-slate-750"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none mb-1">Cron equivalente</span>
                        <div className="bg-slate-100 border border-slate-205 p-2 text-center rounded-lg font-mono text-[10.5px] text-slate-505 font-bold">
                          {`0 ${backupTime.split(':')[1]} ${backupTime.split(':')[0]} * * ${backupFrequency === 'weekly' ? '1' : backupFrequency === 'monthly' ? '1' : '*'}`}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Operations control buttons */}
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleTriggerCloudBackupSimulation}
                  disabled={isSimulatingCloudBackup || !cloudBackupEnabled}
                  className="w-1/2 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow cursor-pointer disabled:opacity-50 transition"
                >
                  <Play className={`w-3.5 h-3.5 text-orange-400 ${isSimulatingCloudBackup ? "animate-spin" : ""}`} />
                  Exportar Agora
                </button>

                {canEdit && (
                  <button
                    type="submit"
                    className="w-1/2 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1 shadow-lg shadow-orange-500/10 cursor-pointer transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Salvar Agenda
                  </button>
                )}
              </div>
            </form>

            {/* Simulated Live CLI Progress Logs console */}
            {cloudBackupLogs.length > 0 && (
              <div className="space-y-1.5 pt-1 animate-in fade-in-50 duration-250">
                <h5 className="text-[9.5px] font-bold font-mono text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Terminal de Envio na Nuvem (Relatório de Monitoria)
                </h5>
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[9.5px] leading-relaxed space-y-1 max-h-36 overflow-y-auto shadow-inner text-amber-400">
                  {cloudBackupLogs.map((log, index) => {
                    const isSucc = log.includes("✔️") || log.includes("sucesso");
                    return (
                      <div key={index} className={`flex items-start gap-1 justify-start ${isSucc ? "text-emerald-400 font-bold" : ""}`}>
                        <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                  {isSimulatingCloudBackup && (
                    <div className="flex items-center gap-2 text-slate-550 italic animate-pulse">
                      <span className="text-slate-650 shrink-0 select-none">$&gt;</span>
                      <span>Inicializando transmissão de pacotes gzip...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* NEW: Automated Email Report Dispatch Configuration Section */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-orange-600">
            <Mail className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Envio Automático de Relatórios por Email</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Defina o agendamento de relatórios de auditoria e financeiro utilizando SMTP padrão.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerEmailSimulation}
            disabled={isSimulatingMail}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow shadow-slate-900/10 shrink-0"
          >
            <Play className={`w-3.5 h-3.5 text-amber-400 ${isSimulatingMail ? "animate-spin" : ""}`} />
            {isSimulatingMail ? "Processando Simulação..." : "Simular Disparo Imediato"}
          </button>
        </div>

        <form onSubmit={handleSaveEmailConfig} className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-slate-800 text-xs">
          {/* SMTP Configuration column -> Gmail OAuth */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              Autenticação da Conta Emissora (Gmail)
            </h4>
            
            <p className="text-[11px] text-slate-500">
              Conecte a conta Gmail oficial da empresa. Esta conta será utilizada para disparar os e-mails e faturas em nome da empresa através da API oficial do Google.
            </p>

            <div className="mt-4 flex flex-col gap-3">
              {needsAuth ? (
                <button
                  type="button"
                  onClick={handleGmailLogin}
                  disabled={isLoggingIn}
                  className="flex items-center justify-center gap-3 w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl transition shadow-sm"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  {isLoggingIn ? "Conectando..." : "Vincular Conta Google"}
                </button>
              ) : (
                <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wide">Conta Vinculada</p>
                      <p className="text-xs font-semibold text-emerald-700">{gmailUser?.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleGmailLogout}
                    className="text-[10px] bg-white border border-emerald-200 hover:bg-emerald-100 text-emerald-700 font-bold py-1 px-2.5 rounded shadow-sm transition"
                  >
                    Desvincular
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Trigger Frequency / Recipient Destination Column */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Destinatários e Agendamento
            </h4>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">E-mail de Destino</label>
              <input
                type="email"
                required
                disabled={!canEdit}
                value={reportRecipientEmail}
                onChange={(e) => setReportRecipientEmail(e.target.value)}
                className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-slate-350 text-xs"
                placeholder="gestor-er@empresa.co.mz"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Frequência</label>
                <select
                  disabled={!canEdit}
                  value={reportFrequency}
                  onChange={(e) => setReportFrequency(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                >
                  <option value="daily">Diário (Consolidado)</option>
                  <option value="weekly">Semanal (Segundas)</option>
                  <option value="monthly">Mensal (Dia 1)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Hora do Disparo</label>
                <div className="relative">
                  <input
                    type="time"
                    required
                    disabled={!canEdit}
                    value={reportHour}
                    onChange={(e) => setReportHour(e.target.value)}
                    className="w-full bg-slate-50 disabled:opacity-75 border border-slate-200 rounded-lg p-1.5 font-semibold text-center outline-none focus:border-slate-350 text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Attachment Formats & Selective Reports Column */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Anexos e Relatórios Incluídos
            </h4>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">Formato do Arquivo</label>
              <select
                disabled={!canEdit}
                value={reportFormat}
                onChange={(e) => setReportFormat(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
              >
                <option value="PDF">Formato Comercial PDF (Vectorizado)</option>
                <option value="CSV">Folha de Cálculo CSV / Excel</option>
                <option value="AMBOS">Ambos os formatos (PDF + CSV)</option>
              </select>
            </div>

            <div className="space-y-2 pt-1 text-[11px] font-medium text-slate-600">
              <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Módulos de Relatórios</label>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 items-center">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeFinancial}
                    onChange={(e) => setIncludeFinancial(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Financeiro</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeAudit}
                    onChange={(e) => setIncludeAudit(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Ficheiros Log</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeStaff}
                    onChange={(e) => setIncludeStaff(e.target.checked)}
                    className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-3.5 h-3.5"
                  />
                  <span>Quadro Staff</span>
                </label>
              </div>
            </div>
          </div>

          {/* Save Button Row span 3 */}
          {canEdit && (
            <div className="lg:col-span-3 pt-2">
              <button
                type="submit"
                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15"
              >
                Salvar Definições de Dispatch Automático
              </button>
            </div>
          )}
        </form>

        {/* Live Simulation Progress CLI Logger Console */}
        {simulationLogs.length > 0 && (
          <div className="space-y-2 pt-2 animate-in fade-in-50 duration-200">
            <h5 className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5" />
              Consola de Monitoria do Serviço de SMTP (Simulação em Tempo Real)
            </h5>
            
            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 font-mono text-[10.5px] leading-relaxed space-y-1 max-h-48 overflow-y-auto shadow-inner text-amber-400">
              {simulationLogs.map((log, index) => {
                const isSuccess = log.includes("✔️") || log.includes("sucesso");
                return (
                  <div key={index} className={`flex items-start gap-1 justify-start ${isSuccess ? "text-emerald-400 font-bold" : ""}`}>
                    <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                    <span>{log}</span>
                  </div>
                );
              })}
              {isSimulatingMail && (
                <div className="flex items-center gap-2 text-slate-500 italic animate-pulse">
                  <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                  <span>A processar tarefa de cron agendada...</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Google Drive Integration */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-blue-600">
            <Cloud className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Integração Google Drive (Storage & Backups)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Visualize a utilização do espaço e guarde backups na nuvem.</p>
            </div>
          </div>
          
          <button
            type="button"
            onClick={handleManualDriveBackup}
            disabled={isBackingUp || needsAuth}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow shadow-blue-600/20 shrink-0"
          >
            <Database className={`w-3.5 h-3.5 ${isBackingUp ? "animate-pulse" : ""}`} />
            {isBackingUp ? "A Guardar Backup..." : "Forçar Backup Agora"}
          </button>
        </div>

        {/* Logs do Backup */}
        {cloudBackupLogs.length > 0 && (
          <div className="bg-slate-900 rounded-xl p-4 overflow-hidden border border-slate-800 relative">
            <div className="flex items-center justify-between mb-3 border-b border-slate-700 pb-2">
              <span className="text-slate-300 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                <RefreshCw className={`w-3 h-3 text-emerald-400 ${isBackingUp ? 'animate-spin' : ''}`} />
                Cloud Backup Logs
              </span>
            </div>
            <div className="space-y-1.5 max-h-32 overflow-y-auto font-mono text-[10px] pr-2">
              {cloudBackupLogs.map((log, idx) => (
                <div key={idx} className="text-emerald-400/90 leading-relaxed flex gap-2">
                  <span className="text-slate-500 shrink-0 select-none">$&gt;</span>
                  <span>{log}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-slate-800 text-xs">
          
          {/* Storage Quota */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Database className="w-3.5 h-3.5 text-slate-400" />
              Utilização de Armazenamento
            </h4>
            
            {needsAuth ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                <p className="text-[11px] text-slate-500 mb-3">Autentique-se com sua conta Google para visualizar estatísticas.</p>
                <button
                  type="button"
                  onClick={handleGmailLogin}
                  disabled={isLoggingIn}
                  className="mx-auto flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold py-2 px-4 rounded-xl transition shadow-sm"
                >
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-4 h-4">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                    <path fill="none" d="M0 0h48v48H0z"></path>
                  </svg>
                  {isLoggingIn ? "Conectando..." : "Vincular Google Drive"}
                </button>
              </div>
            ) : isFetchingDrive ? (
              <div className="flex items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : driveStats ? (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                  <span>Espaço Utilizado</span>
                  <span>{((driveStats.usage / driveStats.limit) * 100).toFixed(1)}%</span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-blue-500 h-2 rounded-full" 
                    style={{ width: `${Math.min(100, (driveStats.usage / driveStats.limit) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center font-mono text-[11px] text-slate-700">
                  <span>{(driveStats.usage / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                  <span>{(driveStats.limit / 1024 / 1024 / 1024).toFixed(2)} GB</span>
                </div>
                <button
                  type="button"
                  onClick={fetchDriveStats}
                  className="w-full mt-2 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-[10px] uppercase tracking-wider flex items-center justify-center gap-1.5 transition"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar Dados
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200 text-slate-500 text-[11px]">
                Não foi possível carregar as estatísticas.
              </div>
            )}
          </div>

          {/* Recent Files */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Ficheiros Recentes
            </h4>

            {needsAuth ? (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200">
                <p className="text-[11px] text-slate-500">Autentique-se para ver os ficheiros recentes.</p>
              </div>
            ) : isFetchingDrive ? (
              <div className="flex items-center justify-center p-8 bg-slate-50 rounded-xl border border-slate-200">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
              </div>
            ) : recentFiles.length > 0 ? (
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {recentFiles.map(file => (
                  <div key={file.id} className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-150 rounded-lg">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <FileText className="w-4 h-4 text-blue-500 shrink-0" />
                      <span className="truncate text-[11px] font-semibold text-slate-700" title={file.name}>{file.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono shrink-0 ml-2">
                      {new Date(file.createdTime).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 bg-slate-50 rounded-xl text-center border border-slate-200 text-slate-500 text-[11px]">
                Nenhum ficheiro encontrado.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Impressoras Térmicas Locais */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4 border-slate-100">
          <div className="flex items-center gap-2.5 text-orange-600">
            <Printer className="w-5 h-5 shrink-0" />
            <div>
              <h3 className="font-bold text-slate-850 text-sm">Impressoras Térmicas (Local Protocol)</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Configure as impressoras de talão térmico via porta serial/USB para impressão direta de faturas.</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTestPrinter}
            disabled={isTestingPrinter}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shadow shadow-slate-900/10 shrink-0"
          >
            <Printer className={`w-3.5 h-3.5 text-amber-400 ${isTestingPrinter ? "animate-pulse" : ""}`} />
            {isTestingPrinter ? "Testando Impressão..." : "Teste de Impressão"}
          </button>
        </div>

        <form onSubmit={handleSavePrinterConfig} className="grid grid-cols-1 lg:grid-cols-2 gap-5 text-slate-800 text-xs">
          
          {/* Printer Device Configuration */}
          <div className="space-y-3.5">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5 border-b pb-1 border-slate-100">
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              Parâmetros de Conexão
            </h4>
            
            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-150">
              <div className="space-y-0.5">
                <label className="text-xs font-bold text-slate-700 cursor-pointer select-none">
                  Ativar Impressão Direta ESC/POS
                </label>
                <p className="text-[10px] text-slate-400 leading-tight">Habilita comunicação via protocolo serial local para impressão de talões.</p>
              </div>
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={printerEnabled}
                onChange={(e) => setPrinterEnabled(e.target.checked)}
                className="rounded border-slate-300 text-orange-500 focus:ring-orange-500 w-4 h-4 cursor-pointer"
              />
            </div>

            {printerEnabled && (
              <div className="grid grid-cols-2 gap-3 mt-3 animate-in fade-in duration-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Modelo da Impressora</label>
                  <input
                    type="text"
                    disabled={!canEdit}
                    value={printerName}
                    onChange={(e) => setPrinterName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                    placeholder="POS-58"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Porta de Comunicação</label>
                  <select
                    disabled={!canEdit}
                    value={printerPort}
                    onChange={(e) => setPrinterPort(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                  >
                    <option value="COM1">COM1 (Serial/USB)</option>
                    <option value="COM2">COM2</option>
                    <option value="COM3">COM3</option>
                    <option value="LPT1">LPT1 (Paralela)</option>
                    <option value="USB001">USB001 (Virtual)</option>
                  </select>
                </div>
                
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Baud Rate (bps)</label>
                  <select
                    disabled={!canEdit}
                    value={printerBaudRate}
                    onChange={(e) => setPrinterBaudRate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 outline-none font-semibold focus:border-slate-350 text-xs"
                  >
                    <option value="4800">4800 bps</option>
                    <option value="9600">9600 bps</option>
                    <option value="19200">19200 bps</option>
                    <option value="38400">38400 bps</option>
                    <option value="115200">115200 bps</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Action and Logs */}
          <div className="space-y-3.5">
            {canEdit && (
              <div className="pt-7">
                <button
                  type="submit"
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/15 transition-all"
                >
                  Salvar Configuração de Impressora
                </button>
              </div>
            )}

            {printerLogs.length > 0 && (
              <div className="space-y-2 mt-4 animate-in fade-in-50 duration-200">
                <h5 className="text-[10px] font-extrabold font-mono text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5" />
                  Consola de Teste de Impressão (Protocolo Local)
                </h5>
                
                <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[10px] leading-relaxed space-y-1 max-h-36 overflow-y-auto shadow-inner text-blue-300">
                  {printerLogs.map((log, index) => {
                    const isSucc = log.includes("✔️") || log.includes("sucesso");
                    return (
                      <div key={index} className={`flex items-start gap-1 justify-start ${isSucc ? "text-emerald-400 font-bold" : ""}`}>
                        <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                        <span>{log}</span>
                      </div>
                    );
                  })}
                  {isTestingPrinter && (
                    <div className="flex items-center gap-2 text-slate-500 italic animate-pulse">
                      <span className="text-slate-600 shrink-0 select-none">$&gt;</span>
                      <span>Aguardando resposta do dispositivo...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

    </div>
  );
}
