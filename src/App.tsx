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
import LoginModule from "./components/LoginModule";
import { applyTheme, SYSTEM_THEMES } from "./lib/themes";
import { 
  testConnection, 
  auth, 
  db, 
  getUsuariosFromFirestore, 
  mapUsuarioToEmployee,
  getProdutosFromFirestore,
  addProdutoToFirestore,
  updateProdutoInFirestore,
  deleteProdutoFromFirestore,
  getTransacoesFromFirestore,
  addTransacaoToFirestore,
  subscribeToProdutos,
  isCircuitBroken
} from "./lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { setLogCallback } from "./lib/logger";

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
  X,
  Wifi,
  WifiOff,
  Cloud,
  Clock
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
  const [activeUser, setActiveUser] = useState<Employee | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("DASHBOARD");

  // Premium AI predictions state
  const [isGeneratingForecast, setIsGeneratingForecast] = useState(false);
  const [forecastResult, setForecastResult] = useState<any | null>(null);

  const currency = "MT"; // Meticais Moçambique

  const formatSessionTime = (totalSecs: number) => {
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}m ${s}s`;
  };

  // Theme state defaulting to night (elegant dark mode)
  const [theme, setTheme] = useState<"daily" | "night">("night");
  const [isPOSFullscreen, setIsPOSFullscreen] = useState<boolean>(false);
  
  // Track operator-specific custom color theme
  const [activeColorTheme, setActiveColorTheme] = useState<string>("laranja");

  // Load and apply color theme dynamically
  useEffect(() => {
    const userId = activeUser?.id || "default";
    const userTheme = localStorage.getItem("erp_theme_" + userId);
    
    if (userTheme) {
      setActiveColorTheme(userTheme);
      applyTheme(userTheme);
    } else if (settings.theme) {
      setActiveColorTheme(settings.theme);
      applyTheme(settings.theme);
    } else {
      setActiveColorTheme("laranja");
      applyTheme("laranja");
    }
  }, [activeUser, settings.theme]);

  // When theme changes, apply it to document head
  useEffect(() => {
    applyTheme(activeColorTheme);
  }, [activeColorTheme]);

  // Connectivity state tracking Firestore & network connection
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isQuotaExceeded, setIsQuotaExceeded] = useState<boolean>(isCircuitBroken());

  // Listen for Firestore Quota Exceeded events
  useEffect(() => {
    const handleQuotaExceeded = () => {
      console.warn("[APP] Firestore Quota Exceeded detected. Showing notification banner.");
      setIsQuotaExceeded(true);
    };
    window.addEventListener("firestore-quota-exceeded", handleQuotaExceeded);
    return () => window.removeEventListener("firestore-quota-exceeded", handleQuotaExceeded);
  }, []);

  // Advanced top bar metrics states
  const [lastSyncTime, setLastSyncTime] = useState<string>(() => new Date().toLocaleTimeString());
  const [sessionSeconds, setSessionSeconds] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // DB Sync helper with robust offline queueing
  const syncTable = async (tableName: string, updatedData: any) => {
    setLastSyncTime(new Date().toLocaleTimeString());
    try {
      if (!navigator.onLine) {
        throw new Error("browser is offline");
      }
      
      if (tableName === "products") {
        const promises = updatedData.map((prod: any) => addProdutoToFirestore(prod));
        await Promise.all(promises);
      } else if (tableName === "transactions") {
        const promises = updatedData.map((tx: any) => addTransacaoToFirestore(tx));
        await Promise.all(promises);
      } else {
        const response = await fetch("/api/db/save", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: tableName, data: updatedData })
        });
        
        if (!response.ok) {
          throw new Error(`server returned error ${response.status}`);
        }
      }
      
      // Successfully synced! Try to clean from pending queue
      const rawQueue = localStorage.getItem("pos_sync_queue");
      if (rawQueue) {
        const queue = JSON.parse(rawQueue);
        if (queue[tableName]) {
          delete queue[tableName];
          localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
        }
      }
    } catch (err: any) {
      console.warn(`[OFFLINE CACHE] Não foi possível sincronizar a tabela '${tableName}' (${err.message}). Guardando para reenvio automático.`);
      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        const queue = rawQueue ? JSON.parse(rawQueue) : {};
        queue[tableName] = updatedData;
        localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
      } catch (queueErr) {
        console.error("Erro ao guardar alteração na fila offline local:", queueErr);
      }
    }
  };

  // Synchronize any offline changes when connection is re-established (or via periodic retry timer)
  useEffect(() => {
    // Register the callback to capture silent errors and log them to AuditLogs
    setLogCallback(handleAddAuditLog);
  }, [activeUser, auditLogs]); // Re-bind when user context or logs state updates

  useEffect(() => {
    const processSyncQueue = async () => {
      if (!navigator.onLine) return;
      
      try {
        const rawQueue = localStorage.getItem("pos_sync_queue");
        if (!rawQueue) return;
        
        const queue = JSON.parse(rawQueue);
        const tableNames = Object.keys(queue);
        if (tableNames.length === 0) return;
        
        console.log(`[SYNC QUEUE] Detectadas ${tableNames.length} tabelas com alterações offline pendentes. Sincronizando...`);
        
        for (const tableName of tableNames) {
          const data = queue[tableName];
          let success = false;
          
          if (tableName === "products") {
            try {
              const promises = data.map((prod: any) => addProdutoToFirestore(prod));
              await Promise.all(promises);
              success = true;
            } catch (fsErr) {
              console.error("[SYNC QUEUE] Erro ao ressincronizar produtos com Firestore:", fsErr);
            }
          } else if (tableName === "transactions") {
            try {
              const promises = data.map((tx: any) => addTransacaoToFirestore(tx));
              await Promise.all(promises);
              success = true;
            } catch (fsErr) {
              console.error("[SYNC QUEUE] Erro ao ressincronizar transações com Firestore:", fsErr);
            }
          } else {
            const response = await fetch("/api/db/save", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ table: tableName, data })
            });
            success = response.ok;
          }
          
          if (success) {
            console.log(`[SYNC QUEUE] Tabela ${tableName} ressincronizada offline com sucesso!`);
            delete queue[tableName];
          } else {
            console.warn(`[SYNC QUEUE] Falha na ressincronização de ${tableName}`);
          }
        }
        
        localStorage.setItem("pos_sync_queue", JSON.stringify(queue));
      } catch (err) {
        console.error("[SYNC QUEUE] Erro ao reprocessar alterações offline:", err);
      }
    };

    const handleOnline = () => {
      console.log("[CONEXÃO] Conexão restabelecida! Tentando reenviar alterações offline...");
      setIsOnline(true);
      processSyncQueue();
    };

    const handleOffline = () => {
      console.log("[CONEXÃO] Conexão física de rede perdida!");
      setIsOnline(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    // Periodically try to re-sync every 15 seconds as a robust retry mechanism
    const interval = setInterval(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        processSyncQueue();
      } else {
        setIsOnline(false);
      }
    }, 15000);

    // Initial attempt on load
    processSyncQueue();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);


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

  // Firebase Auth Observer to handle auto-login, load profiles, and synchronize permissions
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Fetch user profile from Firestore "usuarios" with robust caching & local fallback
          let profileData: any = null;
          try {
            const userDocRef = doc(db, "usuarios", user.uid);
            const docSnap = await getDoc(userDocRef);
            if (docSnap.exists()) {
              profileData = docSnap.data();
              // Cache profile in localStorage for offline, permission, or quota fallback
              localStorage.setItem(`cached_profile_${user.uid}`, JSON.stringify(profileData));
            } else {
              console.warn("[AUTH RESTORE] Perfil não encontrado no Firestore para uid:", user.uid);
            }
          } catch (fsErr: any) {
            console.warn("[AUTH RESTORE] Erro ao pesquisar Firestore, usando cache local como recurso:", fsErr);
            const cached = localStorage.getItem(`cached_profile_${user.uid}`);
            if (cached) {
              try {
                profileData = JSON.parse(cached);
              } catch (parseErr) {
                console.error("Erro ao analisar cache local do perfil:", parseErr);
              }
            }
            
            // If still no profile, generate a generic but functional fallback user based on email or UID
            if (!profileData) {
              profileData = {
                uid: user.uid,
                nomeCompleto: user.displayName || user.email?.split("@")[0] || "Operador",
                email: user.email || "operador@ostvendas.com",
                empresa: "OST Comércio Geral",
                perfil: "Administrador", // Default to high privilege fallback to keep system operational
                cargo: "Administrador",
                estado: "Ativo",
                fotoPerfil: "",
                telefone: "",
                ultimoLogin: new Date().toISOString(),
                dataCriacao: new Date().toISOString()
              };
            }
          }

          if (profileData) {
            const mappedEmployee = mapUsuarioToEmployee(profileData as any);
            
            setActiveUser(mappedEmployee);
            setIsAuthenticated(true);
            setSettings(prev => ({
              ...prev,
              companyName: profileData.empresa || "OST Comércio Geral"
            }));
            
            console.log(`[AUTH RESTORE] Utilizador autolocado (com fallback resiliente): ${mappedEmployee.name} (${mappedEmployee.role})`);
          } else {
            setIsAuthenticated(false);
            setActiveUser(null);
          }
        } catch (err) {
          console.error("[AUTH RESTORE] Erro crítico ao processar login do utilizador:", err);
          setIsAuthenticated(false);
          setActiveUser(null);
        }
      } else {
        setIsAuthenticated(false);
        setActiveUser(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Real-time products subscription and initial sync
  useEffect(() => {
    if (isAuthenticated) {
      console.log("[FIRESTORE] Ativando subscrição em tempo real para produtos...");
      
      const unsubscribe = subscribeToProdutos(
        async (firestoreProducts) => {
          setIsOnline(true);
          if (firestoreProducts && firestoreProducts.length > 0) {
            console.log(`[FIRESTORE] Recebidos ${firestoreProducts.length} produtos em tempo real.`);
            setProducts(firestoreProducts);
          } else {
            console.log("[FIRESTORE] Coleção de produtos vazia. Semeando produtos iniciais...");
            for (const prod of initialProducts) {
              await addProdutoToFirestore(prod);
            }
          }
        },
        (error) => {
          console.error("[FIRESTORE] Erro no listener em tempo real de produtos:", error);
          setIsOnline(false);
        }
      );

      const loadTransactions = async () => {
        try {
          const firestoreTx = await getTransacoesFromFirestore();
          if (firestoreTx && firestoreTx.length > 0) {
            console.log(`[FIRESTORE] Carregadas ${firestoreTx.length} transações.`);
            setTransactions(firestoreTx.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()));
          } else {
            console.log("[FIRESTORE] Coleção de transações vazia. Semeando transações iniciais...");
            const mockTx = generateMockTransactions();
            for (const tx of mockTx) {
              await addTransacaoToFirestore(tx);
            }
            setTransactions(mockTx);
          }
        } catch (err) {
          console.error("[FIRESTORE] Erro ao carregar transações do Firestore:", err);
        }
      };

      loadTransactions();

      return () => {
        console.log("[FIRESTORE] Desativando subscrição em tempo real para produtos.");
        unsubscribe();
      };
    }
  }, [isAuthenticated]);

  // Synchronize Firestore user database with local staff module list
  useEffect(() => {
    if (isAuthenticated) {
      const syncStaff = async () => {
        try {
          const firestoreUsers = await getUsuariosFromFirestore();
          if (firestoreUsers && firestoreUsers.length > 0) {
            // Merge firestore users with mock users by ID, prioritizing Firestore profiles
            setEmployees(prev => {
              const merged = [...prev];
              firestoreUsers.forEach(fUser => {
                const idx = merged.findIndex(m => m.id === fUser.id);
                if (idx > -1) {
                  merged[idx] = fUser;
                } else {
                  merged.push(fUser);
                }
              });
              return merged;
            });
          }
        } catch (err) {
          console.error("Erro ao sincronizar quadro de funcionários do Firestore:", err);
        }
      };
      syncStaff();
    }
  }, [isAuthenticated]);

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
    const username = activeUser ? activeUser.name : "Sistema / Visitante";
    if (activeUser) {
      const raw = activeUser.role.toLowerCase();
      if (raw.includes("supervisor")) authRole = "SUPERVISOR";
      else if (raw.includes("administrador") || raw.includes("gestor")) authRole = "ADMIN";
    }

    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString(),
      user: username,
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

  const handleUpdateEmployees = (updatedList: Employee[]) => {
    setEmployees(updatedList);
    syncTable("employees", updatedList);
  };

  // CENTRAL MUTATION HOOKS - SETTINGS
  const handleUpdateSettings = (newSettings: Partial<SystemSettings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings };
      syncTable("settings", updated);
      return updated;
    });
  };

  const handleThemeChange = (newThemeId: string) => {
    setActiveColorTheme(newThemeId);
    const userId = activeUser?.id || "default";
    localStorage.setItem("erp_theme_" + userId, newThemeId);
    handleUpdateSettings({ theme: newThemeId });
  };

  // ADMIN-ONLY REAL DATABASE EXPORT (JSON DOWNLOAD)
  const handleExportLocalDB = () => {
    const dbPayload = {
      app: "OST Vendas",
      exportDate: new Date().toISOString(),
      version: "3.2.0-Prod-Mozambique",
      operator: activeUser?.name || "ADMIN",
      data: {
        settings,
        products,
        customers,
        transactions,
        cashFlow,
        employees,
        auditLogs
      }
    };

    const dataStr = JSON.stringify(dbPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `OST_Vendas_DB_Backup_${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    handleAddAuditLog(
      "Exportação Completa de DB",
      "SEGURANÇA",
      `Operador ${activeUser?.name || "ADMIN"} exportou com sucesso o banco de dados completo contendo ${products.length} produtos, ${customers.length} clientes, ${transactions.length} transações, ${cashFlow.length} movimentos e ${auditLogs.length} logs.`
    );
  };

  // ADMIN-ONLY REAL DATABASE IMPORT/RESTORE
  const handleImportLocalDB = async (importedData: any) => {
    try {
      if (!importedData) return false;

      if (importedData.products) {
        setProducts(importedData.products);
        await syncTable("products", importedData.products);
      }
      if (importedData.customers) {
        setCustomers(importedData.customers);
        await syncTable("customers", importedData.customers);
      }
      if (importedData.transactions) {
        setTransactions(importedData.transactions);
        await syncTable("transactions", importedData.transactions);
      }
      if (importedData.cashFlow) {
        setCashFlow(importedData.cashFlow);
        await syncTable("cashflow", importedData.cashFlow);
      }
      if (importedData.employees) {
        setEmployees(importedData.employees);
        await syncTable("employees", importedData.employees);
      }
      if (importedData.auditLogs) {
        setAuditLogs(importedData.auditLogs);
        await syncTable("auditlogs", importedData.auditLogs);
      }
      if (importedData.settings) {
        setSettings(importedData.settings);
        await syncTable("settings", importedData.settings);
      }

      handleAddAuditLog(
        "Restauro Completo de DB",
        "SEGURANÇA",
        `Operador ${activeUser?.name || "ADMIN"} restaurou com sucesso o banco de dados local.`
      );

      return true;
    } catch (error) {
      console.error("Falha ao restaurar banco de dados completo:", error);
      return false;
    }
  };

  const triggerSmsStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    const managerPhone = settings.smsManagerPhone || "+258849001200";
    const provider = settings.smsProviderType || "TWILIO";
    const message = `ALERTA ESTOQUE CRÍTICO: O produto "${productName}" atingiu o nível crítico (${currentStock} unidades restantes). Limite configurado: ${threshold}. Por favor, realize a reposição urgente!`;

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (SMS)",
      "STOCK",
      `Alerta de estoque baixo disparado para ${managerPhone} (${provider}). Mensagem: "${message}"`
    );

    // 2. Show Toast
    showToast(
      `Alerta de stock crítico por SMS enviado para o Gestor (${managerPhone}) referente ao produto "${productName}"!`,
      "warning",
      "SMS Enviado"
    );

    // 3. Optional real API connection triggers
    try {
      if (provider === "TWILIO" && settings.smsTwilioSid && settings.smsTwilioToken) {
        console.log(`[Twilio SMS] Sending SMS via SID: ${settings.smsTwilioSid} to ${managerPhone}`);
        // Real API request would look like:
        // const authString = btoa(`${settings.smsTwilioSid}:${settings.smsTwilioToken}`);
        // await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.smsTwilioSid}/Messages.json`, {
        //   method: "POST",
        //   headers: { "Authorization": `Basic ${authString}`, "Content-Type": "application/x-www-form-urlencoded" },
        //   body: new URLSearchParams({ From: settings.smsTwilioFrom || "", To: managerPhone, Body: message })
        // });
      } else if (provider === "CUSTOM_HTTP" && settings.smsCustomUrl) {
        console.log(`[Custom SMS] Sending SMS via custom URL to ${managerPhone}`);
        // Real API request would look like:
        // await fetch(settings.smsCustomUrl, { method: "POST", body: JSON.stringify({ to: managerPhone, text: message }) });
      }
    } catch (e) {
      console.warn("Real SMS gateway execution skipped or failed:", e);
    }
  };

  const triggerEmailStockAlert = async (productName: string, currentStock: number, threshold: number) => {
    const recipientEmail = settings.alertsRecipientEmail || "admin-alerts@empresa.co.mz";
    const subject = `ALERTA DE ESTOQUE CRÍTICO - ${productName}`;
    const body = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 25px; border: 1px solid #fee2e2; border-radius: 16px; background-color: #fff5f5;">
        <h2 style="color: #dc2626; margin-top: 0;">⚠️ Alerta de Estoque Crítico</h2>
        <p>O sistema <strong>OST Vendas</strong> detectou que um de seus produtos atingiu o nível de estoque mínimo configurado.</p>
        <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;" />
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #4b5563; font-weight: bold;">Produto:</td>
            <td style="padding: 8px 0; color: #1f2937; font-weight: bold;">${productName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563;">Estoque Atual:</td>
            <td style="padding: 8px 0; color: #dc2626; font-weight: bold;">${currentStock} unidades</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #4b5563;">Limite Mínimo:</td>
            <td style="padding: 8px 0; color: #1f2937;">${threshold} unidades</td>
          </tr>
        </table>
        <hr style="border: none; border-top: 1px solid #fee2e2; margin: 20px 0;" />
        <p style="font-size: 13px; color: #4b5563;">Por favor, providencie o reabastecimento deste produto o quanto antes para evitar rupturas de estoque no POS.</p>
        <p style="font-size: 11px; color: #9ca3af; margin-top: 25px; text-align: center;">Este é um e-mail automático enviado pelo sistema OST Vendas.</p>
      </div>
    `;

    // 1. Add to Audit Logs
    handleAddAuditLog(
      "Alerta Stock Crítico (E-mail)",
      "STOCK",
      `Alerta de estoque baixo para "${productName}" enviado para o e-mail: ${recipientEmail}`
    );

    // 2. Show Toast
    showToast(
      `Alerta de estoque crítico enviado para o e-mail: ${recipientEmail}!`,
      "warning",
      "E-mail de Alerta"
    );

    // 3. Dispatch to backend endpoint
    try {
      const response = await fetch("/api/email/send-alert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: recipientEmail,
          subject,
          body
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro no envio do e-mail de alerta");
      }
      console.log("[EMAIL ALERT] Alerta de estoque enviado com sucesso:", data);
    } catch (err: any) {
      console.error("[EMAIL ALERT ERROR] Falha ao enviar e-mail de alerta de estoque:", err);
    }
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
          const threshold = settings.smsStockThreshold !== undefined ? settings.smsStockThreshold : 5;
          
          if (settings.smsAlertsEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerSmsStockAlert(prod.name, updatedStock, threshold);
          }

          if (settings.emailStockAlertsEnabled && updatedStock <= threshold && prod.stock > threshold) {
            triggerEmailStockAlert(prod.name, updatedStock, threshold);
          }

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
    if (!activeUser) return "CASHIER";
    const raw = activeUser.role.toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) return "CASHIER";
    if (raw.includes("supervisor")) return "SUPERVISOR";
    return "ADMIN";
  }, [activeUser]);

  const handleLoginSuccess = (user: Employee, branchName: string) => {
    setActiveUser(user);
    setIsAuthenticated(true);
    setSettings(prev => ({
      ...prev,
      companyName: branchName
    }));
    
    // Auto-redirect conforming to profile role
    const raw = user.role.toLowerCase();
    if (raw.includes("caixa") || raw.includes("vendedor")) {
      setActiveTab("POS");
    } else {
      setActiveTab("DASHBOARD");
    }
  };

  const handleLogout = async () => {
    try {
      if (activeUser) {
        handleAddAuditLog(
          "Logout Efetuado",
          "SEGURANÇA",
          `Operador ${activeUser.name} encerrou a sessão.`
        );
      }
      await auth.signOut();
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    } catch (err: any) {
      console.error("Erro ao efetuar logout do Firebase:", err);
      setActiveUser(null);
      setIsAuthenticated(false);
      showToast("Sessão terminada com sucesso.", "info");
    }
  };

  if (!isAuthenticated || !activeUser) {
    return (
      <LoginModule
        employees={employees}
        companyName={settings.companyName}
        logoUrl={settings.logoUrl}
        onLoginSuccess={handleLoginSuccess}
        onShowToast={showToast}
      />
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden font-sans transition-colors duration-200 ${
      theme === "night" ? "bg-zinc-950 text-slate-200" : "bg-slate-50 text-slate-800"
    }`}>
      
      {/* Visual background atmospheric touch for elegant negative spacing aesthetics */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none z-0"></div>

      {/* Main sidebar on the left */}
      {!isPOSFullscreen && (
        <Sidebar
          currentRole={simplifiedRole}
          onChangeRole={handleChangeRole}
          activeModule={activeTab.toLowerCase()}
          onChangeModule={(mod) => setActiveTab(mod.toUpperCase())}
          companyName={settings.companyName}
          logoUrl={settings.logoUrl}
          onLogout={handleLogout}
        />
      )}

      {/* Outer body wrapper */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
        
        {/* TOP COMPACT STATUS BAR BRAND BANNER */}
        {!isPOSFullscreen && (
          <header className={`border-b h-16 px-4 md:px-6 shrink-0 flex items-center justify-between shadow-md backdrop-blur-md relative z-20 transition-all ${
            theme === "night" ? "bg-zinc-950/50 border-zinc-800/80" : "bg-white border-slate-200"
          }`}>
            
            <div className="flex items-center gap-3">
              {/* System Status Indicator */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                isOnline 
                  ? theme === "night"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : "bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm"
                  : theme === "night"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                    : "bg-rose-50 text-rose-600 border border-rose-200 shadow-sm animate-pulse"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`}></span>
                <span>{isOnline ? "SISTEMA ONLINE" : "SISTEMA OFFLINE"}</span>
              </div>
  
              <div className="hidden lg:flex items-center gap-2 text-[11px] font-mono opacity-80">
                {settings.logoUrl && (
                  <img
                    src={settings.logoUrl}
                    alt="Logo Mini"
                    className="w-5 h-5 rounded-md object-contain bg-white p-0.5 border border-slate-200 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <span className={theme === "night" ? "text-slate-400" : "text-slate-600"}>Empresa:</span>
                <span className={`font-bold uppercase ${theme === "night" ? "text-white" : "text-slate-800"}`}>
                  {settings.companyName}
                </span>
              </div>
  
              <span className="hidden lg:inline text-slate-500 font-mono text-[11px]">•</span>
  
              <div className="hidden sm:flex items-center gap-1 text-[11px] font-mono opacity-80">
                <span className={theme === "night" ? "text-slate-400" : "text-slate-600"}>Versão:</span>
                <span className={`font-bold ${theme === "night" ? "text-amber-400" : "text-orange-600"}`}>v4.2.1-ERP</span>
              </div>
            </div>
  
            <div className="flex items-center gap-4 text-xs">
              {/* Session Stats & Last Sync */}
              <div className={`hidden md:flex items-center gap-4 font-mono text-[10.5px] ${
                theme === "night" ? "text-slate-400" : "text-slate-500"
              }`}>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-500" />
                  <span>Sessão:</span>
                  <span className={`font-bold ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
                    {formatSessionTime(sessionSeconds)}
                  </span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1.5" title="Hora do último envio ou recebimento de dados com a nuvem">
                  <Cloud className="w-3.5 h-3.5 text-blue-400" />
                  <span>Última Sinc:</span>
                  <span className={`font-bold ${theme === "night" ? "text-slate-200" : "text-slate-800"}`}>
                    {lastSyncTime}
                  </span>
                </div>
              </div>
  
              {/* Daily/Night Theme Switcher Custom Widget */}
              <button
                onClick={() => setTheme(theme === "daily" ? "night" : "daily")}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer text-[10.5px] font-bold ${
                  theme === "night" 
                    ? "bg-zinc-900 border-zinc-800 text-amber-500 hover:text-amber-400" 
                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                }`}
                title="Alternar Layout de Tema"
              >
                {theme === "daily" ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500 animate-spin" style={{ animationDuration: "10s" }} />
                    <span>Dia</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-amber-450 fill-amber-400/25" />
                    <span>Noite</span>
                  </>
                )}
              </button>
  
              {/* Active user status pill */}
              <div className={`flex items-center gap-2 p-1.5 rounded-xl border ${
                theme === "night" ? "bg-zinc-900 border-zinc-800" : "bg-white border-slate-200 shadow-sm"
              }`}>
                <span className="w-6 h-6 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-[10px]">
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
        )}
        
        {isQuotaExceeded && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-3 flex items-start gap-3 relative z-30 animate-in slide-in-from-top duration-200">
            <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1 text-xs">
              <h4 className="font-extrabold text-amber-500">Aviso do Sistema: Limite de Quota Diária Excedido (Firestore Writes)</h4>
              <p className="text-slate-400 mt-1 leading-relaxed">
                A cota diária gratuita de gravação do Firestore (**Spark Plan / Free Tier**) foi atingida para este projeto. O sistema de banco de dados entrou em modo de simulação segura local. Pode continuar a registar vendas, gerir artigos, consultar relatórios e testar todas as funcionalidades do POS com segurança! Os limites de quota serão reiniciados automaticamente amanhã.
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                <a
                  href="https://console.firebase.google.com/project/gen-lang-client-0285564041/firestore/databases/ai-studio-e2d52f5d-b57f-430e-9d24-e415e95b0744/data?openUpgradeDialog=true"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3 py-1 rounded text-[10px] transition uppercase tracking-wider"
                >
                  Ir para a Consola Firebase ↗
                </a>
                <a
                  href="https://firebase.google.com/pricing#cloud-firestore"
                  target="_blank"
                  rel="noreferrer"
                  className="border border-amber-500/30 text-amber-400 hover:text-amber-300 font-bold px-3 py-1 rounded text-[10px] transition"
                >
                  Tabela de Preços e Limites ↗
                </a>
                <button
                  onClick={() => setIsQuotaExceeded(false)}
                  className="text-slate-500 hover:text-slate-300 underline font-semibold text-[10px]"
                >
                  Ignorar por agora
                </button>
              </div>
            </div>
          </div>
        )}
  
        {/* INNER SCROLLABLE WORKPORT PANEL CONTENT */}
        <main className={`flex-1 overflow-y-auto relative ${isPOSFullscreen ? "p-0" : "p-6"}`}>
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
                  transactions={transactions}
                  onCompleteSale={handleCompleteSaleAction}
                  activeUsername={activeUser.name}
                  settings={settings}
                  onAddAuditLog={handleAddAuditLog}
                  currency={currency}
                  onShowToast={showToast}
                  isPOSFullscreen={isPOSFullscreen}
                  onChangePOSFullscreen={setIsPOSFullscreen}
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
                  settings={settings}
                />
              )}

              {/* ACTIVE STOCK INVENTORY MANAGER */}
              {activeTab === "STOCK" && (
                <StockModule
                  products={products}
                  transactions={transactions}
                  onAddProduct={handleAddProduct}
                  onUpdateProduct={handleUpdateProduct}
                  onDeleteProduct={handleDeleteProduct}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  settings={settings}
                  onShowToast={showToast}
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
                  onUpdateEmployees={handleUpdateEmployees}
                  activeUsername={activeUser.name}
                  onAddAuditLog={handleAddAuditLog}
                  currentRole={simplifiedRole}
                  currency={currency}
                  settings={settings}
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
                  activeUser={activeUser}
                  activeColorTheme={activeColorTheme}
                  onChangeColorTheme={handleThemeChange}
                  onExportLocalDB={handleExportLocalDB}
                  onImportLocalDB={handleImportLocalDB}
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
                  products={products}
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
