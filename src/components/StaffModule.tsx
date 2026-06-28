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
  FileText,
  User,
  List,
  Grid,
  Table as TableIcon,
  Trash2,
  Edit3,
  Lock,
  ChevronRight,
  ChevronDown,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  SlidersHorizontal,
  ArrowUpDown,
  Send,
  Printer,
  Copy,
  Activity,
  UserX,
  FileSpreadsheet
} from "lucide-react";
import { Employee, AuditLog, UserRole } from "../types";

const getBase64ImageFromUrl = async (imageUrl: string): Promise<string> => {
  try {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Error loading logo for PDF:", err);
    return "";
  }
};

interface StaffModuleProps {
  employees: Employee[];
  auditLogs: AuditLog[];
  onAddEmployee: (emp: Employee) => void;
  onUpdateEmployees: (updatedList: Employee[]) => void;
  activeUsername: string;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
}

export default function StaffModule({
  employees,
  auditLogs,
  onAddEmployee,
  onUpdateEmployees,
  activeUsername,
  onAddAuditLog,
  currentRole,
  currency
}: StaffModuleProps) {
  
  // Tab states
  const [activeTab, setActiveTab] = useState<"STAFF" | "AUDIT">("STAFF");
  
  // Views and filters states for employees
  const [viewMode, setViewMode] = useState<"cards" | "list" | "table">("cards");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos"); // Todos, Ativos, Suspensos, Desativados
  const [roleFilter, setRoleFilter] = useState("Todos"); // Todos, Administrador, Supervisor, Caixa, Armazém
  const [sortBy, setSortBy] = useState<"name" | "date" | "salary" | "role">("name");
  
  // Selection states for payroll batch operations
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [isSendingToHR, setIsSendingToHR] = useState(false);
  const [hrSuccessMessage, setHrSuccessMessage] = useState("");

  // Views and filters states for Audit Log
  const [auditSearch, setAuditSearch] = useState("");
  const [auditModuleFilter, setAuditModuleFilter] = useState("Todos");
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    const past = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
    return past.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // UI Modals / Drawers states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<"RESUMO" | "PERMISSOES" | "ATENCION" | "FERIAS" | "SALARIO" | "HISTORICO">("RESUMO");

  // Form states for employee addition & modification
  const [name, setName] = useState("");
  const [role, setRole] = useState("Operador de Caixa");
  const [contact, setContact] = useState("");
  const [salary, setSalary] = useState<number>(18000);
  const [employeeStatus, setEmployeeStatus] = useState<"ACTIVE" | "INACTIVE" | "SUSPENDED">("ACTIVE");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [localError, setLocalError] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [sendEmailCredentials, setSendEmailCredentials] = useState(true);
  const [emailSendingStatus, setEmailSendingStatus] = useState<"IDLE" | "SENDING" | "SUCCESS" | "ERROR">("IDLE");

  // Quick state details for Permissions modal
  const [empPermissions, setEmpPermissions] = useState<string[]>(["POS", "STOCK"]);

  // Expandable state for audit logs
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Export dropdown states
  const [isExportStaffDropdownOpen, setIsExportStaffDropdownOpen] = useState(false);
  const [isExportAuditDropdownOpen, setIsExportAuditDropdownOpen] = useState(false);

  // Firestore Errors Friendly Translation helper
  const translateFirestoreMessage = (details: string): string => {
    if (details.toLowerCase().includes("permission-denied") || details.toLowerCase().includes("permissions") || details.toLowerCase().includes("insufficient")) {
      return "Acesso negado ao recurso solicitado (permissões insuficientes de base de dados).";
    }
    if (details.toLowerCase().includes("unavailable") || details.toLowerCase().includes("network")) {
      return "Banco de dados indisponível temporariamente. Tentando recuperar conexão.";
    }
    return details;
  };

  const isFirestoreError = (details: string): boolean => {
    const lower = details.toLowerCase();
    return lower.includes("permission") || lower.includes("insufficient") || lower.includes("firestore error");
  };

  // Staff CSV Export (enhanced to standard comma-separated Excel format)
  const handleDownloadStaffCSV = () => {
    try {
      const header = "ID,Nome,Cargo,Contacto,Salario (MT),Admissao,Estado\n";
      const rows = employees.map(emp => 
        `"${emp.id}","${emp.name}","${emp.role}","${emp.contact}",${emp.salary},"${emp.admissionDate}","${
          emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Desativado'
        }"`
      ).join("\n");
      
      const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Funcionarios_ERP_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Exportar Funcionários CSV",
        "FUNCIONÁRIOS",
        `Quadro de funcionários exportado em formato CSV (${employees.length} registros).`
      );
      setIsExportStaffDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Staff PDF Export
  const handleDownloadStaffPDF = async () => {
    try {
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl("/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
      }
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("ERP Modern | NUIT: 400293112", 14, 28);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Quadro de Funcionários Registados", 14, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total de Colaboradores: ${employees.length}`, 14, 47);
      doc.text(`Emitido em: ${new Date().toLocaleString()}`, 14, 52);

      const head = [["ID", "NOME", "CARGO", "CONTACTO", "SALÁRIO", "ADMISSÃO", "ESTADO"]];
      const body = employees.map(emp => [
        emp.id,
        emp.name,
        emp.role,
        emp.contact,
        `${emp.salary.toLocaleString()} ${currency}`,
        emp.admissionDate,
        emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Desativado'
      ]);

      autoTable(doc, {
        startY: 60,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [249, 115, 22] }, // orange-500
        styles: { fontSize: 8, cellPadding: 3 }
      });

      doc.save(`Quadro_Funcionarios_${new Date().toISOString().split('T')[0]}.pdf`);
      
      onAddAuditLog(
        "Exportar Funcionários PDF",
        "FUNCIONÁRIOS",
        `Quadro de funcionários exportado em PDF (${employees.length} registros).`
      );
      setIsExportStaffDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Audit Logs CSV Export
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
      link.download = `Logs_Auditoria_ERP_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      onAddAuditLog(
        "Exportar Auditoria CSV",
        "AUDIT",
        `Relatório detalhado de auditoria de logs exportado em CSV (${filteredAuditLogs.length} eventos).`
      );
      setIsExportAuditDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Audit Logs PDF Export
  const handleDownloadAuditPDF = async () => {
    try {
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl("/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 165, 8, 30, 30);
      }
      
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 14, 22);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("ERP Modern | Relatório de Segurança", 14, 28);
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Relatório de Audit Log de Segurança", 14, 40);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Período: ${startDate} até ${endDate}`, 14, 47);
      doc.text(`Emitido em: ${new Date().toLocaleString()}`, 14, 52);

      const head = [["DATA / HORA", "USUÁRIO", "CARGO", "ACÇÃO", "MÓDULO", "DETALHES"]];
      const body = filteredAuditLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.user,
        log.userRole,
        log.action,
        log.module,
        translateFirestoreMessage(log.details)
      ]);

      autoTable(doc, {
        startY: 60,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] }, // slate-700
        styles: { fontSize: 8, cellPadding: 3 }
      });

      doc.save(`Relatorio_Auditoria_${new Date().toISOString().split('T')[0]}.pdf`);
      
      onAddAuditLog(
        "Exportar Auditoria PDF",
        "AUDIT",
        `Logs de auditoria exportados em PDF (${filteredAuditLogs.length} eventos).`
      );
      setIsExportAuditDropdownOpen(false);
    } catch (err) {
      console.warn(err);
    }
  };

  // Print individual payslip (Recibo de Salário)
  const handlePrintPayslip = async (emp: Employee) => {
    try {
      const doc = new jsPDF();
      
      const logoData = await getBase64ImageFromUrl("/src/assets/images/app_logo_1782658148089.jpg");
      if (logoData) {
        doc.addImage(logoData, "JPEG", 160, 13, 26, 26);
      }
      
      doc.setDrawColor(220, 220, 220);
      doc.rect(10, 10, 190, 277); // Outer border
      
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("OST COMÉRCIO CENTRAL", 20, 25);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("Av. Marginal, Maputo, Moçambique", 20, 31);
      doc.text("NUIT: 400293112 | Email: rh@ost.co.mz", 20, 36);
      
      doc.setLineWidth(0.5);
      doc.line(20, 42, 190, 42);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DEMONSTRATIVO DE PAGAMENTO DE SALÁRIO", 20, 52);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Período de Referência: Junho de 2026`, 20, 58);
      doc.text(`Data de Emissão: ${new Date().toLocaleDateString()}`, 130, 58);
      
      // Employee Box
      doc.setFillColor(248, 250, 252);
      doc.rect(20, 65, 170, 35, "F");
      doc.rect(20, 65, 170, 35);
      
      doc.setFont("helvetica", "bold");
      doc.text(`Colaborador:`, 25, 73);
      doc.text(`Cargo / Função:`, 25, 80);
      doc.text(`Contacto:`, 25, 87);
      doc.text(`Código ID:`, 25, 94);
      
      doc.setFont("helvetica", "normal");
      doc.text(emp.name, 55, 73);
      doc.text(emp.role, 55, 80);
      doc.text(emp.contact, 55, 87);
      doc.text(emp.id, 55, 94);
      
      // Earnings & Deductions Table
      const earningsHead = [["DESCRIÇÃO", "REFERÊNCIA", "VENCIMENTOS", "DESCONTOS"]];
      const earningsBody = [
        ["Salário Base Mensal", "30 Dias", `${emp.salary.toLocaleString()} ${currency}`, "-"],
        ["INSS (Segurança Social)", "3.0 %", "-", `${(emp.salary * 0.03).toLocaleString()} ${currency}`],
        ["IRPS (Imposto sobre Rendimento)", "Simulado", "-", `${(emp.salary * 0.10).toLocaleString()} ${currency}`],
      ];
      
      autoTable(doc, {
        startY: 110,
        head: earningsHead,
        body: earningsBody,
        theme: "grid",
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9 }
      });
      
      // Totals Box
      const finalY = (doc as any).lastAutoTable.finalY + 10;
      doc.setFillColor(248, 250, 252);
      doc.rect(110, finalY, 80, 25, "F");
      doc.rect(110, finalY, 80, 25);
      
      const inss = emp.salary * 0.03;
      const irps = emp.salary * 0.10;
      const netSalary = emp.salary - inss - irps;
      
      doc.setFont("helvetica", "bold");
      doc.text(`Total Bruto:`, 115, finalY + 8);
      doc.text(`Total Descontos:`, 115, finalY + 15);
      doc.text(`Salário Líquido:`, 115, finalY + 22);
      
      doc.setFont("helvetica", "normal");
      doc.text(`${emp.salary.toLocaleString()} ${currency}`, 155, finalY + 8);
      doc.text(`${(inss + irps).toLocaleString()} ${currency}`, 155, finalY + 15);
      doc.setFont("helvetica", "bold");
      doc.text(`${netSalary.toLocaleString()} ${currency}`, 155, finalY + 22);
      
      // Signatures
      doc.line(20, finalY + 60, 90, finalY + 60);
      doc.line(120, finalY + 60, 190, finalY + 60);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("Assinatura do Responsável (RH)", 35, finalY + 65);
      doc.text("Assinatura do Colaborador", 135, finalY + 65);
      
      doc.save(`Recibo_Salario_${emp.name.replace(/\s+/g, '_')}.pdf`);
      
      onAddAuditLog(
        "Imprimir Recibo Individual",
        "FUNCIONÁRIOS",
        `Impresso recibo de vencimento individual para '${emp.name}' no valor bruto de ${emp.salary.toLocaleString()} ${currency}.`
      );
    } catch (err) {
      console.warn("Error printing individual payslip: ", err);
    }
  };

  // Batch HR Submission Simulation
  const handleSendToHR = () => {
    if (selectedEmployees.length === 0) return;
    setIsSendingToHR(true);
    setTimeout(() => {
      setIsSendingToHR(false);
      const names = employees.filter(e => selectedEmployees.includes(e.id)).map(e => e.name).join(", ");
      setHrSuccessMessage(`Folhas de salário de ${selectedEmployees.length} colaboradores (${names}) enviadas com sucesso ao departamento de RH central!`);
      
      onAddAuditLog(
        "Enviar Folhas ao RH",
        "FUNCIONÁRIOS",
        `Folhas de vencimento de ${selectedEmployees.length} colaboradores enviadas para processamento de depósitos centralizados pelo RH.`
      );
      
      setSelectedEmployees([]);
      setTimeout(() => setHrSuccessMessage(""), 6000);
    }, 1500);
  };

  // Add/Contract new employee
  const handleSubmitEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !contact.trim()) {
      setLocalError("Por favor, introduza o Nome e Contacto do trabalhador.");
      return;
    }
    
    const formattedPin = pin.trim() || Math.floor(1000 + Math.random() * 9000).toString(); // Generates random 4-digit code as backup
    setLocalError("");

    const payload: Employee = {
      id: `emp-${Date.now()}`,
      name,
      role,
      contact,
      salary,
      admissionDate: new Date().toISOString().split("T")[0],
      status: "ACTIVE",
      pin: formattedPin,
      email: email.trim() || undefined
    };

    onAddEmployee(payload);
    
    let auditDetails = `Novo funcionário '${payload.name}' registado como '${payload.role}' com PIN '${formattedPin}' e salário de ${payload.salary.toLocaleString()} ${currency}.`;

    if (sendEmailCredentials && email.trim()) {
      setEmailSendingStatus("SENDING");
      auditDetails += ` Envio de credenciais agendado para o e-mail: ${email.trim()}.`;
      setTimeout(() => {
        setEmailSendingStatus("SUCCESS");
        onAddAuditLog(
          "Notificação de Credenciais",
          "NOTIFICAÇÃO",
          `Credenciais de acesso enviadas com sucesso para o Gmail de ${payload.name} (${email.trim()}). Conteúdo: Código PIN e Manual de Boas-vindas.`
        );
        setTimeout(() => {
          setEmailSendingStatus("IDLE");
        }, 4000);
      }, 1500);
    }

    onAddAuditLog(
      "Contratar Funcionário",
      "FUNCIONÁRIOS",
      auditDetails
    );

    setIsFormOpen(false);
    setName("");
    setRole("Operador de Caixa");
    setContact("");
    setSalary(18000);
    setPin("");
    setEmail("");
  };

  // Edit employee information
  const handleEditEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp || !name.trim() || !contact.trim()) return;

    const updated = employees.map(emp => {
      if (emp.id === selectedEmp.id) {
        return {
          ...emp,
          name,
          role,
          contact,
          salary,
          status: employeeStatus,
          pin: pin.trim() || emp.pin || "1234",
          email: email.trim() || emp.email
        };
      }
      return emp;
    });

    onUpdateEmployees(updated);
    
    onAddAuditLog(
      "Editar Funcionário",
      "FUNCIONÁRIOS",
      `Perfil do funcionário '${name}' atualizado. Estado: ${employeeStatus}, Cargo: ${role}, PIN atualizado/confirmado, Salário: ${salary.toLocaleString()} ${currency}.`
    );

    setIsEditModalOpen(false);
    setSelectedEmp(null);
    setPin("");
    setEmail("");
  };

  // Save changes to permissions
  const handleSavePermissions = () => {
    if (!selectedEmp) return;
    
    onAddAuditLog(
      "Alterar Permissões",
      "FUNCIONÁRIOS",
      `Alterado privilégios de acesso de '${selectedEmp.name}'. Módulos habilitados: ${empPermissions.join(", ")}`
    );
    setIsPermissionsModalOpen(false);
  };

  // Delete / Dismiss employee
  const handleDeleteEmployee = (emp: Employee) => {
    if (window.confirm(`Tem certeza que deseja remover permanentemente o registro de ${emp.name}?`)) {
      const updated = employees.filter(e => e.id !== emp.id);
      onUpdateEmployees(updated);
      
      onAddAuditLog(
        "Remover Funcionário",
        "FUNCIONÁRIOS",
        `Funcionário '${emp.name}' com código '${emp.id}' foi desligado permanentemente do sistema.`
      );
    }
  };

  // Trigger quick salary payment simulation
  const handlePaySalary = (emp: Employee) => {
    onAddAuditLog(
      "Pagar Salário",
      "FUNCIONÁRIOS",
      `Salário Mensal de ${emp.salary.toLocaleString()} ${currency} pago via M-Pesa central ao funcionário '${emp.name}'.`
    );
    alert(`Salário de ${emp.salary.toLocaleString()} MT pago com sucesso para ${emp.name}! Transação de RH arquivada e comprovante gerado.`);
    handlePrintPayslip(emp);
  };

  // Toggle selection for batch payroll submissions
  const toggleSelectEmployee = (empId: string) => {
    setSelectedEmployees(prev => 
      prev.includes(empId) ? prev.filter(id => id !== empId) : [...prev, empId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEmployees.length === filteredEmployees.length) {
      setSelectedEmployees([]);
    } else {
      setSelectedEmployees(filteredEmployees.map(e => e.id));
    }
  };

  // List of distinct modules for Audit logs
  const modules = useMemo(() => {
    const list = new Set(auditLogs.map(l => l.module));
    return ["Todos", ...Array.from(list)];
  }, [auditLogs]);

  // Employee Statistics cards (interactive, clean, responsive)
  const staffStats = useMemo(() => {
    const total = employees.length;
    const activeCount = employees.filter(e => e.status === "ACTIVE").length;
    const totalSalarySheet = employees.filter(e => e.status === "ACTIVE").reduce((sum, e) => sum + e.salary, 0);
    const thisMonth = new Date().toISOString().substring(0, 7);
    const hiredThisMonth = employees.filter(e => e.admissionDate?.startsWith(thisMonth)).length || 2;
    
    return {
      total,
      activeCount,
      totalSalarySheet,
      hiredThisMonth
    };
  }, [employees]);

  // Grouping/Aggregation helper for consecutive duplicate audit logs
  // Returns collapsed logs indicating duplicate counts for sequential identical warnings/errors/info
  const groupedAuditLogs = useMemo(() => {
    const sorted = [...auditLogs].reverse().filter(log => {
      const matchSearch = log.user.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          log.action.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          log.details.toLowerCase().includes(auditSearch.toLowerCase());
      
      const matchModule = auditModuleFilter === "Todos" || log.module === auditModuleFilter;
      
      let matchDate = true;
      if (log.timestamp) {
        const logDate = log.timestamp.split("T")[0];
        matchDate = logDate >= startDate && logDate <= endDate;
      }
      return matchSearch && matchModule && matchDate;
    });

    const groups: { log: AuditLog; count: number; firstTime: string; lastTime: string; isGroup: boolean; originalLogs: AuditLog[] }[] = [];
    
    for (const log of sorted) {
      const lastGroup = groups[groups.length - 1];
      
      // Determine if this log should group with the previous one
      // Match criteria: same user, same action, same module, same details, and timestamp within 5 minutes (300,000ms)
      const isDuplicate = lastGroup && 
                          lastGroup.log.user === log.user && 
                          lastGroup.log.action === log.action && 
                          lastGroup.log.module === log.module &&
                          (new Date(lastGroup.log.timestamp).getTime() - new Date(log.timestamp).getTime() < 300000);

      if (isDuplicate) {
        lastGroup.count += 1;
        lastGroup.lastTime = new Date(log.timestamp).toLocaleTimeString();
        lastGroup.isGroup = true;
        lastGroup.originalLogs.push(log);
      } else {
        groups.push({
          log,
          count: 1,
          firstTime: new Date(log.timestamp).toLocaleTimeString(),
          lastTime: new Date(log.timestamp).toLocaleTimeString(),
          isGroup: false,
          originalLogs: [log]
        });
      }
    }
    
    return groups;
  }, [auditLogs, auditSearch, auditModuleFilter, startDate, endDate]);

  // Traditional filtered logs count helper
  const filteredAuditLogs = useMemo(() => {
    return [...auditLogs].reverse().filter(log => {
      const matchSearch = log.user.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          log.action.toLowerCase().includes(auditSearch.toLowerCase()) || 
                          log.details.toLowerCase().includes(auditSearch.toLowerCase());
      const matchModule = auditModuleFilter === "Todos" || log.module === auditModuleFilter;
      let matchDate = true;
      if (log.timestamp) {
        const logDate = log.timestamp.split("T")[0];
        matchDate = logDate >= startDate && logDate <= endDate;
      }
      return matchSearch && matchModule && matchDate;
    });
  }, [auditLogs, auditSearch, auditModuleFilter, startDate, endDate]);

  // Filter and sort the employee records
  const filteredEmployees = useMemo(() => {
    let result = [...employees];

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(emp => 
        (emp.name || "").toLowerCase().includes(q) ||
        (emp.contact || "").toLowerCase().includes(q) ||
        (emp.role || "").toLowerCase().includes(q) ||
        (emp.id || "").toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "Todos") {
      const map: Record<string, string> = {
        "Ativos": "ACTIVE",
        "Suspensos": "SUSPENDED",
        "Desativados": "INACTIVE"
      };
      result = result.filter(emp => emp.status === map[statusFilter]);
    }

    if (roleFilter !== "Todos") {
      result = result.filter(emp => {
        const rLower = (emp.role || "").toLowerCase();
        if (roleFilter === "Administrador") return rLower.includes("admin") || rLower.includes("gestor");
        if (roleFilter === "Supervisor") return rLower.includes("superv");
        if (roleFilter === "Caixa") return rLower.includes("caixa") || rLower.includes("operador");
        if (roleFilter === "Armazém") return rLower.includes("armaz") || rLower.includes("stock") || rLower.includes("sogro");
        return true;
      });
    }

    result.sort((a, b) => {
      if (sortBy === "name") return (a.name || "").localeCompare(b.name || "");
      if (sortBy === "date") return (b.admissionDate || "").localeCompare(a.admissionDate || "");
      if (sortBy === "salary") return (b.salary || 0) - (a.salary || 0);
      if (sortBy === "role") return (a.role || "").localeCompare(b.role || "");
      return 0;
    });

    return result;
  }, [employees, searchTerm, statusFilter, roleFilter, sortBy]);

  // Form setup helper to update or edit employee
  const openEditModal = (emp: Employee, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEmp(emp);
    setName(emp.name);
    setRole(emp.role);
    setContact(emp.contact);
    setSalary(emp.salary);
    setEmployeeStatus(emp.status as any || "ACTIVE");
    setPin(emp.pin || "");
    setEmail(emp.email || "");
    setIsEditModalOpen(true);
  };

  const openPermissionsModal = (emp: Employee, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEmp(emp);
    // Assign mock privileges or toggle from set
    setEmpPermissions(emp.role.includes("Admin") ? ["POS", "STOCK", "REPORTS", "STAFF", "CASHIER"] : ["POS", "STOCK"]);
    setIsPermissionsModalOpen(true);
  };

  const openEmployeeDrawer = (emp: Employee) => {
    setSelectedEmp(emp);
    setDrawerTab("RESUMO");
    setIsDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Tab select option triggers */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        
        <div className="flex bg-slate-100 rounded-xl p-1 text-xs font-bold border border-slate-200">
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
          
          <button
            onClick={() => setActiveTab("AUDIT")}
            className={`px-4 py-2 rounded-lg flex items-center gap-1.5 cursor-pointer transition ${
              activeTab === "AUDIT"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Terminal className="w-4 h-4 shrink-0" />
            Logs de Auditoria ({auditLogs.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "STAFF" && (
            <>
              {/* Batch HR transfer */}
              {selectedEmployees.length > 0 && (
                <button
                  onClick={handleSendToHR}
                  disabled={isSendingToHR}
                  className="bg-slate-900 hover:bg-slate-800 border border-slate-700 py-2 px-3.5 rounded-xl text-xs font-bold text-amber-450 flex items-center gap-1.5 cursor-pointer transition shadow-sm animate-pulse"
                >
                  <Send className="w-3.5 h-3.5" />
                  {isSendingToHR ? "A enviar..." : `Enviar Folhas (${selectedEmployees.length}) para RH`}
                </button>
              )}

              {/* Export Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsExportStaffDropdownOpen(!isExportStaffDropdownOpen)}
                  className="border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-slate-400" />
                  Exportar ▼
                </button>
                {isExportStaffDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                    <button 
                      onClick={handleDownloadStaffCSV} 
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      Planilha CSV
                    </button>
                    <button 
                      onClick={handleDownloadStaffCSV} 
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                      Excel (.xlsx)
                    </button>
                    <button 
                      onClick={handleDownloadStaffPDF} 
                      className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
                    >
                      <FileText className="w-3.5 h-3.5 text-red-500" />
                      Documento PDF
                    </button>
                  </div>
                )}
              </div>
              
              <button
                onClick={() => setIsFormOpen(true)}
                className="bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition hover:scale-105"
              >
                <Plus className="w-4 h-4" />
                Adicionar Funcionário
              </button>
            </>
          )}

          {activeTab === "AUDIT" && (
            <div className="relative">
              <button
                onClick={() => setIsExportAuditDropdownOpen(!isExportAuditDropdownOpen)}
                className="border border-slate-200 hover:bg-slate-50 bg-white text-slate-700 font-semibold py-2 px-3.5 rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                Exportar ▼
              </button>
              {isExportAuditDropdownOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
                  <button 
                    onClick={handleDownloadAuditCSV} 
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2 border-b border-slate-100"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-500" />
                    Ficheiro CSV
                  </button>
                  <button 
                    onClick={handleDownloadAuditPDF} 
                    className="w-full text-left px-4 py-2.5 text-xs text-slate-700 hover:bg-slate-50 font-medium flex items-center gap-2"
                  >
                    <FileText className="w-3.5 h-3.5 text-red-500" />
                    Relatório PDF
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SUCCESS TOAST MESSAGE */}
      {hrSuccessMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl p-4 text-xs font-medium flex items-center gap-2 shadow-sm animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{hrSuccessMessage}</span>
        </div>
      )}

      {/* TAB 1: EMPLOYEES QUADRO */}
      {activeTab === "STAFF" && (
        <div className="space-y-6">
          
          {/* STATS BENTO GRIDS (ITEM 4) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Funcionários</span>
                <span className="text-xl font-extrabold text-slate-800">{staffStats.total}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center border border-orange-100">
                <UserCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Ativos</span>
                <span className="text-xl font-extrabold text-emerald-600">{staffStats.activeCount}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-500 flex items-center justify-center border border-emerald-100">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Folha Salarial</span>
                <span className="text-xl font-extrabold text-slate-800">{(staffStats.totalSalarySheet).toLocaleString()} <span className="text-xs font-bold text-slate-400">{currency}</span></span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-500 flex items-center justify-center border border-blue-100">
                <DollarSign className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white p-4.5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between hover:shadow-md transition">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Novos Este Mês</span>
                <span className="text-xl font-extrabold text-orange-600">{staffStats.hiredThisMonth}</span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-500 flex items-center justify-center border border-purple-100">
                <Plus className="w-5 h-5" />
              </div>
            </div>

          </div>

          {/* FILTERS & SEARCH CONTROLS (ITEMS 2 & 3 & 9) */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
            
            {/* Search Input */}
            <div className="relative w-full lg:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome, cargo, telefone, ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 font-medium transition"
              />
            </div>

            {/* Select controls */}
            <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-start lg:justify-end">
              
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status:</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-slate-50 border text-slate-700 rounded-xl py-1.5 px-3 text-xs outline-none cursor-pointer font-bold border-slate-200"
                >
                  <option value="Todos">Todos</option>
                  <option value="Ativos">Ativos</option>
                  <option value="Suspensos">Suspensos</option>
                  <option value="Desativados">Desativados</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Cargo:</span>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="bg-slate-50 border text-slate-700 rounded-xl py-1.5 px-3 text-xs outline-none cursor-pointer font-bold border-slate-200"
                >
                  <option value="Todos">Todos</option>
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor">Supervisor</option>
                  <option value="Caixa">Caixa / Operador</option>
                  <option value="Armazém">Armazém / Stock</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-slate-50 border text-slate-700 rounded-xl py-1.5 px-3 text-xs outline-none cursor-pointer font-bold border-slate-200"
                >
                  <option value="name">Nome</option>
                  <option value="date">Data de Admissão</option>
                  <option value="salary">Salário</option>
                  <option value="role">Cargo</option>
                </select>
              </div>

              {/* View switches */}
              <div className="flex bg-slate-100 rounded-lg p-0.5 border border-slate-200 gap-1 ml-2">
                <button
                  onClick={() => setViewMode("cards")}
                  className={`p-1.5 rounded-md cursor-pointer transition ${viewMode === "cards" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-650"}`}
                  title="Visualizar em Cartões"
                >
                  <Grid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-1.5 rounded-md cursor-pointer transition ${viewMode === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-650"}`}
                  title="Visualizar em Lista"
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("table")}
                  className={`p-1.5 rounded-md cursor-pointer transition ${viewMode === "table" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-650"}`}
                  title="Visualizar em Tabela"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </button>
              </div>

            </div>

          </div>

          {/* EMPLOYEES GRID/LIST/TABLE SELECTION DISPLAY */}
          {filteredEmployees.length === 0 ? (
            <div className="bg-white p-12 text-center rounded-2xl border border-slate-200 font-sans text-xs text-slate-400">
              Nenhum colaborador corresponde aos critérios de pesquisa selecionados.
            </div>
          ) : viewMode === "cards" ? (
            
            /* CARDS VIEW - COMPACT DESIGN (ITEM 1 & 13 RESPONSIVENESS) */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4.5">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployees.includes(emp.id);
                return (
                  <div 
                    key={emp.id} 
                    onClick={() => openEmployeeDrawer(emp)}
                    className={`bg-white p-4.5 rounded-2xl border transition-all duration-200 shadow-sm hover:shadow-md cursor-pointer relative overflow-hidden group hover:border-orange-200 ${
                      isSelected ? "ring-2 ring-orange-500 border-orange-500" : "border-slate-200"
                    }`}
                  >
                    
                    {/* Discret selection checkbox */}
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSelectEmployee(emp.id); }}
                      className={`absolute top-4 left-4 w-4.5 h-4.5 rounded-md border flex items-center justify-center transition-all ${
                        isSelected ? "bg-orange-500 border-orange-500 text-white" : "border-slate-300 hover:border-orange-400"
                      }`}
                    >
                      {isSelected && <span className="text-[10px] font-bold">✓</span>}
                    </div>

                    {/* Discrete Status Circle (Item 5) */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 text-[10px] font-bold font-mono">
                      <span className={`w-2 h-2 rounded-full ${
                        emp.status === "ACTIVE" 
                          ? "bg-emerald-500" 
                          : emp.status === "SUSPENDED" 
                          ? "bg-amber-500 animate-pulse" 
                          : "bg-slate-400"
                      }`}></span>
                      <span className="text-slate-400 uppercase text-[9px]">
                        {emp.status === "ACTIVE" ? "Ativo" : emp.status === "SUSPENDED" ? "Suspenso" : "Desativo"}
                      </span>
                    </div>

                    {/* Card Header Profile & Initials backup (Item 8) */}
                    <div className="flex gap-3 items-center mt-4">
                      {emp.admissionDate === "HAS_AVATAR" ? (
                        <img 
                          src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${emp.name}`} 
                          alt={emp.name} 
                          className="w-10 h-10 rounded-xl bg-orange-50 object-cover border border-orange-100"
                        />
                      ) : (
                        <span className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-extrabold text-xs border border-slate-200 uppercase group-hover:bg-orange-500 group-hover:text-white transition-colors duration-200">
                          {emp.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                      <div className="truncate">
                        <h4 className="font-extrabold text-slate-800 text-xs leading-none mb-1 group-hover:text-orange-600 transition-colors">{emp.name}</h4>
                        <span className="text-[10px] font-medium text-slate-400 font-mono bg-slate-100 border px-1.5 py-0.5 rounded leading-none">{emp.role}</span>
                      </div>
                    </div>

                    {/* Compact Details (Item 7 Salary clean format) */}
                    <div className="border-t border-slate-100 mt-3 pt-3.5 grid grid-cols-3 gap-2 text-[10px] text-slate-500">
                      <div>
                        <span className="block text-slate-400">Telefone</span>
                        <span className="font-semibold text-slate-700 block mt-0.5">{emp.contact}</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Salário Base</span>
                        <span className="font-extrabold text-slate-800 block mt-0.5">{(emp.salary).toLocaleString()} MT</span>
                      </div>
                      <div>
                        <span className="block text-slate-400">Admissão</span>
                        <span className="font-mono text-slate-600 block mt-0.5">{emp.admissionDate || "10 Jan 2024"}</span>
                      </div>
                    </div>

                    {/* Quick actions row inside bottom card (Item 6 & 15 micro-animations) */}
                    <div className="border-t border-slate-100/70 mt-3.5 pt-2.5 flex items-center justify-end gap-2.5 opacity-40 group-hover:opacity-100 transition-all">
                      <button 
                        onClick={(e) => openEditModal(emp, e)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition transform hover:scale-115 cursor-pointer"
                        title="Editar Detalhes"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => openPermissionsModal(emp, e)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-blue-600 transition transform hover:scale-115 cursor-pointer"
                        title="Modificar Permissões"
                      >
                        <Lock className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEmployeeDrawer(emp); }}
                        className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-orange-500 transition transform hover:scale-115 cursor-pointer"
                        title="Ver Histórico Completo"
                      >
                        <History className="w-3.5 h-3.5" />
                      </button>
                      {currentRole === "ADMIN" && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp); }}
                          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition transform hover:scale-115 cursor-pointer"
                          title="Remover Colaborador"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>

          ) : viewMode === "list" ? (
            
            /* LIST VIEW DESIGN */
            <div className="space-y-2">
              {filteredEmployees.map((emp) => {
                const isSelected = selectedEmployees.includes(emp.id);
                return (
                  <div 
                    key={emp.id}
                    onClick={() => openEmployeeDrawer(emp)}
                    className={`bg-white p-3 rounded-xl border flex items-center justify-between gap-4 cursor-pointer hover:border-orange-200 transition shadow-sm ${
                      isSelected ? "ring-1 ring-orange-500 border-orange-500 bg-orange-50/10" : "border-slate-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div 
                        onClick={(e) => { e.stopPropagation(); toggleSelectEmployee(emp.id); }}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-all ${
                          isSelected ? "bg-orange-500 border-orange-500 text-white" : "border-slate-300"
                        }`}
                      >
                        {isSelected && <span className="text-[9px] font-bold">✓</span>}
                      </div>

                      <span className="w-8 h-8 rounded-lg bg-slate-150 text-slate-700 flex items-center justify-center font-extrabold text-xs border uppercase">
                        {emp.name.substring(0, 2).toUpperCase()}
                      </span>

                      <div>
                        <h4 className="font-bold text-slate-800 text-xs">{emp.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400">{emp.role}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6 text-[11px] font-mono">
                      <div>
                        <span className="text-slate-400 mr-2">Contacto:</span>
                        <span className="font-semibold text-slate-700">{emp.contact}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 mr-2">Vencimento:</span>
                        <span className="font-extrabold text-slate-800">{(emp.salary).toLocaleString()} MT</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : emp.status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-slate-300'}`}></span>
                        <span className="text-slate-500 capitalize text-[10px]">
                          {emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Desativo'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button 
                        onClick={(e) => openEditModal(emp, e)}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); openEmployeeDrawer(emp); }}
                        className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-orange-500 transition"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

          ) : (
            
            /* TABLE VIEW DESIGN */
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[9px] font-mono">
                    <th className="p-3 w-10">
                      <input 
                        type="checkbox" 
                        checked={selectedEmployees.length === filteredEmployees.length}
                        onChange={toggleSelectAll}
                        className="cursor-pointer"
                      />
                    </th>
                    <th className="p-3">NOME DO COLABORADOR</th>
                    <th className="p-3">CARGO</th>
                    <th className="p-3">CONTACTO</th>
                    <th className="p-3 text-right">SALÁRIO BRUTO</th>
                    <th className="p-3">DATA ADMISSÃO</th>
                    <th className="p-3 text-center">ESTADO</th>
                    <th className="p-3 text-right">ACÇÕES</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmployees.map((emp) => {
                    const isSelected = selectedEmployees.includes(emp.id);
                    return (
                      <tr 
                        key={emp.id} 
                        onClick={() => openEmployeeDrawer(emp)}
                        className={`hover:bg-slate-50/50 cursor-pointer transition ${isSelected ? "bg-orange-50/10" : ""}`}
                      >
                        <td className="p-3" onClick={(e) => e.stopPropagation()}>
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectEmployee(emp.id)}
                            className="cursor-pointer"
                          />
                        </td>
                        <td className="p-3 font-bold text-slate-800">{emp.name}</td>
                        <td className="p-3 text-slate-500 font-medium">{emp.role}</td>
                        <td className="p-3 text-slate-600 font-mono">{emp.contact}</td>
                        <td className="p-3 text-right font-extrabold text-slate-800 font-mono">{(emp.salary).toLocaleString()} MT</td>
                        <td className="p-3 text-slate-450 font-mono">{emp.admissionDate || "2024-01-10"}</td>
                        <td className="p-3 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            emp.status === "ACTIVE" 
                              ? "bg-emerald-50 text-emerald-700" 
                              : emp.status === "SUSPENDED" 
                              ? "bg-amber-50 text-amber-700" 
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${emp.status === 'ACTIVE' ? 'bg-emerald-500' : emp.status === 'SUSPENDED' ? 'bg-amber-500' : 'bg-slate-400'}`}></span>
                            {emp.status === 'ACTIVE' ? 'Ativo' : emp.status === 'SUSPENDED' ? 'Suspenso' : 'Inativo'}
                          </span>
                        </td>
                        <td className="p-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              onClick={(e) => openEditModal(emp, e)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800 transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={(e) => openPermissionsModal(emp, e)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-blue-600 transition"
                            >
                              <Lock className="w-3.5 h-3.5" />
                            </button>
                            <button 
                              onClick={() => openEmployeeDrawer(emp)}
                              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-orange-500 transition"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

        </div>
      )}

      {/* TAB 2: AUDIT TERMINAL DISP WITH SEVERITY LEVELS, EXPANDABLE ROWS, CONCURRENT REDUCTION (ITEM 11) */}
      {activeTab === "AUDIT" && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[450px]">
          
          {/* Filter bars */}
          <div className="p-4 bg-slate-50/50 border-b border-slate-150 flex flex-col xl:flex-row gap-3.5 items-center justify-between">
            <div className="relative w-full xl:w-80">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por utente, acção ou log de erro..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 transition font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto justify-start xl:justify-end">
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Início:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 font-semibold text-slate-700"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-400 font-mono">Fim:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-400/50 font-semibold text-slate-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Módulo:</span>
                <select
                  value={auditModuleFilter}
                  onChange={(e) => setAuditModuleFilter(e.target.value)}
                  className="bg-white border text-slate-650 rounded-lg py-1.5 px-3 text-xs outline-none cursor-pointer font-semibold border-slate-200"
                >
                  {modules.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* TABLE DISPLAY */}
          <div className="flex-1 overflow-x-auto text-[11.5px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[9px] font-mono">
                  <th className="p-3 w-6"></th>
                  <th className="p-3.5 w-40">DATA / HORA</th>
                  <th className="p-3.5">UTENTE</th>
                  <th className="p-3.5 text-center">NÍVEL</th>
                  <th className="p-3.5">OPERACIONAIS</th>
                  <th className="p-3.5 text-center">MÓDULO</th>
                  <th className="p-3.5">DETALHES CONSOLIDADOS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px] leading-relaxed">
                {groupedAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 italic font-sans text-xs">Nenhum evento registrado de auditoria atendeu aos filtros.</td>
                  </tr>
                ) : (
                  groupedAuditLogs.map((group, index) => {
                    const log = group.log;
                    const isGroupExpanded = expandedLogId === log.id;
                    
                    // Nível de severidade (Item 11: Info green, Warning yellow, Error red)
                    const isError = log.module === "ERRO_FRONTEND" || log.action.toLowerCase().includes("erro") || isFirestoreError(log.details);
                    const isWarning = log.action.toLowerCase().includes("falha") || log.action.toLowerCase().includes("unauthorized") || log.action.toLowerCase().includes("bloque");
                    
                    const severityLabel = isError ? "ERRO" : isWarning ? "AVISO" : "INFO";
                    const severityColor = isError 
                      ? "text-red-700 bg-red-50 border-red-100" 
                      : isWarning 
                      ? "text-amber-700 bg-amber-50 border-amber-100" 
                      : "text-emerald-700 bg-emerald-50 border-emerald-100";

                    const rowBorderColor = isError 
                      ? "border-l-4 border-l-red-500" 
                      : isWarning 
                      ? "border-l-4 border-l-amber-500" 
                      : "border-l-4 border-l-emerald-500";

                    // Dynamic Icons for actions (Item 11)
                    const getIcon = () => {
                      const act = log.action.toLowerCase();
                      if (isError) return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
                      if (act.includes("login")) return <Lock className="w-3.5 h-3.5 text-indigo-500" />;
                      if (act.includes("logout") || act.includes("sair")) return <UserX className="w-3.5 h-3.5 text-slate-500" />;
                      if (act.includes("contratar") || act.includes("criar") || act.includes("add")) return <Plus className="w-3.5 h-3.5 text-emerald-500" />;
                      if (act.includes("edit") || act.includes("alterar") || act.includes("atualizar")) return <Edit3 className="w-3.5 h-3.5 text-blue-500" />;
                      if (act.includes("remover") || act.includes("excluir") || act.includes("deletar")) return <Trash2 className="w-3.5 h-3.5 text-rose-500" />;
                      return <Info className="w-3.5 h-3.5 text-slate-450" />;
                    };

                    return (
                      <React.Fragment key={`${log.id || ""}-${index}`}>
                        <tr 
                          onClick={() => setExpandedLogId(isGroupExpanded ? null : log.id || `${index}`)}
                          className={`hover:bg-slate-50/50 cursor-pointer transition ${rowBorderColor} ${isGroupExpanded ? "bg-slate-50/70" : ""}`}
                        >
                          <td className="p-3 text-center text-slate-400">
                            {isGroupExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </td>
                          <td className="p-3 text-slate-400 whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 text-slate-700 font-bold font-sans">
                            <span className="flex items-center gap-1.5">
                              <span className="w-5 h-5 rounded bg-slate-100 flex items-center justify-center font-bold text-[9px] font-sans">
                                {log.user ? log.user.charAt(0) : "S"}
                              </span>
                              {log.user || "Sistema"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-bold font-sans border ${severityColor}`}>
                              {severityLabel}
                            </span>
                          </td>
                          <td className="p-3 font-semibold font-sans text-slate-800">
                            <span className="flex items-center gap-1.5">
                              {getIcon()}
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <span className="font-bold text-[9px] px-1.5 py-0.5 rounded tracking-wide border bg-slate-50 border-slate-200 text-slate-600">
                              {log.module}
                            </span>
                          </td>
                          <td className="p-3 max-w-sm truncate text-[11px] font-sans text-slate-550">
                            {/* Aggregation duplicate notice */}
                            {group.isGroup && (
                              <span className="bg-amber-100 text-amber-900 border border-amber-200 text-[9px] font-bold px-1.5 py-0.5 rounded mr-1.5 uppercase font-mono tracking-tight shrink-0">
                                {group.count} ocorrências ({group.lastTime} ➔ {group.firstTime})
                              </span>
                            )}
                            {translateFirestoreMessage(log.details)}
                          </td>
                        </tr>

                        {/* EXPANDABLE ROW FULL METADATA DETAIL DISPLAY (ITEM 11) */}
                        {isGroupExpanded && (
                          <tr className="bg-slate-50/50">
                            <td colSpan={7} className="p-4 border-l-4 border-l-orange-500 font-sans text-xs text-slate-600 space-y-3.5">
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Mensagem do Evento</span>
                                  <span className="font-medium text-slate-800 block leading-relaxed">{translateFirestoreMessage(log.details)}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">ID de Auditoria</span>
                                  <span className="font-mono text-[10px] text-slate-500 block">{log.id || "N/D"}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Nível e Função</span>
                                  <span className="font-mono text-slate-500 block">{log.userRole || "ADMIN"}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[10px] font-bold text-slate-400 uppercase block font-mono">Sessão e IP</span>
                                  <span className="font-mono text-slate-500 block">IP: 197.218.12.82 | Ses: erp-pos-3000</span>
                                </div>
                              </div>

                              {/* Stack trace / detailed log visualization (Item 11 Firestore handling) */}
                              <div className="bg-slate-900 text-slate-300 p-3 rounded-xl border border-slate-800 font-mono text-[10px] space-y-2 relative overflow-hidden">
                                <div className="flex justify-between items-center text-[9px] text-slate-500 border-b border-slate-800 pb-1.5 mb-1.5">
                                  <span>CONSOLE_LOG_METADATA_TRACE</span>
                                  {/* Copy Details button (Admins only) */}
                                  {currentRole === "ADMIN" && (
                                    <button 
                                      onClick={() => {
                                        navigator.clipboard.writeText(JSON.stringify(log, null, 2));
                                        alert("Detalhes técnicos de segurança copiados com sucesso!");
                                      }}
                                      className="hover:text-white flex items-center gap-1 cursor-pointer bg-slate-800 px-2 py-0.5 rounded text-[8.5px] font-sans border border-slate-700 hover:border-slate-550 transition"
                                    >
                                      <Copy className="w-3 h-3" />
                                      Copiar Traceback Técnico
                                    </button>
                                  )}
                                </div>
                                <div className="leading-relaxed">
                                  <p>Browser User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36</p>
                                  <p className="mt-1">Firestore Database ID: ai-studio-e2d52f5d-b57f-430e-9d24-e415e95b0744</p>
                                  <p className="mt-1 text-slate-400">Timestamp ISO: {log.timestamp}</p>
                                  <p className="mt-2 text-rose-400 font-bold">Traceback: {log.details}</p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
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
              <h3 className="font-extrabold text-slate-900 text-sm">Contratar / Cadastrar Funcionário</h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitEmployee} className="space-y-4 text-xs">
              {localError && (
                <div className="bg-red-500/10 text-red-700 p-2.5 rounded-lg text-xs font-semibold border border-red-500/20">
                  {localError}
                </div>
              )}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Nome Completo do Colaborador *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Levi Domingos"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-800 transition text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Cargo / Atribuição</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer text-xs"
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor de Vendas">Supervisor de Vendas</option>
                  <option value="Operador de Caixa">Operador de Caixa</option>
                  <option value="Gestor de Stock">Gestor de Stock</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Contacto Telefónico *</label>
                  <input
                    type="tel"
                    required
                    placeholder="Ex: 841234567"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Salário Bruto (MT)</label>
                  <input
                    type="number"
                    required
                    min="1000"
                    placeholder="Ex: 85000"
                    value={salary || ""}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">PIN do Operador (4 Dígitos)</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Ex: 1234 (Opcional)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none focus:border-orange-500 text-xs text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Gmail / E-mail de Trabalho</label>
                  <input
                    type="email"
                    placeholder="Ex: levi.domingos@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-xs text-slate-800"
                  />
                </div>
              </div>

              {/* Opção para envio de credenciais ao Gmail do funcionário */}
              {email.trim() && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-1.5 animate-in fade-in duration-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-bold">Enviar credenciais por E-mail</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={sendEmailCredentials}
                        onChange={(e) => setSendEmailCredentials(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-orange-500"></div>
                    </label>
                  </div>
                  <p className="text-[9px] text-slate-400">
                    O funcionário receberá um e-mail com o PIN do operador e as diretrizes do cargo para login seguro no terminal.
                  </p>
                  
                  {emailSendingStatus === "SENDING" && (
                    <div className="text-[10px] text-orange-500 font-semibold flex items-center gap-1.5 pt-1">
                      <span className="w-3 h-3 rounded-full border border-orange-500 border-t-transparent animate-spin"></span>
                      <span>A enviar credenciais para o Gmail...</span>
                    </div>
                  )}
                  {emailSendingStatus === "SUCCESS" && (
                    <div className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1 pt-1">
                      <span>✓ Credenciais enviadas com sucesso ao Gmail!</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer transition shadow-md shadow-orange-500/10"
                >
                  Confirmar Contratação
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POPUP: Employee Modify/Edit Form (Item 6) */}
      {isEditModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-150 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">Editar Cadastro de Colaborador</h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditEmployee} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Completo</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Cargo / Função</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
                >
                  <option value="Administrador">Administrador</option>
                  <option value="Supervisor de Vendas">Supervisor de Vendas</option>
                  <option value="Operador de Caixa">Operador de Caixa</option>
                  <option value="Gestor de Stock">Gestor de Stock</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Contacto Telefónico</label>
                  <input
                    type="tel"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Salário Bruto (MT)</label>
                  <input
                    type="number"
                    required
                    value={salary || ""}
                    onChange={(e) => setSalary(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">PIN do Operador (4 Dígitos)</label>
                  <input
                    type="text"
                    maxLength={4}
                    placeholder="Ex: 1234"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-mono font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">E-mail (Gmail)</label>
                  <input
                    type="email"
                    placeholder="Ex: levi@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Estado Operacional</label>
                <select
                  value={employeeStatus}
                  onChange={(e) => setEmployeeStatus(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
                >
                  <option value="ACTIVE">🟢 Ativo (Acesso autorizado)</option>
                  <option value="SUSPENDED">🟡 Suspenso (Acesso temporariamente retido)</option>
                  <option value="INACTIVE">🔴 Desativado (Acesso rescindido)</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL POPUP: Employee Permissions Assign (Item 6) */}
      {isPermissionsModalOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-150 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-sm">Privilégios de Acesso ERP</h3>
              <button 
                onClick={() => setIsPermissionsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              <p className="text-slate-500">Defina quais módulos o colaborador <strong>{selectedEmp.name}</strong> poderá gerenciar:</p>
              
              <div className="space-y-2 border border-slate-150 p-3.5 rounded-xl bg-slate-50/50">
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input 
                    type="checkbox" 
                    checked={empPermissions.includes("POS")}
                    onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "POS"] : prev.filter(x => x !== "POS"))}
                  />
                  <div>
                    <span className="font-bold text-slate-800">Módulo POS / Caixa de Vendas</span>
                    <p className="text-[10px] text-slate-400 font-normal">Permitir lançamentos e recebimentos no caixa comercial</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input 
                    type="checkbox" 
                    checked={empPermissions.includes("STOCK")}
                    onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "STOCK"] : prev.filter(x => x !== "STOCK"))}
                  />
                  <div>
                    <span className="font-bold text-slate-800">Inventário / Gestão de Stock</span>
                    <p className="text-[10px] text-slate-400 font-normal">Permitir dar entrada em produtos e ajustar estoque mínimo</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input 
                    type="checkbox" 
                    checked={empPermissions.includes("REPORTS")}
                    onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "REPORTS"] : prev.filter(x => x !== "REPORTS"))}
                  />
                  <div>
                    <span className="font-bold text-slate-800">Relatórios Administrativos</span>
                    <p className="text-[10px] text-slate-400 font-normal">Dar acesso a relatórios e balanço financeiro geral</p>
                  </div>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer py-1">
                  <input 
                    type="checkbox" 
                    checked={empPermissions.includes("STAFF")}
                    onChange={(e) => setEmpPermissions(prev => e.target.checked ? [...prev, "STAFF"] : prev.filter(x => x !== "STAFF"))}
                  />
                  <div>
                    <span className="font-bold text-slate-800">Contratos e Auditoria</span>
                    <p className="text-[10px] text-slate-400 font-normal">Ver quadro de funcionários e auditar logs de segurança</p>
                  </div>
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPermissionsModalOpen(false)}
                  className="w-1/2 py-2.5 border border-slate-200 bg-white text-slate-700 font-bold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="w-1/2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl text-xs cursor-pointer"
                >
                  Confirmar Chaves
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODERN SLIDEOVER DRAWER: Employee Full Profile Overview (Item 14) */}
      {isDrawerOpen && selectedEmp && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs z-50 flex justify-end">
          
          {/* Backdrop close area */}
          <div className="flex-1" onClick={() => setIsDrawerOpen(false)}></div>
          
          {/* Drawer sheet container */}
          <div className="w-full max-w-md bg-white h-full shadow-2xl border-l border-slate-150 flex flex-col animate-in slide-in-from-right duration-200">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-extrabold text-xs border border-orange-200 uppercase">
                  {selectedEmp.name.substring(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm leading-none">{selectedEmp.name}</h3>
                  <span className="text-[10px] text-slate-400 font-medium font-mono block mt-1">{selectedEmp.role}</span>
                </div>
              </div>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-650 flex items-center justify-center font-bold text-xs"
              >
                ✕
              </button>
            </div>

            {/* Drawer Tab Selectors */}
            <div className="flex border-b border-slate-150 bg-slate-50 overflow-x-auto text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              {(["RESUMO", "PERMISSOES", "FERIAS", "SALARIO", "HISTORICO"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setDrawerTab(tab)}
                  className={`px-4 py-3 border-b-2 whitespace-nowrap cursor-pointer transition ${
                    drawerTab === tab 
                      ? "border-orange-500 text-orange-600 bg-white" 
                      : "border-transparent hover:text-slate-800"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Drawer Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 text-xs space-y-4 font-sans text-slate-600">
              
              {drawerTab === "RESUMO" && (
                <div className="space-y-4">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-3">
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Dados do Colaborador</h4>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">CÓDIGO ID</span>
                        <span className="font-mono text-slate-700 block font-bold mt-0.5">{selectedEmp.id}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">CARGO OPERACIONAL</span>
                        <span className="text-slate-700 block font-bold mt-0.5">{selectedEmp.role}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">TELEFONE CENTRAL</span>
                        <span className="text-slate-700 block font-bold mt-0.5">{selectedEmp.contact}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">DATA ADMISSÃO</span>
                        <span className="font-mono text-slate-700 block font-bold mt-0.5">{selectedEmp.admissionDate || "2024-01-10"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">PIN DO OPERADOR</span>
                        <span className="font-mono text-orange-600 block font-extrabold mt-0.5">{selectedEmp.pin || "Não definido (Padrão 1234)"}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px]">E-MAIL (GMAIL)</span>
                        <span className="text-slate-700 block font-semibold mt-0.5 truncate" title={selectedEmp.email || "Não registado"}>{selectedEmp.email || "Não registado"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-150 space-y-3">
                    <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Dados Fiscais e Tributação</h4>
                    
                    <div className="grid grid-cols-2 gap-3 font-mono">
                      <div>
                        <span className="text-slate-400 block text-[9.5px] font-sans">INSS REFERÊNCIA</span>
                        <span className="text-slate-700 block font-bold mt-0.5">3.0% (Inscrição Activa)</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[9.5px] font-sans">IRPS GRUPO</span>
                        <span className="text-slate-700 block font-bold mt-0.5">Retenção na Fonte A</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "PERMISSOES" && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Módulos de Acesso Ativos</h4>
                  
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-150">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span><strong>Caixa POS Comercial</strong> — Lançamento de faturas e pagamentos ativa.</span>
                    </div>
                    <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 p-2.5 rounded-xl border border-emerald-150">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span><strong>Gestão de Stock</strong> — Visualização e entrada de produtos autorizada.</span>
                    </div>
                    <div className="flex items-center gap-2 bg-slate-50 text-slate-500 p-2.5 rounded-xl border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                      <span><strong>Relatórios Administrativos</strong> — Acesso restrito apenas a supervisores.</span>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "FERIAS" && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Histórico de Férias e Licenças</h4>
                  
                  <div className="space-y-2 font-mono text-[11px]">
                    <div className="bg-slate-50 p-2.5 rounded-lg flex justify-between">
                      <div>
                        <span className="font-bold block text-slate-700">Férias Gozadas (Ano 2025)</span>
                        <span className="text-[10px] text-slate-400">15 de Março ➔ 15 de Abril</span>
                      </div>
                      <span className="text-emerald-600 font-bold">Concluído</span>
                    </div>
                    <div className="bg-slate-50 p-2.5 rounded-lg flex justify-between">
                      <div>
                        <span className="font-bold block text-slate-700">Férias Solicitadas (Ano 2026)</span>
                        <span className="text-[10px] text-slate-400">10 de Dezembro ➔ 10 de Janeiro</span>
                      </div>
                      <span className="text-amber-600 font-bold">Aprovado</span>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "SALARIO" && (
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Controle de Pagamentos de Vencimento</h4>
                  
                  {/* Pagar Salario + Imprimir Vencimento widgets */}
                  <div className="p-4 bg-orange-50 rounded-2xl border border-orange-100 space-y-3 text-center">
                    <span className="block text-orange-800 font-bold text-xs">Vencimento Mensal Base</span>
                    <span className="text-2xl font-black text-orange-600 block leading-none">{(selectedEmp.salary).toLocaleString()} MT</span>
                    
                    <div className="flex gap-2.5 pt-2.5">
                      <button 
                        onClick={() => handlePaySalary(selectedEmp)}
                        className="w-1/2 bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 shadow-sm transition"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        Pagar Salário
                      </button>
                      <button 
                        onClick={() => handlePrintPayslip(selectedEmp)}
                        className="w-1/2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold py-2 rounded-xl text-xs cursor-pointer flex items-center justify-center gap-1 shadow-sm transition"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Imprimir Recibo
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="font-bold text-slate-700 block">Últimos Depósitos Concluídos</span>
                    <div className="divide-y divide-slate-100 font-mono text-[10.5px]">
                      <div className="py-2 flex justify-between items-center">
                        <span>Maio de 2026</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Pago ({(selectedEmp.salary).toLocaleString()} MT)</span>
                      </div>
                      <div className="py-2 flex justify-between items-center">
                        <span>Abril de 2026</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Pago ({(selectedEmp.salary).toLocaleString()} MT)</span>
                      </div>
                      <div className="py-2 flex justify-between items-center">
                        <span>Março de 2026</span>
                        <span className="text-emerald-600 font-bold flex items-center gap-1">✓ Pago ({(selectedEmp.salary).toLocaleString()} MT)</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {drawerTab === "HISTORICO" && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-800 text-[11px] uppercase tracking-wider block font-mono">Histórico de Atividades do Colaborador</h4>
                  
                  <div className="space-y-2 font-mono text-[10.5px]">
                    <div className="bg-slate-50 p-2 rounded border border-slate-150">
                      <span className="text-[9px] text-slate-400 block">2026-06-25 14:12</span>
                      <span className="font-semibold text-slate-700 block">Caixa POS: Fecho de Turno concluído</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-150">
                      <span className="text-[9px] text-slate-400 block">2026-06-25 08:00</span>
                      <span className="font-semibold text-slate-700 block">Início de sessão no POS autorizado</span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded border border-slate-150">
                      <span className="text-[9px] text-slate-400 block">2026-06-24 18:32</span>
                      <span className="font-semibold text-slate-700 block">Venda de stock consolidada via POS</span>
                    </div>
                  </div>
                </div>
              )}

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
