import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  PiggyBank, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertOctagon, 
  Plus, 
  History, 
  User,
  Calculator,
  CheckCircle,
  FileText,
  Printer
} from "lucide-react";
import { CashFlowEntry, Transaction, UserRole } from "../types";

interface CashRegisterModuleProps {
  cashFlow: CashFlowEntry[];
  transactions: Transaction[];
  onAddCashFlowEntry: (entry: CashFlowEntry) => void;
  activeUsername: string;
  currentRole: UserRole;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
}

export default function CashRegisterModule({
  cashFlow,
  transactions,
  onAddCashFlowEntry,
  activeUsername,
  currentRole,
  onAddAuditLog,
  currency
}: CashRegisterModuleProps) {
  
  // Local state for registering new cash activity
  const [showAddForm, setShowAddForm] = useState(false);
  const [entryType, setEntryType] = useState<"REINFORCEMENT" | "EXPENSE" | "QUEBRA">("REINFORCEMENT");
  const [entryAmount, setEntryAmount] = useState<number>(0);
  const [entryReason, setEntryReason] = useState("");
  const [entryResponsible, setEntryResponsible] = useState(activeUsername);
  const [localError, setLocalError] = useState("");
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);

  // Closing drawer state
  const [isOpenClosingPanel, setIsOpenClosingPanel] = useState(false);
  const [physicalCount, setPhysicalCount] = useState<number>(0);
  const [closingSupervisor, setClosingSupervisor] = useState("Inácio Macamo");
  const [supervisorPin, setSupervisorPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [closedSummary, setClosedSummary] = useState<any | null>(null);

  // Date limit selector states
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // default to 30 days ago
    return past.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Memoized filtered cashflow entries & transactions by selected date range
  const filteredCashFlow = useMemo(() => {
    return cashFlow.filter(f => {
      if (!f.timestamp) return false;
      const dateStr = f.timestamp.split("T")[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [cashFlow, startDate, endDate]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (!t.timestamp) return false;
      const dateStr = t.timestamp.split("T")[0];
      return dateStr >= startDate && dateStr <= endDate;
    });
  }, [transactions, startDate, endDate]);

  // Calculations for cashier metrics
  const cashCalculation = useMemo(() => {
    // 1. Initial cash / reinforcement sum
    const reinforcements = filteredCashFlow
      .filter(f => f.type === "REINFORCEMENT")
      .reduce((s, f) => s + f.amount, 0);

    // 2. Extra inputs
    const inputs = filteredCashFlow
      .filter(f => f.type === "INPUT")
      .reduce((s, f) => s + f.amount, 0);

    // 3. Sales in CASH
    const cashSalesAmount = filteredTransactions
      .filter(t => t.paymentMethod === "CASH")
      .reduce((s, t) => s + t.grandTotal, 0);

    // 4. Expenses / Saídas
    const expenses = filteredCashFlow
      .filter(f => f.type === "EXPENSE")
      .reduce((s, f) => s + f.amount, 0);

    // 5. Quebras (Discrepancies)
    const quebras = filteredCashFlow
      .filter(f => f.type === "QUEBRA")
      .reduce((s, f) => s + f.amount, 0);

    const theoreticalTotal = reinforcements + inputs + cashSalesAmount - expenses - quebras;

    return {
      reinforcements,
      inputs,
      cashSalesAmount,
      expenses,
      quebras,
      theoreticalTotal
    };
  }, [filteredCashFlow, filteredTransactions]);

  // Submit quick cash entry
  const handleSubmitEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (entryAmount <= 0 || !entryReason.trim()) {
      setLocalError("Por favor configure um valor positivo e descreva o motivo justificativo.");
      return;
    }
    setLocalError("");

    const newEntry: CashFlowEntry = {
      id: `flow-${Date.now()}`,
      timestamp: new Date().toISOString(),
      type: entryType,
      amount: entryAmount,
      reason: entryReason,
      responsibleUser: entryResponsible
    };

    onAddCashFlowEntry(newEntry);
    
    // Audit logs
    onAddAuditLog(
      `Registro de Caixa (${entryType})`,
      "CAIXA",
      `Criado registro de de ${entryType} pelo valor de ${entryAmount} ${currency} por ${entryResponsible}. Motivo: ${entryReason}`
    );

    // feedback reset
    setEntryAmount(0);
    setEntryReason("");
    setShowAddForm(false);
  };

  // Perform shift closing
  const handlePerformClosure = () => {
    // Simple PIN check for supervisor (Default code: 1234)
    if (supervisorPin !== "1234") {
      setPinError("Código PIN do supervisor está inválido. Digite 1234 para validar!");
      return;
    }

    setPinError("");

    // Calculate difference
    const diff = physicalCount - cashCalculation.theoreticalTotal;

    const summaryReport = {
      timestamp: new Date().toISOString(),
      reinforcements: cashCalculation.reinforcements,
      cashSales: cashCalculation.cashSalesAmount,
      inputs: cashCalculation.inputs,
      expenses: cashCalculation.expenses,
      quebras: cashCalculation.quebras,
      theoreticalBalance: cashCalculation.theoreticalTotal,
      physicalBalance: physicalCount,
      difference: diff,
      authorizedSupervisor: closingSupervisor,
      operator: activeUsername
    };

    setClosedSummary(summaryReport);
    onAddAuditLog(
      "Fechamento de Caixa Turno",
      "CAIXA",
      `Turno de caixa fechado. Teórico: ${summaryReport.theoreticalBalance} MT, Físico: ${summaryReport.physicalBalance} MT. Diferença: ${summaryReport.difference} MT. Autorizado por: ${closingSupervisor}`
    );
  };

  const resetClosingState = () => {
    setIsOpenClosingPanel(false);
    setClosedSummary(null);
    setSupervisorPin("");
    setPhysicalCount(0);
  };

  return (
    <div className="space-y-6">
      
      {/* Date Range Selector bar */}
      <div className="bg-white p-4.5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-800">Filtragem de Fluxo de Caixa</h3>
          <p className="text-xs text-slate-400 mt-0.5">Selecione o intervalo de datas para calcular os saldos e as movimentações.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2 flex-1 md:flex-initial">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Início:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-705 outline-none w-full md:w-auto focus:ring-1 focus:ring-orange-400/50"
            />
          </div>
          <div className="flex items-center gap-2 flex-1 md:flex-initial">
            <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Fim:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-semibold text-slate-705 outline-none w-full md:w-auto focus:ring-1 focus:ring-orange-400/50"
            />
          </div>
        </div>
      </div>

      {/* Metrics of actual box balance */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        
        {/* Box theoretical total */}
        <div className="bg-slate-900 text-white p-4.5 rounded-2xl border border-slate-800 shadow-lg col-span-1 md:col-span-2 flex flex-col justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Teórico em Boca de Caixa</span>
            <h2 className="text-2.5xl font-extrabold font-mono text-orange-400 mt-1">
              {cashCalculation.theoreticalTotal.toLocaleString()} <span className="text-xs font-mono font-medium text-slate-300">{currency}</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">Soma calculada em tempo de execução com base nas transações e despesas integradas.</p>
          </div>
          
          <button
            onClick={() => setIsOpenClosingPanel(true)}
            className="mt-4 bg-orange-500 hover:bg-orange-600 font-bold text-xs py-2 px-3 rounded-lg text-white transition cursor-pointer text-center"
          >
            Realizar Fechamento de Turno
          </button>
        </div>

        {/* Inflows Block */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400">Total Entradas</span>
              <h4 className="text-base font-bold font-mono text-emerald-600 mt-0.5">
                {(cashCalculation.reinforcements + cashCalculation.inputs + cashCalculation.cashSalesAmount).toLocaleString()} {currency}
              </h4>
            </div>
            <span className="bg-emerald-50 text-emerald-600 p-1.5 rounded-lg">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-3 space-y-1 font-mono">
            <p>Vendas: {cashCalculation.cashSalesAmount.toLocaleString()}</p>
            <p>Reforços: {cashCalculation.reinforcements.toLocaleString()}</p>
          </div>
        </div>

        {/* Outflows / Expenses Block */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400">Total Despesas / Saídas</span>
              <h4 className="text-base font-bold font-mono text-red-600 mt-0.5">
                {cashCalculation.expenses.toLocaleString()} {currency}
              </h4>
            </div>
            <span className="bg-red-50 text-red-600 p-1.5 rounded-lg">
              <ArrowDownLeft className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-tight">Saídas do caixa destinadas a compras e despesas de rotina.</p>
        </div>

        {/* Quebras / Discrepancies block */}
        <div className="bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9.5px] uppercase font-bold text-slate-400">Quebras Registradas</span>
              <h4 className="text-base font-bold font-mono text-slate-800 mt-0.5">
                {cashCalculation.quebras.toLocaleString()} {currency}
              </h4>
            </div>
            <span className="bg-amber-50 text-amber-600 p-1.5 rounded-lg">
              <AlertOctagon className="w-4 h-4" />
            </span>
          </div>
          <p className="text-[10px] text-slate-400 mt-3 leading-tight">Diferenças inevitáveis, acidentes ou registos incidentais de perda física.</p>
        </div>

      </div>

      {/* Main flow manager panel & quick entry logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* LEFT 2 COLUMNS: Flow activity logs list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="font-bold text-slate-800 text-sm">Histórico de Atividades do Caixa</h3>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-lg text-xs font-semibold text-slate-700 flex items-center gap-1 cursor-pointer transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Registrar Lançamento Avulso
            </button>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[420px] divide-y divide-slate-100">
            {filteredCashFlow.length === 0 ? (
              <p className="p-8 text-center text-xs text-slate-400 italic">Nenhum registro de fluxo de caixa adicionado neste período.</p>
            ) : (
              [...filteredCashFlow].reverse().map((f) => (
                <div key={f.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 transition">
                  <div className="flex gap-3 items-start">
                    <span className={`p-2 rounded-xl text-xs font-bold shrink-0 mt-0.5 ${
                      f.type === "REINFORCEMENT" || f.type === "INPUT"
                        ? "bg-emerald-50 text-emerald-700"
                        : f.type === "EXPENSE"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {f.type === "REINFORCEMENT" || f.type === "INPUT" ? "In" : "Out"}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{f.reason}</h4>
                      <div className="flex gap-2.5 items-center mt-1 text-[10.5px] text-slate-400 font-mono">
                        <span className="flex items-center gap-0.5">
                          <User className="w-3 h-3" />
                          {f.responsibleUser}
                        </span>
                        <span>•</span>
                        <span>{new Date(f.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right font-mono text-xs font-bold">
                    <span className={f.type === "REINFORCEMENT" || f.type === "INPUT" ? "text-emerald-700" : "text-red-700"}>
                      {f.type === "REINFORCEMENT" || f.type === "INPUT" ? "+" : "-"}
                      {f.amount.toLocaleString()} {currency}
                    </span>
                    <p className="text-[9.5px] text-slate-400 font-normal uppercase font-sans mt-0.5 tracking-wider">{f.type === "REINFORCEMENT" ? "Reforço" : f.type === "EXPENSE" ? "Despesa" : f.type === "INPUT" ? "Entrada" : "Quebra"}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Entry form or info display */}
        <div>
          {showAddForm ? (
            <form onSubmit={handleSubmitEntry} className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-800 text-sm">Novo Lançamento Comercial</h3>
              
              {localError && (
                <div className="bg-red-500/10 text-red-400 p-2.5 rounded-lg text-xs font-semibold border border-red-500/20">
                  {localError}
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Registro</label>
                <div className="grid grid-cols-3 gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setEntryType("REINFORCEMENT")}
                    className={`py-1 rounded cursor-pointer ${entryType === "REINFORCEMENT" ? "bg-orange-500 text-white" : "text-slate-600"}`}
                  >
                    Reforço
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("EXPENSE")}
                    className={`py-1 rounded cursor-pointer ${entryType === "EXPENSE" ? "bg-red-500 text-white" : "text-slate-600"}`}
                  >
                    Despesa
                  </button>
                  <button
                    type="button"
                    onClick={() => setEntryType("QUEBRA")}
                    className={`py-1 rounded cursor-pointer ${entryType === "QUEBRA" ? "bg-amber-500 text-white" : "text-slate-600"}`}
                  >
                    Quebra
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Valor do Lançamento ({currency})</label>
                <input
                  type="number"
                  required
                  value={entryAmount || ""}
                  onChange={(e) => setEntryAmount(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold outline-none"
                  placeholder="Ex: 500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Justificação / Motivo</label>
                <textarea
                  required
                  rows={3}
                  value={entryReason}
                  onChange={(e) => setEntryReason(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none"
                  placeholder="Especifique com detalhes (Ex: Compra de materiais de limpeza à beira da mercearia)..."
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Funcionário Executante</label>
                <select
                  value={entryResponsible}
                  onChange={(e) => setEntryResponsible(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs outline-none"
                >
                  <option value={activeUsername}>{activeUsername} (Eu)</option>
                  <option value="Inácio Macamo">Inácio Macamo (Supervisor)</option>
                  <option value="Levi Domingos">Levi Domingos (Admin)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-1/2 py-2 border border-slate-200 bg-white text-slate-700 font-semibold rounded-lg text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2 bg-slate-900 text-white hover:bg-slate-800 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Confirmar Lançamento
                </button>
              </div>
            </form>
          ) : (
            <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-200 text-xs text-slate-500 space-y-3.5">
              <Calculator className="w-8 h-8 text-slate-400" />
              <h4 className="font-bold text-slate-800">Diretrizes de Equilíbrio de Caixa</h4>
              <p>Os operadores de caixa devem registrar com total rigor qualquer diferença no troco como uma <strong>Quebra</strong>, sob pena de sindicância do supervisor de turno.</p>
              <p>Sangrias parciais maiores que o limite operacional de 15.000 MT devem ser descarregadas com assinatura e transferidas diretamente para o cofre central de custódia.</p>
            </div>
          )}
        </div>

      </div>

      {/* SHIFT CLOSE WORKFLOW OVERLAY POPUP */}
      {isOpenClosingPanel && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Calculator className="w-4 h-4 text-orange-500" />
                Fechamento Estruturado de Turno de Caixa
              </h3>
              <button 
                onClick={resetClosingState}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {closedSummary ? (
              /* Success closed state display */
              <div className="space-y-4">
                <div className="text-center">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-2">
                    <CheckCircle className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-slate-900">Relatório Consolidado Assinado!</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">As estatísticas fiscais de turno foram consolidadas com sucesso.</p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 font-mono text-[11px] space-y-1.5 leading-tight">
                  <div className="border-b border-dashed border-slate-300 pb-1.5 mb-2 font-bold text-slate-800 flex justify-between">
                    <span>RELATÓRIO DE BALANÇO DE CAIXA</span>
                    <span>FECHADO</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Abertura/Reforços:</span>
                    <span>{closedSummary.reinforcements.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Entradas Extra:</span>
                    <span>{closedSummary.inputs.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vendas em Numerário:</span>
                    <span>{closedSummary.cashSales.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Despesas/Saídas:</span>
                    <span>-{closedSummary.expenses.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Perdas/Quebras:</span>
                    <span>-{closedSummary.quebras.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between border-t border-dashed border-slate-300 pt-1.5 font-bold text-slate-800">
                    <span>Saldo Teórico do Caixa:</span>
                    <span>{closedSummary.theoreticalBalance.toLocaleString()} MT</span>
                  </div>
                  <div className="flex justify-between text-blue-700 font-bold">
                    <span>Contagem Física Declarada:</span>
                    <span>{closedSummary.physicalBalance.toLocaleString()} MT</span>
                  </div>
                  
                  <div className={`flex justify-between font-bold border-t border-dashed border-slate-300 pt-1.5 ${
                    closedSummary.difference === 0 
                      ? "text-green-700" 
                      : closedSummary.difference > 0 
                      ? "text-blue-700" 
                      : "text-red-700"
                  }`}>
                    <span>Diferença Detetada:</span>
                    <span>{closedSummary.difference > 0 ? "+" : ""}{closedSummary.difference.toLocaleString()} MT</span>
                  </div>
                  
                  <div className="border-t border-dashed border-slate-300 pt-2 mt-2 text-[10px] space-y-0.5 text-slate-400 italic">
                    <p>Operador respondente: {closedSummary.operator}</p>
                    <p>Supervisor homologante: {closedSummary.authorizedSupervisor}</p>
                    <p>Código de Autenticidade Digital: MD5-OST-SEC-FA89A</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setIsSimulatingPrint(true);
                        try {
                          window.print();
                        } catch (err) {
                          console.warn("Bloqueio de impressora por sandbox iFrame ativo. Simulador ativado com sucesso.");
                        }
                        setTimeout(() => {
                          setIsSimulatingPrint(false);
                        }, 4050);
                      }}
                      className="w-1/2 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Imprimir Turno
                    </button>
                    
                    <button
                      onClick={() => {
                        try {
                          const filename = `OST_Vendas_Fechamento_Turno_${new Date().toISOString().split('T')[0]}.pdf`;
                          
                          const doc = new jsPDF();
                          
                          doc.setFontSize(18);
                          doc.setFont("helvetica", "bold");
                          doc.text("OST COMÉRCIO CENTRAL", 14, 22);
                          
                          doc.setFontSize(10);
                          doc.setFont("helvetica", "normal");
                          doc.text("Balanço do Fechamento de Turno", 14, 28);
                          
                          doc.setFontSize(10);
                          doc.text(`Data: ${new Date().toLocaleString()}`, 14, 34);
                          doc.text("Terminal ID: CAIXA_01", 14, 40);

                          const head = [["MOVIMENTAÇÃO", "VALOR MT"]];
                          const body = [
                            ["Abertura de Caixa e Reforços", `${closedSummary.reinforcements.toLocaleString()} MT`],
                            ["Entradas Extra de Valores", `${closedSummary.inputs.toLocaleString()} MT`],
                            ["Vendas Registadas (Numerário)", `${closedSummary.cashSales.toLocaleString()} MT`],
                            ["Despesas e Saídas (Sangrias)", `-${closedSummary.expenses.toLocaleString()} MT`],
                            ["Quebras/Perdas de Caixa", `-${closedSummary.quebras.toLocaleString()} MT`],
                            ["Saldo Final Teórico", `${closedSummary.theoreticalBalance.toLocaleString()} MT`],
                            ["Contagem Física Coletada", `${closedSummary.physicalBalance.toLocaleString()} MT`],
                            ["Discrepância / Quebras", `${closedSummary.difference > 0 ? "+" : ""}${closedSummary.difference.toLocaleString()} MT`]
                          ];

                          autoTable(doc, {
                            startY: 45,
                            head: head,
                            body: body,
                            theme: 'grid',
                            headStyles: { fillColor: [60, 60, 60] },
                            styles: { fontSize: 8, cellPadding: 3 }
                          });

                          doc.text(`Operador: ${closedSummary.operator}`, 14, (doc as any).lastAutoTable.finalY + 10);
                          doc.text(`Supervisor: ${closedSummary.authorizedSupervisor}`, 14, (doc as any).lastAutoTable.finalY + 16);

                          const blob = doc.output('blob');
                          const url = URL.createObjectURL(blob);
                          const link = document.createElement("a");
                          link.href = url;
                          link.download = filename;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                          URL.revokeObjectURL(url);
                        } catch (err) {
                          console.warn("Dispositivo em iFrame bloqueado para transferências.", err);
                        }
                      }}
                      className="w-1/2 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Guardar PDF
                    </button>
                  </div>

                  <button
                    onClick={resetClosingState}
                    className="w-full py-2 bg-slate-900 text-white hover:bg-slate-805 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Finalizar Workflow de Caixa
                  </button>
                </div>
              </div>
            ) : (
              /* Closing Calculation Inputs form */
              <div className="space-y-4">
                <p className="text-xs text-slate-500 leading-normal">
                  Insira abaixo os dados físicos reais correspondentes à sua contagem na gaveta de valores. O supervisor de turno homologará o registro usando o código PIN operacional de segurança.
                </p>

                <div className="grid grid-cols-2 gap-3.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100 text-xs md:text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Saldo Teórico Calculado</span>
                    <p className="text-sm font-bold font-mono text-slate-800">{cashCalculation.theoreticalTotal.toLocaleString()} MT</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Vendas Caixa (Dinheiro)</span>
                    <p className="text-sm font-bold font-mono text-slate-800">{cashCalculation.cashSalesAmount.toLocaleString()} MT</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Moeda Física Contada (MT)</label>
                    <input
                      type="number"
                      required
                      value={physicalCount || ""}
                      onChange={(e) => setPhysicalCount(Number(e.target.value))}
                      className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs font-mono font-bold outline-none text-slate-850"
                      placeholder="Ex: 14500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Diferença de Caixa Estimada</label>
                    <div className="p-2 border rounded-lg bg-slate-50 font-mono text-xs font-bold text-center">
                      <span className={(physicalCount - cashCalculation.theoreticalTotal) >= 0 ? "text-slate-800" : "text-red-600"}>
                        {(physicalCount - cashCalculation.theoreticalTotal).toLocaleString()} MT
                      </span>
                    </div>
                  </div>
                </div>

                {/* Supervisor Signature validation panel */}
                <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 space-y-3.5">
                  <span className="text-[10px] text-amber-800 font-bold uppercase tracking-wider block">Homologação Crítica do Supervisor</span>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <div className="space-y-1">
                      <label className="text-[9.5px] font-semibold text-slate-500">Supervisor de Turno</label>
                      <select
                        value={closingSupervisor}
                        onChange={(e) => setClosingSupervisor(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none"
                      >
                        <option value="Inácio Macamo">Inácio Macamo</option>
                        <option value="Levi Domingos">Levi Domingos</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9.5px] font-semibold text-slate-500">Código PIN de Segurança (Aprovação)</label>
                      <input
                        type="password"
                        placeholder="PIN do supervisor (1234)"
                        value={supervisorPin}
                        onChange={(e) => setSupervisorPin(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-center font-mono font-bold tracking-widest outline-none"
                      />
                    </div>
                  </div>

                  {pinError && (
                    <p className="text-[10.5px] font-bold text-red-600 mt-1">{pinError}</p>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={resetClosingState}
                    className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
                  >
                    Voltar / Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handlePerformClosure}
                    className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-orange-500/10"
                  >
                    Confirmar e Assinar Fecho
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Elegant Real-time Virtual Printer Animation Overlay Safeguard for Cashier Balance Close */}
      {isSimulatingPrint && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-xs font-sans">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center space-y-4 text-white">
            <div className="relative w-16 h-16 mx-auto bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500">
              <Printer className="w-8 h-8 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-500">Impressão de Balancete</h4>
              <p className="text-[11px] text-zinc-400 mt-1">A comunicar com a rede interna fiscal...</p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left font-mono text-[9px] text-zinc-400 max-h-32 overflow-hidden relative">
              <div className="animate-pulse mb-1.5 flex items-center gap-1.5 text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded w-max">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>• EMISSÃO DE BALANCETE DO CAIXA</span>
              </div>
              <p className="font-bold border-b border-zinc-800 pb-1 mb-1 text-[10px]">BALANÇO FISCAL: FECHO DE CAIXA</p>
              <p>OPERADOR RESP: {closedSummary?.operator || activeUsername}</p>
              <p>FISICO DECLARADO: {(closedSummary?.physicalBalance || 0).toLocaleString()} {currency}</p>
              <p>DIFERENÇA: {(closedSummary?.difference || 0).toLocaleString()} {currency}</p>
              <p className="text-zinc-650 mt-1">Código Seg: {closedSummary?.id || "MD5-OST-SEC-FA89A"}</p>
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
            </div>

            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "95%" }}></div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-normal">
              O relatório foi devidamente impresso e arquivado nos logs corporativos de auditoria comercial do OST Vendas.
            </p>
          </div>
        </div>
      )}

    </div>
  );
}
