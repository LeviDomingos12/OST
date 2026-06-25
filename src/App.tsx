import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  initialProducts, 
  initialCustomers, 
  generateMockTransactions, 
  initialCashFlow, 
  initialEmployees, 
  initialAuditLogs, 
  defaultSettings, 
  masterclassVideos 
} from "./data/mockData";
import { 
  Product, 
  Customer, 
  Transaction, 
  CashFlowEntry, 
  Employee, 
  AuditLog, 
  SystemSettings, 
  UserRole 
} from "./types";

// Import modules
import Sidebar from "./components/Sidebar";
import POSModule from "./components/POSModule";
import DashboardModule from "./components/DashboardModule";
import CashRegisterModule from "./components/CashRegisterModule";
import StockModule from "./components/StockModule";
import CustomersModule from "./components/CustomersModule";
import StaffModule from "./components/StaffModule";
import ReportsModule from "./components/ReportsModule";
import TrainingModule from "./components/TrainingModule";
import SettingsModule from "./components/SettingsModule";
import GatewayModule from "./components/GatewayModule";
import { testConnection } from "./lib/firebase";

import { 
  Activity, 
  Sparkles, 
  TrendingUp, 
  RefreshCw, 
  Sun, 
  Moon,
  CheckCircle,
  XCircle,
  AlertCircle,
  X
} from "lucide-react";

interface Toast {
  id: string;
  title: string;
  message: string;
  type: "success" | "error" | "info" | "warning";
}

export default function App() {
  
  // SHARED STATES
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info", title?: string) => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const defaultTitles = {
      success: "Operação Concluída",
      error: "Ocorreu um Erro",
      info: "Informação do Sistema",
      warning: "Aviso de Segurança"
    };
    const newToast: Toast = {
      id,
      message,
      type,
      title: title || defaultTitles[type]
    };
    setToasts(prev => [...prev, newToast]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowEntry[]>([]);
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<SystemSettings>(defaultSettings);
  const [isDbLoaded, setIsDbLoaded] = useState(false);

  // ACTIVE OPERATOR & ROUTING STUFF
  const [activeUser, setActiveUser] = useState<Employee>(initialEmployees[0]); // Levi Domingos (Admin) (Default on launch)
  const [activeTab, setActiveTab] = useState<string>("DASHBOARD");

  // Premium AI predictions state
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<any | null>(null);

  const currency = "MT"; // Meticais Moçambique

  // Theme state defaulting to night (elegant dark mode)
  const [theme, setTheme] = useState<"daily" | "night">("night");

  // DB Sync helper
  const syncTable = async (tableName: string, updatedData: any) => {
    try {
      await fetch("/api/db/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: tableName, data: updatedData })
      });
    } catch (err) {
      console.error(`Erro ao sincronizar tabela ${tableName} com a base de dados central:`, err);
    }
  };

  // Hydrate states from existential server database on mount
  useEffect(() => {
    // Run the mandatory Firebase Firestore direct browser connection verification
    testConnection();

    const fetchExistentialDb = async () => {
      try {
        const response = await fetch("/api/db/load");
        const json = await response.json();
        if (json.success && json.hasData) {
          const d = json.data;
          if (d.products) setProducts(d.products);
          else setProducts(initialProducts);

          if (d.customers) setCustomers(d.customers);
          else setCustomers(initialCustomers);

          if (d.transactions) setTransactions(d.transactions);
          else setTransactions(generateMockTransactions());

          if (d.cashflow) setCashFlow(d.cashflow);
          else setCashFlow(initialCashFlow);

          if (d.employees) {
            setEmployees(d.employees);
            setActiveUser(d.employees[0]);
          } else {
            setEmployees(initialEmployees);
            setActiveUser(initialEmployees[0]);
          }

          if (d.auditlogs) setAuditLogs(d.auditlogs);
          else setAuditLogs(initialAuditLogs);

          if (d.settings) setSettings(d.settings);
          else setSettings(defaultSettings);

          console.log("Banco de dados existencial carregado com sucesso.");
        } else {
          // Empty or first boot, submit initial structures to seed the server
          console.log("Banco de dados vazio. Semeando tabelas padrão no servidor...");
          const placeholderTransactions = generateMockTransactions();
          await fetch("/api/db/save-all", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              products: initialProducts,
              customers: initialCustomers,
              transactions: placeholderTransactions,
              cashflow: initialCashFlow,
              employees: initialEmployees,
              auditlogs: initialAuditLogs,
              settings: defaultSettings
            })
          });
          setProducts(initialProducts);
          setCustomers(initialCustomers);
          setTransactions(placeholderTransactions);
          setCashFlow(initialCashFlow);
          setEmployees(initialEmployees);
          setAuditLogs(initialAuditLogs);
          setSettings(defaultSettings);
        }
      } catch (err) {
        console.warn("Servidor inativo ou inacessível. Recuando para mock local:", err);
        setProducts(initialProducts);
        setCustomers(initialCustomers);
        setTransactions(generateMockTransactions());
        setCashFlow(initialCashFlow);
        setEmployees(initialEmployees);
        setAuditLogs(initialAuditLogs);
        setSettings(defaultSettings);
      } finally {
        setIsDbLoaded(true);
      }
    };
    fetchExistentialDb();
  }, []);

  useEffect(() => {
    if (theme === "night") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
  }, [theme]);

  // Quick Switch Operator Handlers
  const handleChangeRole = async (role: UserRole) => {
    // find a fitting mock employee or create template
    const fitEmp = employees.find(e => {
      if (role === "ADMIN") return e.role.toUpperCase().includes("GESTOR") || e.role.toUpperCase().includes("ADMINISTRADOR");
      if (role === "SUPERVISOR") return e.role.toUpperCase().includes("SUPERVISOR");
      return e.role.toUpperCase().includes("CAIXA") || e.role.toUpperCase().includes("VENDEDOR");
    });
    
    if (fitEmp) {
      setActiveUser(fitEmp);
      let ipStr = "IP Desconhecido";
      try {
        const res = await fetch("https://api.ipify.org?format=json");
        const data = await res.json();
        if (data && data.ip) {
          ipStr = data.ip;
        }
      } catch (e) {
        console.warn("Could not fetch IP", e);
      }
      
      handleAddAuditLog(
        "Alternância de Operador",
        "SISTEMA",
        `Sessão iniciada como ${fitEmp.name} (Perfil: ${fitEmp.role}). IP: ${ipStr}`
      );
    }
  };

  // GENERAL AUDIT LOGGING WRAPPER
  const handleAddAuditLog = (action: string, module: string, details: string) => {
    let authRole: UserRole = "CASHIER";
    const raw = activeUser.role.toLowerCase();
    if (raw.includes("supervisor")) authRole = "SUPERVISOR";
    else if (raw.includes("administrador") || raw.includes("gestor")) authRole = "ADMIN";

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: activeUser.name,
      userRole: authRole,
      action,
      module,
      details
    };
    setAuditLogs(prev => {
      const updated = [...prev, newLog];
      syncTable("auditlogs", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - PRODUCTS
  const handleAddProduct = (newP: Product) => {
    setProducts(prev => {
      const updated = [newP, ...prev];
      syncTable("products", updated);
      return updated;
    });
  };
  const handleUpdateProduct = (updatedP: Product) => {
    setProducts(prev => {
      const updated = prev.map(p => p.id === updatedP.id ? updatedP : p);
      syncTable("products", updated);
      return updated;
    });
  };
  const handleDeleteProduct = (productId: string) => {
    setProducts(prev => {
      const updated = prev.filter(p => p.id !== productId);
      syncTable("products", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - CUSTOMERS
  const handleAddCustomer = (newC: Customer) => {
    setCustomers(prev => {
      const updated = [newC, ...prev];
      syncTable("customers", updated);
      return updated;
    });
  };
  const handleDeleteCustomer = (customerId: string) => {
    setCustomers(prev => {
      const updated = prev.filter(c => c.id !== customerId);
      syncTable("customers", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - CASH FLOW
  const handleAddCashFlowEntry = (newEntry: CashFlowEntry) => {
    setCashFlow(prev => {
      const updated = [...prev, newEntry];
      syncTable("cashflow", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - EMPLOYEES
  const handleAddEmployee = (newEmp: Employee) => {
    setEmployees(prev => {
      const updated = [newEmp, ...prev];
      syncTable("employees", updated);
      return updated;
    });
  };

  // CENTRAL MUTATION HOOKS - SETTINGS
  const handleUpdateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      syncTable("settings", updated);
      return updated;
    });
  };

  // CENTRAL POS SALES TRANSACTION COMPLETION
  const handleCompleteSaleAction = (transaction: Transaction) => {
    // 1. Add to general transactions history list
    setTransactions(prev => {
      const updated = [transaction, ...prev];
      syncTable("transactions", updated);
      return updated;
    });

    // 2. Dynamic stock levels deduction ("Abate de Stock")
    setProducts(prevProducts => {
      const updated = prevProducts.map(prod => {
        const cartItemMatch = transaction.items.find(item => item.productId === prod.id);
        if (cartItemMatch) {
          const updatedStock = Math.max(0, prod.stock - cartItemMatch.quantity);
          return {
            ...prod,
            stock: updatedStock
          };
        }
        return prod;
      });
      syncTable("products", updated);
      return updated;
    });

    // 3. Update customer loyalty points accumulated
    if (transaction.customerId && transaction.customerId !== "WALK_IN") {
      setCustomers(prevCustomers => {
        const updated = prevCustomers.map(cust => {
          if (cust.id === transaction.customerId) {
            const addedPoints = Math.floor(transaction.grandTotal / 100); // 1 point every 100 MT
            return {
              ...cust,
              totalSpent: cust.totalSpent + transaction.grandTotal,
              purchaseCount: cust.purchaseCount + 1,
              loyaltyPoints: cust.loyaltyPoints + addedPoints,
              lastPurchaseDate: new Date().toLocaleDateString(),
              debt: transaction.paymentMethod === "DEBT" ? (cust.debt || 0) + transaction.grandTotal : cust.debt
            };
          }
          return cust;
        });
        syncTable("customers", updated);
        return updated;
      });
    }

    // 4. Record strict auditor trace logs
    handleAddAuditLog(
      "Completar Transação de POS",
      "VENDAS",
      `Fatura ${transaction.invoiceNumber} processada. Cliente: ${transaction.customerName}, Método: ${transaction.paymentMethod}. Total Pago: ${transaction.grandTotal} MT. Abate de Stock concluído.`
    );
  };

  // Trigger Gemini AI sales forecasting
  const handleTriggerAIForecast = async () => {
    setIsGeneratingForecast(true);
    setForecastResult(null);

    // Prepare critical low level stock summary
    const criticalStock = products
      .filter(p => p.stock <= p.minStock)
      .map(p => ({ sku: p.code, item: p.name, stock: p.stock }));

    // Prepare sales history summary
    const salesSummary = transactions.slice(0, 15).map(t => ({
      invoice: t.invoiceNumber,
      total: t.grandTotal,
      cashier: t.cashierName
    }));

    try {
      const response = await fetch("/api/gemini/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          salesHistory: salesSummary,
          inventoryStatus: criticalStock,
          businessType: settings.companyName
        })
      });
      const data = await response.json();
      setForecastResult(data);
    } catch {
      // Offline fallback
      setForecastResult({
        forecastText: `### **Análise Prematura de Previsão de Vendas (Modo Simulação)**
        
Com base no histórico fornecido de vendas para o seu negócio de **${settings.companyName}**:

1. **Tendência de Crescimento**: Projetamos um aumento aproximado de **18%** nas vendas para o próximo período devido a padrões sazonais identificados nos produtos mais vendidos.
2. **Produtos Críticos**: Itens com stock baixo (especialmente categorias eletrónicas ou mercearia) sofrem risco elevado de rutura. Recomendamos reabastecer com urgência para evitar perda de clientes.
3. **Plano de Ação Sugerido**:
   * Lance uma campanha promocional de Laurentina ou Arroz Chicualacuala.
   * Ative o programa de fidelização enviando SMS automatizadas de agradecimento.
   * Forneça opções céleres de recebimento M-Pesa.`,
        growthRate: 18,
        growthTrend: "up",
        suggestedCampaigns: [
          "Super Promo Laurentina 2M",
          "Arroz Chicualacuala Direct",
          "Desconto Especial no M-Pesa"
        ]
      });
    } finally {
      setIsGeneratingForecast(false);
    }
  };

  // Translate employees role to fit authorization hooks
  const simplifiedRole: UserRole = useMemo(() => {
    const raw = activeUser.role.toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) return "CASHIER";
    if (raw.includes("supervisor")) return "SUPERVISOR";
    return "ADMIN";
  }, [activeUser]);

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === "night" ? "bg-zinc-950 text-slate-200" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* Visual background atmospheric touch for elegant negative spacing aesthetics */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Main sidebar on the left */}
      <Sidebar
        currentRole={simplifiedRole}
        onChangeRole={handleChangeRole}
        activeModule={activeTab.toLowerCase()}
        onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
        companyName={settings.companyName}
      />

      {/* Outer body wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        
        {/* TOP COMPACT STATUS BAR BRAND BANNER */}
        <header className={`border-b h-16 px-6 shrink-0 flex items-center justify-between shadow-md backdrop-blur-md relative z-20 transition-all ${
          theme === "night" ? "bg-zinc-950/50 border-zinc-800/80" : "bg-white border-slate-200"
        }`}>
          
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-amber-500 rounded-full animate-ping"></span>
            
            <h1 className={`font-extrabold text-sm tracking-tight flex items-center gap-1.5 uppercase ${
              theme === "night" ? "text-white" : "text-slate-800"
            }`}>
              {settings.companyName}
              <span className={`border text-[10px] px-1.5 py-0.5 rounded-full font-mono normal-case font-medium ${
                theme === "night" ? "bg-zinc-900 border-zinc-800 text-slate-300" : "bg-slate-100 border-slate-200 text-slate-500"
              }`}>{settings.slogan}</span>
            </h1>
          </div>

          <div className="flex items-center gap-3.5 text-xs">
            {/* System Clock & credentials telemetry */}
            <div className={`hidden md:flex items-center gap-3.5 font-mono text-[10.5px] ${
              theme === "night" ? "text-slate-400" : "text-slate-500"
            }`}>
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-amber-500" />
                Sessão Segura Activa
              </span>
              <span>•</span>
              <span className={`border px-2.5 py-0.5 rounded font-extrabold ${
                theme === "night" ? "bg-amber-500/10 border-amber-500/25 text-amber-400" : "bg-amber-50 border-amber-200 text-amber-600"
              }`}>{settings.companyNuit} / NUIT</span>
            </div>

            {/* Daily/Night Theme Switcher Custom Widget */}
            <button
              onClick={() => setTheme(theme === "daily" ? "night" : "daily")}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border transition-all cursor-pointer text-[11px] font-bold ${
                theme === "night" 
                  ? "bg-zinc-900 border-zinc-800 text-amber-500 hover:text-amber-400" 
                  : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
              }`}
              title="Alternar Layout de Tema"
            >
              {theme === "daily" ? (
                <>
                  <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: "10s" }} />
                  <span>Modo Dia</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-450 fill-amber-400/25" />
                  <span>Modo Noite</span>
                </>
              )}
            </button>

            {/* Active user status pill */}
            <div className={`flex items-center gap-2 p-1.5 rounded-xl border ${
              theme === "night" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"
            }`}>
              <span className="w-5 h-5 rounded-lg bg-amber-500 text-zinc-950 flex items-center justify-center font-bold text-[10px]">
                {activeUser.name.substring(0, 2).toUpperCase()}
              </span>
              <div className="text-left leading-none">
                <p className={`font-extrabold text-[10.5px] leading-tight ${
                  theme === "night" ? "text-slate-200" : "text-slate-800"
                }`}>{activeUser.name}</p>
                <p className={`text-[9px] italic mt-0.5 ${
                  theme === "night" ? "text-slate-400" : "text-slate-500"
                }`}>{activeUser.role}</p>
              </div>
            </div>
          </div>

        </header>

        {/* INNER SCROLLABLE WORKPORT PANEL CONTENT */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="h-full"
            >
              
              {/* POS DIRECT CHECKOUT */}
              {activeTab === "POS" && (
                <POSModule
                  products={products}
                  customers={customers}
                  onCompleteSale={handleCompleteSaleAction}
                  activeUsername={activeUser.name}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                />
              )}

              {/* STATS ANALYTICS CONTROL PANEL */}
              {activeTab === "DASHBOARD" && (
                <DashboardModule
                  transactions={transactions}
                  products={products}
                  customers={customers}
                  cashFlow={cashFlow}
                  currency={currency}
                  onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
                />
              )}

              {/* DAILY BOOK BALANCE CASH OPERATIONS */}
              {activeTab === "CASH" && (
                <CashRegisterModule
                  cashFlow={cashFlow}
                  transactions={transactions}
                  onAddCashFlowEntry={handleAddCashFlowEntry}
                  activeUsername={activeUser.name}
                  currentRole={simplifiedRole}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                />
              )}

              {/* ACTIVE STOCK INVENTORY MANAGER */}
              {activeTab === "STOCK" && (
                <StockModule
                  products={products}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                />
              )}

              {/* CUSTOMER LOYALTY CRM & MARKETING SMS */}
              {(activeTab === "CUSTOMERS" || activeTab === "CLIENTES") && (
                <CustomersModule
                  customers={customers}
                  onAddCustomer={handleAddCustomer}
                  onUpdateCustomer={(updatedC) => {
                    setCustomers(prev => {
                      const updated = prev.map(c => c.id === updatedC.id ? updatedC : c);
                      syncTable("customers", updated);
                      return updated;
                    });
                  }}
                  onAddCashFlowEntry={handleAddCashFlowEntry}
                  onDeleteCustomer={handleDeleteCustomer}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  activeUsername={activeUser.name}
                  currency={currency}
                  onShowToast={showToast}
                />
              )}

              {/* STAFF EMPLOYEES & SECURITY TRAIL AUDITOR */}
              {activeTab === "STAFF" && (
                <StaffModule
                  employees={employees}
                  auditLogs={auditLogs}
                  onAddEmployee={handleAddEmployee}
                  activeUsername={activeUser.name}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                />
              )}

              {/* REVENUE PREDICTION AI PANEL */}
              {activeTab === "AI" && (
                <div className="space-y-6 animate-in fade-in duration-200">
                  
                  {/* Title card */}
                  <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 flex flex-col md:flex-row gap-5 justify-between items-start md:items-center">
                    <div className="space-y-1 max-w-xl">
                      <span className="text-[10px] text-orange-400 font-extrabold uppercase tracking-widest font-mono">OST Vendas AI Smart</span>
                      <h2 className="text-xl font-bold flex items-center gap-1.5">
                        <Sparkles className="w-5 h-5 text-orange-400 animate-pulse" />
                        Smart Sales forecasting & Business Assistant
                      </h2>
                      <p className="text-xs text-slate-300 leading-relaxed font-sans">
                        Gerador de prognósticos inteligentes baseado no modelo <strong>Gemini 3.5 Flash</strong>. O assistente lê o seu histórico corrente de faturamento e níveis mínimos de stock em tempo real para projetar desvios e oportunidades comerciais.
                      </p>
                    </div>

                    <button
                      onClick={handleTriggerAIForecast}
                      disabled={isGeneratingForecast}
                      className="bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition shrink-0 shadow-lg shadow-orange-500/10"
                    >
                      <RefreshCw className={`w-4 h-4 ${isGeneratingForecast ? "animate-spin" : ""}`} />
                      {isGeneratingForecast ? "Consultando Gemini..." : "Gerar Relatório de Previsão"}
                    </button>
                  </div>

                  {/* Main results visual container */}
                  {forecastResult && forecastResult.forecastText ? (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                      
                      {/* Forecast details box */}
                      <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                        <h3 className="font-bold text-slate-850 text-sm">Relatório Generativo Provisório</h3>
                        
                        <div className="prose prose-slate prose-xs max-w-none text-xs text-slate-650 leading-relaxed space-y-2.5 border-t border-slate-100 pt-3">
                          {(forecastResult.forecastText || "").split("\n\n").map((para: string, idx: number) => {
                            if (para.startsWith("###")) {
                              return <h4 key={idx} className="font-bold text-slate-900 text-xs mt-2">{para.replace(/###\s*/, "")}</h4>;
                            }
                            return <p key={idx}>{para}</p>;
                          })}
                        </div>
                      </div>

                      {/* Side cards of campaigns recommendations */}
                      <div className="space-y-4">
                        
                        <div className="bg-slate-950 text-white p-5 rounded-2xl border border-slate-850 space-y-3 shadow-lg">
                          <span className="text-[9.5px] uppercase font-mono tracking-wider font-extrabold text-orange-400 block">Tendência Identificada</span>
                          
                          <div className="flex justify-between items-baseline">
                            <h4 className="text-3xl font-extrabold font-mono text-orange-400">
                              {forecastResult.growthTrend === "up" ? "+" : ""}{forecastResult.growthRate ?? 0}%
                            </h4>
                            <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded font-bold uppercase font-sans">
                              {forecastResult.growthTrend === "up" ? "Crescer" : "Declinar"}
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-400 leading-tight">Taxa estimada para as próximas 4 semanas fiscais calculada sobre a média flutuante de transações.</p>
                        </div>

                        <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3.5">
                          <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1">
                            <TrendingUp className="w-4 h-4 text-orange-500" />
                            Campanhas de Reabastecimento Sugeridas
                          </h4>

                          <ul className="space-y-2 text-xs text-slate-600">
                            {(forecastResult.suggestedCampaigns || []).map((camp: string, ind: number) => (
                              <li key={ind} className="p-2 bg-slate-50 border border-slate-150 rounded-lg font-semibold flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-850 text-[10px] flex items-center justify-center font-bold font-mono">
                                  {ind + 1}
                                </span>
                                {camp}
                              </li>
                            ))}
                          </ul>
                        </div>

                      </div>

                    </div>
                  ) : (
                    <div className="border border-slate-200 bg-white p-16 text-center text-xs text-slate-400 italic rounded-2xl flex flex-col items-center justify-center gap-2.5 shadow-sm">
                      <Sparkles className="w-10 h-10 text-slate-350 animate-pulse" />
                      <div>
                        <p className="font-bold text-slate-705 font-sans not-italic">Nenhum Prognóstico Comercial Gerado</p>
                        <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto leading-normal">
                          Clique em "Gerar Relatório de Previsão" no topo direito para acionar os algoritmos neurais do Gemini e analisar faturas consolidando stock e tendências.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* FINANCIAL REPORTS & SMTP TRIGGERS */}
              {activeTab === "REPORTS" && (
                <ReportsModule
                  transactions={transactions}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                />
              )}

              {/* TUTORIAL LESSONS CENTER */}
              {activeTab === "TRAINING" && (
                <TrainingModule
                  videos={masterclassVideos}
                  currency={currency}
                />
              )}

              {/* COMPANY GENERAL IDENTITIES AND MAIN SETTINGS */}
              {activeTab === "SETTINGS" && (
                <SettingsModule
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  onShowToast={showToast}
                />
              )}

              {/* GATEWAY INTEGRATION PANEL */}
              {activeTab === "GATEWAY" && (
                <GatewayModule
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  onShowToast={showToast}
                />
              )}

            </motion.div>
          </AnimatePresence>
        </main>

      </div>

      {/* Toast Notifications Overlay Container */}
      <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={`p-4 rounded-xl border shadow-lg pointer-events-auto flex gap-3 relative overflow-hidden backdrop-blur-md ${
                theme === "night"
                  ? "bg-zinc-950/95 border-zinc-850/80 text-slate-100 shadow-zinc-950/45"
                  : "bg-white/95 border-slate-200 text-slate-800 shadow-slate-200/40"
              }`}
            >
              {/* Vertical side glow indicator bar according to toast type */}
              <div
                className={`absolute top-0 left-0 bottom-0 w-1.5 ${
                  t.type === "success"
                    ? "bg-emerald-500"
                    : t.type === "error"
                    ? "bg-rose-500"
                    : t.type === "warning"
                    ? "bg-amber-500"
                    : "bg-blue-500"
                }`}
              />

              {/* Icon selection dynamically */}
              <div className="mt-0.5 shrink-0">
                {t.type === "success" && (
                  <CheckCircle className="w-5 h-5 text-emerald-500" />
                )}
                {t.type === "error" && (
                  <XCircle className="w-5 h-5 text-rose-500" />
                )}
                {t.type === "warning" && (
                  <AlertCircle className="w-5 h-5 text-amber-500" />
                )}
                {t.type === "info" && (
                  <Activity className="w-5 h-5 text-blue-500" />
                )}
              </div>

              {/* Contents block */}
              <div className="flex-1 pr-6">
                <h4 className="font-extrabold text-xs tracking-tight uppercase">
                  {t.title}
                </h4>
                <p className={`text-[11px] mt-1 pr-1 font-semibold leading-relaxed ${
                  theme === "night" ? "text-slate-350" : "text-slate-550"
                }`}>
                  {t.message}
                </p>
              </div>

              {/* Manual Close Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className={`absolute top-3 right-3 p-1 rounded-lg transition-colors cursor-pointer ${
                  theme === "night"
                    ? "hover:bg-zinc-900 text-slate-400 hover:text-white"
                    : "hover:bg-slate-100 text-slate-400 hover:text-slate-900"
                }`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
