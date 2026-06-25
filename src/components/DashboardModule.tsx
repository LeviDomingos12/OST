import { useMemo } from "react";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Users, 
  Layers, 
  DollarSign, 
  PiggyBank, 
  ShoppingBag,
  UserCheck,
  Star
} from "lucide-react";
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  BarChart, 
  Bar, 
  PieChart, 
  Pie, 
  Cell, 
  Legend 
} from "recharts";
import { Product, Customer, Transaction, CashFlowEntry } from "../types";

interface DashboardModuleProps {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  cashFlow: CashFlowEntry[];
  currency: string;
  onChangeModule?: (mod: string) => void;
}

export default function DashboardModule({
  products,
  customers,
  transactions,
  cashFlow,
  currency,
  onChangeModule
}: DashboardModuleProps) {
  
  // Date operations helper
  const dateSplit = (isoStr: string) => isoStr.split("T")[0];
  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // 1. Calculations metrics
  const stats = useMemo(() => {
    // Current date values
    let salesToday = 0;
    let profitToday = 0;
    
    // Monthly values (for June 2026 as preloaded)
    let salesMonth = 0;
    let profitMonth = 0;

    // Process all transactions
    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      const isToday = txDate === todayStr;
      
      // Let's assume June is our active month
      const isThisMonth = tx.timestamp.includes("2026-06");

      let txProfit = 0;
      tx.items.forEach(item => {
        // Find cost to compute margin profit
        const prod = products.find(p => p.id === item.productId);
        const cost = prod ? prod.costPrice : item.price * 0.7; // default margin
        txProfit += (item.price - cost) * item.quantity;
      });

      if (isToday) {
        salesToday += tx.grandTotal;
        profitToday += txProfit;
      }

      if (isThisMonth) {
        salesMonth += tx.grandTotal;
        profitMonth += txProfit;
      }
    });

    // Low stock count
    const lowStockCount = products.filter(p => p.stock <= p.minStock).length;

    // Debts & Loyalty active clients
    const activeClientsCount = customers.length;
    const activeDebtsCount = customers.filter(c => c.debt > 0).length;
    const totalOutstandingDebt = customers.reduce((acc, c) => acc + c.debt, 0);

    const debtsSettledMonth = customers.reduce((acc, c) => {
      const settled = (c.settlements || []).filter(s => s.date.includes("2026-06"));
      return acc + settled.reduce((sAcc, s) => sAcc + s.amount, 0);
    }, 0);

    const creditGivenMonth = transactions
      .filter(t => t.paymentMethod === "DEBT" && t.timestamp.includes("2026-06"))
      .reduce((s, t) => s + t.grandTotal, 0);

    const recoveryRate = creditGivenMonth > 0 ? ((debtsSettledMonth / creditGivenMonth) * 100).toFixed(1) : "0";

    // Current cash box balance (initial reinforcements + sales - expenses - quebras)
    const baseReinforcements = cashFlow
      .filter(f => f.type === "REINFORCEMENT" || f.type === "INPUT")
      .reduce((s, f) => s + f.amount, 0);
    const cashExpenses = cashFlow
      .filter(f => f.type === "EXPENSE" || f.type === "QUEBRA")
      .reduce((s, f) => s + f.amount, 0);

    const cashSalesAmount = transactions
      .filter(t => t.paymentMethod === "CASH")
      .reduce((s, t) => s + t.grandTotal, 0);

    const currentCashDesk = baseReinforcements + cashSalesAmount - cashExpenses;

    return {
      salesToday,
      profitToday,
      salesMonth,
      profitMonth,
      lowStockCount,
      activeClientsCount,
      totalOutstandingDebt,
      activeDebtsCount,
      debtsSettledMonth,
      recoveryRate,
      currentCashDesk
    };
  }, [transactions, products, customers, cashFlow, todayStr]);

  // 2. Charts Data Prep

  // Vendas por Dia (Past 10 Days)
  const chartDailySales = useMemo(() => {
    const dailyMap: Record<string, number> = {};
    
    // initialize past 10 days
    for (let i = 9; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const str = d.toISOString().split("T")[0];
      dailyMap[str] = 0;
    }

    transactions.forEach(tx => {
      const txDate = dateSplit(tx.timestamp);
      if (dailyMap[txDate] !== undefined) {
        dailyMap[txDate] += tx.grandTotal;
      }
    });

    return Object.entries(dailyMap).map(([date, total]) => {
      const parts = date.split("-");
      const shortDate = `${parts[2]}/${parts[1]}`; // DD/MM format
      return { 
        data: shortDate, 
        Vendas: total 
      };
    });
  }, [transactions]);

  // Produtos mais vendidos
  const chartBestSellers = useMemo(() => {
    const productMap: Record<string, { name: string; value: number }> = {};
    
    transactions.forEach(tx => {
      tx.items.forEach(item => {
        if (productMap[item.productId]) {
          productMap[item.productId].value += item.quantity;
        } else {
          productMap[item.productId] = { name: item.productName, value: item.quantity };
        }
      });
    });

    return Object.values(productMap)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5
  }, [transactions]);

  // Vendas por Mês (Simulado)
  const chartMonthlySales = useMemo(() => {
    return [
      { Mes: "Janeiro", Valor: 145000 },
      { Mes: "Fevereiro", Valor: 168000 },
      { Mes: "Março", Valor: 155000 },
      { Mes: "Abril", Valor: 198000 },
      { Mes: "Maio", Valor: 210000 },
      { Mes: "Junho", Valor: Math.round(stats.salesMonth || 240000) }
    ];
  }, [stats.salesMonth]);

  // Métodos de Pagamento Utilizados (Doughnut)
  const chartPaymentMethods = useMemo(() => {
    const paymentMap: Record<string, number> = {
      "Dinheiro": 0,
      "M-Pesa": 0,
      "E-Mola": 0,
      "Cartão/POS": 0,
    };

    transactions.forEach(tx => {
      if (tx.paymentMethod === "CASH") {
        paymentMap["Dinheiro"] += tx.grandTotal;
      } else if (tx.paymentMethod === "MPESA_PAGA_FACIL") {
        paymentMap["M-Pesa"] += tx.grandTotal;
      } else if (tx.paymentMethod === "EMOLA") {
        paymentMap["E-Mola"] += tx.grandTotal;
      } else {
        paymentMap["Cartão/POS"] += tx.grandTotal;
      }
    });

    return Object.entries(paymentMap).map(([name, value]) => ({ name, value }));
  }, [transactions]);

  const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6"];

  // Top Clientes
  const topCustomers = useMemo(() => {
    return [...customers]
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 3);
  }, [customers]);

  // Top Cashiers / Salespeople
  const topSalespeople = useMemo(() => {
    const sellerMap: Record<string, { name: string; count: number; total: number }> = {};
    
    transactions.forEach(tx => {
      if (!sellerMap[tx.cashierName]) {
        sellerMap[tx.cashierName] = { name: tx.cashierName, count: 0, total: 0 };
      }
      sellerMap[tx.cashierName].count += 1;
      sellerMap[tx.cashierName].total += tx.grandTotal;
    });

    return Object.values(sellerMap)
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [transactions]);

  const lowStockProducts = useMemo(() => products.filter(p => p.stock <= p.minStock), [products]);

  return (
    <div className="space-y-6">
      
      {/* 1. KEY INDICATORS ROW - Bento Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Metric 1: Sales Today */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Vendas do Dia</span>
            <h3 className="text-xl font-bold font-mono text-slate-800">{stats.salesToday.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span></h3>
            <span className="text-[10px] flex items-center gap-0.5 text-emerald-600 font-bold">
              <TrendingUp className="w-3 h-3" />
              +15.4% vs ontem
            </span>
          </div>
          <div className="bg-orange-50 text-orange-600 p-3 rounded-xl">
            <ShoppingBag className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2: Monthly sales */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Faturação do Mês</span>
            <h3 className="text-xl font-bold font-mono text-slate-800">{stats.salesMonth.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span></h3>
            <span className="text-[10px] flex items-center gap-0.5 text-emerald-600 font-bold">
              <TrendingUp className="w-3 h-3" />
              +8.2% vs mês pass.
            </span>
          </div>
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
            <Layers className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3: Today Profits */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Lucro Estimado (Dia)</span>
            <h3 className="text-xl font-bold font-mono text-emerald-700">+{stats.profitToday.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span></h3>
            <span className="text-[10px] text-slate-400">Margem líquida (~30%)</span>
          </div>
          <div className="bg-emerald-50 text-emerald-600 p-3 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4: Cash drawer values */}
        <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Saldo Físico de Caixa</span>
            <h3 className="text-xl font-bold font-mono text-slate-800">{stats.currentCashDesk.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-400">{currency}</span></h3>
            <span className="text-[10px] text-slate-400">Controlo de boca de caixa</span>
          </div>
          <div className="bg-amber-50 text-amber-600 p-3 rounded-xl">
            <PiggyBank className="w-6 h-6" />
          </div>
        </div>

        {/* Secondary metric blocks */}
        {lowStockProducts.length > 0 && (
          <div className="col-span-2 row-span-2 bg-orange-50 border border-orange-200 p-4.5 rounded-2xl flex flex-col gap-3 max-h-64 overflow-hidden">
            <div className="flex items-center justify-between border-b border-orange-100 pb-2">
              <div className="flex gap-2 items-center">
                <AlertTriangle className="w-5 h-5 text-orange-600 animate-pulse" />
                <h4 className="text-sm font-bold text-orange-800 tracking-tight">Central de Alertas (Risco de Ruptura)</h4>
              </div>
              <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                {lowStockProducts.length} itens críticos
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {lowStockProducts.map(prod => (
                <div key={prod.id} className="bg-white/80 p-3 rounded-xl border border-orange-100/50 flex justify-between items-center shadow-sm">
                  <div>
                    <p className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <span className="text-lg">{prod.emoji || "📦"}</span> {prod.name}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">SKU: {prod.code}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-orange-700 text-xs">Stock: {prod.stock}</p>
                    <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Min: {prod.minStock}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-orange-100">
              <button 
                onClick={() => onChangeModule && onChangeModule("STOCK")}
                className="w-full py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl text-xs shadow-lg shadow-orange-600/20 transition cursor-pointer"
              >
                Atualizar Inventário Agora
              </button>
            </div>
          </div>
        )}

        <div className={`bg-red-50 border border-red-100 p-4.5 rounded-2xl flex flex-col justify-center gap-4 ${lowStockProducts.length > 0 ? "col-span-2 row-span-2" : "col-span-4 lg:col-span-2"}`}>
          <div className="flex gap-3.5 items-center border-b border-red-100 pb-3">
            <div className="p-2.5 bg-red-100 text-red-700 rounded-xl">
              <Users className="w-5 h-5 shrink-0" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Créditos de Clientes (Dívidas)</h4>
              <p className="text-[10px] text-slate-500 mt-0.5">Visão geral do crédito na praça.</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Total em Dívida</p>
              <p className="text-lg font-bold text-red-700">{stats.totalOutstandingDebt.toLocaleString()} {currency}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Dívidas Ativas</p>
              <p className="text-lg font-bold text-slate-800">{stats.activeDebtsCount} Clientes</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Liquidadas (Mês)</p>
              <p className="text-lg font-bold text-emerald-600">{stats.debtsSettledMonth.toLocaleString()} {currency}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Recuperação</p>
              <p className="text-lg font-bold text-emerald-600">{stats.recoveryRate}%</p>
            </div>
          </div>
          <div className="pt-2 border-t border-red-100 flex justify-end">
            <button
              onClick={() => onChangeModule && onChangeModule("CUSTOMERS")}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs transition cursor-pointer"
            >
              Ver Devedores
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN VISUAL CHARTS ROWS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Daily sales timeline widget */}
        <div className="col-span-2 bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Vendas por Dia</h3>
            <p className="text-xs text-slate-400 mt-0.5">Fluxo de caixa gerado nos últimos 10 dias correntes.</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartDailySales} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="data" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`, 'Vendas']} />
                <Area type="monotone" dataKey="Vendas" stroke="#f97316" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSales)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment methods circular split */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-96">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Métodos de Pagamento</h3>
            <p className="text-xs text-slate-400 mt-0.5">Preferências transacionadas este mês.</p>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center text-[11px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartPaymentMethods}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {chartPaymentMethods.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`]} />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Products Best sellers */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-90">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Produtos Mais Vendidos</h3>
            <p className="text-xs text-slate-400 mt-0.5">Categorias e itens em altas de procura de mercado.</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartBestSellers} layout="vertical" margin={{ top: 10, right: 10, left: 35, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" stroke="#94a3b8" />
                <YAxis dataKey="name" type="category" stroke="#64748b" width={80} />
                <Tooltip />
                <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                  {chartBestSellers.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Annual Month comparison trend */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm flex flex-col h-90">
          <div className="mb-4">
            <h3 className="font-bold text-slate-800 text-sm">Vendas por Mês (Histórico)</h3>
            <p className="text-xs text-slate-400 mt-0.5">Comparativo do volume comercial anual (MT).</p>
          </div>
          <div className="flex-1 min-h-0 text-[11px] font-mono">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartMonthlySales} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="Mes" stroke="#94a3b8" />
                <YAxis stroke="#94a3b8" />
                <Tooltip formatter={(value) => [`${value.toLocaleString()} MT`]} />
                <Bar dataKey="Valor" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top customers and employees dashboard card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm h-90 flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-slate-800 text-sm mb-3">Top Operadores & Vendedores</h3>
            <div className="space-y-2.5">
              {topSalespeople.map((sp, idx) => (
                <div key={sp.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-700">{sp.name}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono font-bold text-slate-800">{sp.total.toLocaleString()} {currency}</p>
                    <span className="text-[9.5px] text-slate-400 font-mono">{sp.count} faturas</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 mt-3">
            <h3 className="font-bold text-slate-800 text-sm mb-3">Top VIP Clientes</h3>
            <div className="space-y-2.5">
              {topCustomers.map((tc, idx) => (
                <div key={tc.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-600 font-bold text-[10px] bg-emerald-50 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-400 shrink-0" />
                      VIP
                    </span>
                    <span className="text-xs font-semibold text-slate-750">{tc.name}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-orange-650">{tc.totalSpent.toLocaleString()} {currency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
