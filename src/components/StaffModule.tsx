import React, { useState, useMemo } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { 
  UserCheck, 
  Plus, 
  History, 
  Search, 
  Terminal, 
  ShieldCheck, 
  Clock, 
  DollarSign, 
  Tag,
  Briefcase,
  Download,
  FileText
} from "lucide-react";
import { Employee, AuditLog, UserRole } from "../types";

interface StaffModuleProps {
  employees: Employee[];
  auditLogs: AuditLog[];
  onAddEmployee: (emp: Employee) => void;
  activeUsername: string;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
}

export default function StaffModule({
  employees,
  auditLogs,
  onAddEmployee,
  activeUsername,
  onAddAuditLog,
  currentRole,
  currency
}: StaffModuleProps) {
  
  // Local states
  const [activeTab, setActiveTab] = useState<"STAFF" | "AUDIT">("AUDIT");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("Todos");

  // Audit log period selector states
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000)); // default to 30 days ago
    return past.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Form states for adding new staff
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Operador de Caixa");
  const [contact, setContact] = useState("");
  const [localError, setLocalError] = useState("");
  const [salary, setSalary] = useState<number>(18000);

  // Staff Excel/CSV downloader helper
  const handleDownloadStaffCSV = () => {
    try {
      const header = "ID,Nome,Cargo,Contacto,Salario (MT),Admissao,Estado\n";
      const rows = employees.map(emp => 
        `"${emp.id}","${emp.name}","${emp.role}","${emp.contact}",${emp.salary},"${emp.admissionDate}","${emp.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}"`
      ).join("\n");
      
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Relatorio_Funcionarios_OST_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Descarregar Relatorio Funcionarios",
        "FUNCIONÁRIOS",
        `Quadro de funcionários descarregado em formato CSV (${employees.length} registros).`
      );
    } catch (err) {
      console.warn(err);
    }
  };

  // Audit Log Excel/CSV downloader helper
  const handleDownloadAuditCSV = () => {
    try {
      const header = "Data,Usuario,Funcao,Accao,Modulo,Detalhes\n";
      const rows = filteredAuditLogs.map(log => 
        `"${new Date(log.timestamp).toLocaleString() || ''}","${log.user || ''}","${log.userRole || ''}","${log.action || ''}","${log.module || ''}","${(log.details || '').replace(/"/g, '""')}"`
      ).join("\n");
      
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Relatorio_Auditoria_Seguranca_OST_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Descarregar Relatorio Auditoria",
        "AUDIT",
        `Relatório detalhado de auditoria de logs descarregado em formato CSV (${filteredAuditLogs.length} eventos).`
      );
    } catch (err) {
      console.warn(err);
    }
  };

  // Staff PDF downloader helper (using jsPDF)
  const handleDownloadStaffPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("NUIT: 400293112 | Av. Marginal, Maputo", 14, 28);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Quadro de Funcionários Registados", 14, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Funcionários Activos: ${employees.length}`, 14, 47);
      doc.text(`Emitido em: ${new Date().toLocaleString()}`, 14, 52);

      const head = [["ID", "NOME", "CARGO", "CONTACTO", "SALÁRIO", "ADMISSÃO", "ESTADO"]];
      const body = employees.map(emp => [
        emp.id,
        emp.name,
        emp.role,
        emp.contact,
        `${emp.salary.toLocaleString()} ${currency}`,
        emp.admissionDate,
        emp.status === 'ACTIVE' ? 'Activo' : 'Inactivo'
      ]);

      autoTable(doc, {
        startY: 60,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      const finalBlob = doc.output('blob');
      const filename = `Relatorio_Funcionarios_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Descarregar Relatorio Funcionarios PDF",
        "FUNCIONÁRIOS",
        `Quadro de funcionários descarregado em formato PDF correspondente (${employees.length} registros).`
      );
    } catch (err) {
      console.warn(err);
    }
  };

  // Audit PDF downloader helper (using jsPDF)
  const handleDownloadAuditPDF = () => {
    try {
      const doc = new jsPDF();
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("NUIT: 400293112 | Av. Marginal, Maputo", 14, 28);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Audit Log de Segurança", 14, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período Selecionado: ${startDate} até ${endDate}`, 14, 47);
      doc.text(`Emitido em: ${new Date().toLocaleString()}`, 14, 52);

      const head = [["DATA / HORA", "USUÁRIO", "CARGO", "ACÇÃO", "MÓDULO", "DETALHES"]];
      const body = filteredAuditLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user,
        log.userRole,
        log.action,
        log.module,
        log.details
      ]);

      autoTable(doc, {
        startY: 60,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [60, 60, 60] },
        styles: { fontSize: 8, cellPadding: 3 }
      });

      const finalBlob = doc.output('blob');
      const filename = `Relatorio_Auditoria_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Descarregar Relatorio Auditoria PDF",
        "AUDIT",
        `Relatório detalhado de auditoria de logs descarregado em formato PDF correspondente (${filteredAuditLogs.length} eventos).`
      );
    } catch (err) {
      console.warn(err);
    }
  };

  // Filter modules
  const modules = useMemo(() => {
    const list = new Set(auditLogs.map(l => l.module));
    return ["Todos", ...Array.from(list)];
  }, [auditLogs]);

  // Filtered audit logs
  const filteredAuditLogs = useMemo(() => {
    return [...auditLogs].reverse().filter(log => {
      const matchSearch = log.user.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          log.action.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          log.details.toLowerCase().includes(auditSearch.toLowerCase());
      
      const matchModule = auditModuleFilter === "Todos" || log.module === auditModuleFilter;
      
      // Date filter matching
      let matchDate = true;
      if (log.timestamp) {
        const logDate = log.timestamp.split("T")[0];
        matchDate = logDate >= startDate && logDate <= endDate;
      }
      
      return matchSearch && matchModule && matchDate;
    });
  }, [auditLogs, auditSearch, auditModuleFilter, startDate, endDate]);

  // Handle employee registration
  const handleSubmitEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      setLocalError("Por favor, introduza o Nome e Contacto do trabalhador.");
      return;
    }
    setLocalError("");

    const payload: Employee = {
      id: `emp-${Date.now()}`,
      name,
      role,
      contact,
      salary,
      admissionDate: new Date().toISOString().split("T")[0],
      status: "ACTIVE"
    };

    onAddEmployee(payload);
    
    onAddAuditLog(
      "Contratar Funcionário",
      "FUNCIONÁRIOS",
      `Novo funcionário '${payload.name}' registado como '${payload.role}' com salário de ${payload.salary} ${currency}`
    );

    setIsFormOpen(false);
    setName("");
    setRole("Operador de Caixa");
    setContact("");
    setSalary(18000);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header selection tab trigger */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        {/* Toggle options buttons */}
        <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold border border-slate-200">
          <button
            onClick={() => setActiveTab("AUDIT")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "AUDIT"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            Audit Log de Segurança / Atividades
          </button>
          
          <button
            onClick={() => setActiveTab("STAFF")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "STAFF"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <UserCheck className="w-4 h-4 shrink-0" />
            Quadro de Funcionários ({employees.length})
          </button>
        </div>

        <div className="flex gap-2">
          {activeTab === "STAFF" && (
            <>
              <button
                onClick={handleDownloadStaffCSV}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap bg-white"
              >
                <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Exportar CSV
              </button>
              
              <button
                onClick={handleDownloadStaffPDF}
                className="border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap bg-white"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Exportar PDF
              </button>
              
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition"
              >
                <Plus className="w-4 h-4" />
                Adicionar Funcionário
              </button>
            </>
          )}
          {activeTab === "AUDIT" && (
            <>
              <button
                onClick={handleDownloadAuditCSV}
                className="border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Exportar CSV
              </button>
              
              <button
                onClick={handleDownloadAuditPDF}
                className="border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
              >
                <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                Exportar PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* 2. SUB CONTENT: STAFF ROSTER */}
      {activeTab === "STAFF" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4.5">
          {employees.map((emp) => (
            <div key={emp.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3.5 relative overflow-hidden group hover:border-slate-300">
              {/* Badge Active */}
              <div className="absolute top-4 right-4 bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-emerald-100 uppercase tracking-wider">
                {emp.status === "ACTIVE" ? "Activo" : "Estaleiro"}
              </div>

              <div className="flex gap-3.5 items-center">
                <span className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center font-bold text-base border border-orange-100">
                  {emp.name.substring(0, 2).toUpperCase()}
                </span>
                <div>
                  <h4 className="font-bold text-slate-800 text-sm leading-none">{emp.name}</h4>
                  <span className="text-[10.5px] font-medium text-slate-400 mt-1.5 inline-block font-mono bg-slate-50 border px-1.5 py-0.5 rounded leading-none">{emp.role}</span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-1.5 text-xs text-slate-500">
                <div className="flex justify-between">
                  <span>Contacto Direto:</span>
                  <span className="font-semibold text-slate-700">{emp.contact}</span>
                </div>
                <div className="flex justify-between">
                  <span>Salário Base:</span>
                  <span className="font-bold text-slate-800">{emp.salary.toLocaleString()} <span className="text-[10px]">{currency}/Mês</span></span>
                </div>
                <div className="flex justify-between">
                  <span>Data de Admissão:</span>
                  <span className="font-mono text-slate-500">{emp.admissionDate}</span>
                </div>
              </div>

              {/* Mock Shift telemetry logs */}
              <div className="bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/50 flex justify-between text-[11px] font-mono text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-slate-450" />
                  Operações Ativas
                </span>
                <span className="text-slate-600 font-bold">Acessos ok</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. SUB CONTENT: AUDIT TRAIL TERMINAL DISPLAY */}
      {activeTab === "AUDIT" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[350px]">
          
          {/* Quick Filter audit controls */}
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col xl:flex-row gap-3.5 items-center justify-between">
            <div className="relative w-full xl:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por utente, acção ou detalhe do log..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-start xl:justify-end">
              <div className="flex items-center gap-2 flex-1 md:flex-initial">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Início:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 w-full md:w-auto font-semibold text-slate-700"
                />
              </div>
              
              <div className="flex items-center gap-2 flex-1 md:flex-initial">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Fim:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 w-full md:w-auto font-semibold text-slate-700"
                />
              </div>

              <div className="flex items-center gap-2 flex-1 md:flex-initial">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono font-sans">Módulo:</span>
                <select
                  value={auditModuleFilter}
                  onChange={(e) => setAuditModuleFilter(e.target.value)}
                  className="bg-white border text-slate-650 rounded-lg py-1.5 px-3 text-xs outline-none cursor-pointer font-semibold"
                >
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Audit Terminal list */}
          <div className="flex-1 overflow-x-auto text-[11.5px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-650 font-bold uppercase tracking-wider text-[9.5px]">
                  <th className="p-3.5">DATA / HORA</th>
                  <th className="p-3.5">UTENTE</th>
                  <th className="p-3.5 text-center">NÍVEL ACESSO</th>
                  <th className="p-3.5">ACÇÃO OPERACIONAL</th>
                  <th className="p-3.5 text-center">MÓDULO</th>
                  <th className="p-3.5">DETALHES CONSOLIDADOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-150 font-mono text-[11px] leading-relaxed">
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 italic font-sans text-xs">Nenhum evento registrado de auditoria atendeu aos filtros.</td>
                  </tr>
                ) : (
                  filteredAuditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition">
                      <td className="p-3 text-slate-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                      <td className="p-3 text-slate-700 font-bold font-sans flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded bg-slate-100 text-slate-650 flex items-center justify-center font-bold text-[9px] font-sans">
                          {log.user.charAt(0)}
                        </span>
                        {log.user}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-[9.5px] font-bold font-sans ${
                          log.userRole === "ADMIN" 
                            ? "bg-red-50 text-red-700 border border-red-100" 
                            : log.userRole === "SUPERVISOR" 
                            ? "bg-blue-50 text-blue-700 border border-blue-100" 
                            : "bg-slate-100 text-slate-600 border border-slate-150"
                        }`}>
                          {log.userRole}
                        </span>
                      </td>
                      <td className="p-3 font-semibold text-slate-800 font-sans">{log.action}</td>
                      <td className="p-3 text-center">
                        <span className="bg-slate-100 font-bold text-slate-600 text-[9px] px-1.5 py-0.5 rounded tracking-wide border border-slate-200">
                          {log.module}
                        </span>
                      </td>
                      <td className="p-3 text-slate-550 max-w-sm truncate text-[11.5px] font-sans" title={log.details}>
                        {log.details}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL POPUP: Employee registrations Form */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Contratar / Cadastrar Funcionário</h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEmployee} className="space-y-4 text-xs md:text-xs">
              {localError && (
                <div className="bg-red-500/10 text-red-400 p-2.5 rounded-lg text-xs font-semibold border border-red-500/20">
                  {localError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Completo do Colaborador *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Délio Chiponde"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-505 text-slate-850"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cargo / Atribuição</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
                >
                  <option value="Operador de Caixa">Operador de Caixa</option>
                  <option value="Vendedor / Operador Externo">Vendedor / Operador Externo</option>
                  <option value="Sogro de Armazém">Gestor de Stock</option>
                  <option value="Supervisor de Vendas">Supervisor de Vendas</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contacto Telefónico *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 867712399"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salário Mensal Ajustado (MT)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="Ex: 22000"
                    value={salary || ""}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Confirmar Contratação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
