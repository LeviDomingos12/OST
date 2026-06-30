import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  PiggyBank, 
  Users, 
  UserCheck, 
  FileText, 
  BookOpen, 
  TrendingUp, 
  Settings, 
  Lock,
  ChevronDown,
  Smartphone,
  LogOut
} from "lucide-react";
import { UserRole, UserProfile } from "../types";

interface SidebarProps {
  currentRole: UserRole;
  onChangeRole: (role: UserRole) => void;
  activeModule: string;
  onChangeModule: (module: string) => void;
  companyName: string;
  logoUrl?: string;
  onLogout?: () => void;
}

export default function Sidebar({
  currentRole,
  onChangeRole,
  activeModule,
  onChangeModule,
  companyName,
  logoUrl,
  onLogout
}: SidebarProps) {
  
  const profiles: UserProfile[] = [
    { id: "p-admin", name: "Levi Domingos", role: "ADMIN", avatar: "👨‍💼" },
    { id: "p-super", name: "Inácio Macamo", role: "SUPERVISOR", avatar: "👨‍💻" },
    { id: "p-cash", name: "Marta Ubisse", role: "CASHIER", avatar: "👩‍💼" }
  ];

  const currentProfile = profiles.find(p => p.role === currentRole) || profiles[0];

  const menuItems = [
    { id: "dashboard", label: "Dashboard Inteligente", icon: LayoutDashboard, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "pos", label: "Vendas (POS)", icon: ShoppingCart, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "stock", label: "Gestão de Stock", icon: Package, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "cash", label: "Gestão de Caixa", icon: PiggyBank, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "customers", label: "Gestão de Clientes", icon: Users, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "staff", label: "Funcionários & Auditoria", icon: UserCheck, roles: ["ADMIN"] },
    { id: "ai", label: "Previsão AI (Premium)", icon: TrendingUp, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "reports", label: "Relatórios & Faturação", icon: FileText, roles: ["ADMIN", "SUPERVISOR"] },
    { id: "training", label: "Centro de Formação", icon: BookOpen, roles: ["ADMIN", "SUPERVISOR", "CASHIER"] },
    { id: "settings", label: "Configurações Gerais", icon: Settings, roles: ["ADMIN"] },
    { id: "gateway", label: "Integração Mobile Money", icon: Smartphone, roles: ["ADMIN"] },
  ];

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case "ADMIN": return "Administrador";
      case "SUPERVISOR": return "Supervisor";
      case "CASHIER": return "Vendedor / Caixa";
    }
  };

  const hasAccess = (allowedRoles: string[]) => {
    return allowedRoles.includes(currentRole);
  };

  return (
    <aside className="w-72 bg-zinc-900 text-slate-100 flex flex-col border-r border-zinc-850 shrink-0 h-screen overflow-y-auto">
      {/* Brand Header */}
      <div className="p-6 border-b border-zinc-800/80 flex items-center gap-3">
        <img
          src={logoUrl || "/src/assets/images/app_logo_1782658148089.jpg"}
          alt="OST Vendas Logo"
          className="w-11 h-11 rounded-xl object-contain bg-white p-1 shrink-0"
          referrerPolicy="no-referrer"
        />
        <div>
          <h1 className="font-semibold tracking-tight leading-none text-slate-100">OST Vendas</h1>
          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Comercial v1.0</span>
        </div>
      </div>

      {/* Profile Switcher */}
      <div className="p-4 mx-4 my-4 bg-zinc-950 text-slate-150 rounded-xl border border-zinc-850">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-2xl bg-zinc-900 w-10 h-10 rounded-lg flex items-center justify-center border border-zinc-800">
            {currentProfile.avatar}
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-semibold text-slate-200 truncate leading-none">{currentProfile.name}</h4>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-zinc-900 text-slate-355 mt-1 inline-block border border-zinc-800">
              {getRoleLabel(currentRole)}
            </span>
          </div>
        </div>
        
        <div className="mt-3 pt-2 border-t border-zinc-800/60">
          <label className="text-[9px] text-slate-500 uppercase tracking-wider font-bold block mb-1">Alterar Perfil Comercial</label>
          <div className="relative">
            <select 
              value={currentRole}
              onChange={(e) => {
                const targetRole = e.target.value as UserRole;
                onChangeRole(targetRole);
                
                // If current module gets restricted, reset module to POS
                const selectedMenu = menuItems.find(m => m.id === activeModule);
                if (selectedMenu && !selectedMenu.roles.includes(targetRole)) {
                  onChangeModule("pos");
                }
              }}
              className="w-full bg-zinc-900 border border-zinc-800 text-xs rounded-lg py-1.5 px-2.5 outline-none text-slate-300 font-medium cursor-pointer focus:border-amber-500"
            >
              <option value="ADMIN">Administrador</option>
              <option value="SUPERVISOR">Supervisor</option>
              <option value="CASHIER">Vendedor / Caixa</option>
            </select>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 pb-6 space-y-1">
        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-550 px-3 mb-2">Acesso e Módulos</p>
        
        {menuItems.map((item) => {
          const authorized = hasAccess(item.roles);
          const active = activeModule === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => authorized && onChangeModule(item.id)}
              disabled={!authorized && currentRole !== "ADMIN"} // Lock visual simulation
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all group relative ${
                active 
                  ? "bg-amber-500/10 text-amber-500 border-l-4 border-amber-500 shadow-md" 
                  : "text-slate-400 hover:text-slate-200 hover:bg-zinc-800/40"
              } ${!authorized ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <div className="flex items-center gap-2.5">
                <item.icon className={`w-4 h-4 shrink-0 ${active ? "text-amber-500" : "text-slate-500 group-hover:text-slate-300"}`} />
                <span>{item.label}</span>
              </div>
              
              {!authorized && (
                <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              )}
            </button>
          );
        })}

        {onLogout && (
          <div className="pt-2 mt-4 border-t border-zinc-800/80">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all cursor-pointer"
            >
              <LogOut className="w-4 h-4 shrink-0 text-red-500" />
              <span>Terminar Sessão 🔒</span>
            </button>
          </div>
        )}
      </nav>

      {/* Footer Branding Area */}
      <div className="p-4 border-t border-slate-800 text-center bg-slate-950/20">
        <div className="text-[11px] font-medium text-slate-400 truncate">{companyName}</div>
        <div className="text-[9px] text-slate-500 mt-1 font-mono">Moçambique Comércio</div>
      </div>
    </aside>
  );
}
