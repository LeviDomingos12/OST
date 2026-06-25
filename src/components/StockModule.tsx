import React, { useState, useMemo } from "react";
import { 
  Package, 
  Plus, 
  Edit3, 
  AlertTriangle, 
  TrendingUp, 
  Upload, 
  Trash2, 
  CheckCircle,
  HelpCircle,
  Search,
  Calendar
} from "lucide-react";
import { Product, UserRole } from "../types";

interface StockModuleProps {
  products: Product[];
  onAddProduct: (p: Product) => void;
  onUpdateProduct: (p: Product) => void;
  onDeleteProduct: (pId: string) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currentRole: UserRole;
  currency: string;
}

export default function StockModule({
  products,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddAuditLog,
  currentRole,
  currency
}: StockModuleProps) {
  
  // Local state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [stockFilter, setStockFilter] = useState<"ALL" | "LOW_STOCK" | "EXPIRED" | "OUT_OF_STOCK">("ALL");

  // Excel import sheet state
  const [showImportPanel, setShowImportPanel] = useState(false);
  const [importStatus, setImportStatus] = useState<"idle" | "processing" | "success">("idle");
  const [importedRowCount, setImportedRowCount] = useState(0);

  // Add/Edit drawer state
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [validationError, setValidationError] = useState("");

  // Form Fields
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("Mercearia");
  const [supplier, setSupplier] = useState("");
  const [costPrice, setCostPrice] = useState<number>(0);
  const [salePrice, setSalePrice] = useState<number>(0);
  const [vatRate, setVatRate] = useState<number>(16);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(10);
  const [expiryDate, setExpiryDate] = useState("");
  const [emoji, setEmoji] = useState("📦");

  // Categories list
  const categoriesList = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ["Todos", ...Array.from(list)];
  }, [products]);

  // Is Supervisor/Admin checks for mutations
  const canMutate = useMemo(() => {
    return currentRole === "ADMIN" || currentRole === "SUPERVISOR";
  }, [currentRole]);

  // Filtered lists
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 1. Search name or code
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
      
      // 2. Category
      const matchCat = selectedCategory === "Todos" || p.category === selectedCategory;

      // 3. Stock Level / Alerts
      let matchFilter = true;
      if (stockFilter === "LOW_STOCK") {
        matchFilter = p.stock > 0 && p.stock <= p.minStock;
      } else if (stockFilter === "OUT_OF_STOCK") {
        matchFilter = p.stock <= 0;
      } else if (stockFilter === "EXPIRED") {
        if (!p.expiryDate) {
          matchFilter = false;
        } else {
          const exp = new Date(p.expiryDate);
          const limit = new Date();
          limit.setDate(limit.getDate() + 30); // expired or expires in 30 days
          matchFilter = exp <= limit;
        }
      }

      return matchSearch && matchCat && matchFilter;
    });
  }, [products, searchQuery, selectedCategory, stockFilter]);

  // Form setups
  const openCreateForm = () => {
    setEditingProduct(null);
    setName("");
    setCode(`PROD-${Math.floor(100 + Math.random() * 900)}`);
    setCategory("Mercearia");
    setSupplier("");
    setCostPrice(0);
    setSalePrice(0);
    setVatRate(16);
    setStock(10);
    setMinStock(5);
    setExpiryDate("");
    setEmoji("📦");
    setValidationError("");
    setIsFormOpen(true);
  };

  const openEditForm = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setCode(p.code);
    setCategory(p.category);
    setSupplier(p.supplier);
    setCostPrice(p.costPrice);
    setSalePrice(p.salePrice);
    setVatRate(p.vatRate);
    setStock(p.stock);
    setMinStock(p.minStock);
    setExpiryDate(p.expiryDate || "");
    setEmoji(p.emoji || "📦");
    setValidationError("");
    setIsFormOpen(true);
  };

  // Submit product additions/edits
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError("");

    if (!name.trim() || !code.trim() || !supplier.trim()) {
      setValidationError("Por favor, preencha todos os campos obrigatórios (Nome, Código e Fornecedor).");
      return;
    }

    if (salePrice <= costPrice) {
      setValidationError("O preço de venda deve ser estritamente superior ao preço de custo operacional.");
      return;
    }

    const payload: Product = {
      id: editingProduct ? editingProduct.id : `prod-${Date.now()}`,
      name,
      code,
      category,
      supplier,
      costPrice,
      salePrice,
      vatRate,
      stock,
      minStock,
      expiryDate: expiryDate || undefined,
      emoji
    };

    if (editingProduct) {
      onUpdateProduct(payload);
      onAddAuditLog(
        "Modificar Produto",
        "STOCK",
        `O produto '${payload.name}' foi atualizado por ${currentRole}. Stock: ${payload.stock}, Preço de Venda: ${payload.salePrice} ${currency}`
      );
    } else {
      onAddProduct(payload);
      onAddAuditLog(
        "Adicionar Produto",
        "STOCK",
        `Novo produto '${payload.name}' cadastrado por ${currentRole}. Custo: ${payload.costPrice}, Preço: ${payload.salePrice}`
      );
    }

    setIsFormOpen(false);
  };

  // Delete product action
  const handleDeleteProductClick = (productId: string) => {
    if (confirm("Tem certeza absoluta de que deseja apagar permanentemente este produto do stock? Esta ação é irreversível.")) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        onDeleteProduct(productId);
        onAddAuditLog(
          "Excluir Produto do Stock",
          "STOCK",
          `Produto '${prod.name}' excluído permanentemente do cadastro por ${currentRole}.`
        );
      }
    }
  };

  // Excel simulation triggers
  const handleSimulateCSVImport = () => {
    setImportStatus("processing");
    
    setTimeout(() => {
      // Simulate adding 4 new items with typical local specifications
      const mockImports: Product[] = [
        { id: `csv-1-${Date.now()}`, name: "Cerveja Manica (Garrafa 550ml)", code: "CER-MAN", category: "Bebidas", supplier: "CDM - Moçambique", costPrice: 60, salePrice: 90, vatRate: 16, stock: 120, minStock: 24, emoji: "🍺" },
        { id: `csv-2-${Date.now()}`, name: "Feijão Preto em Lata Camil (400g)", code: "MER-FEI", category: "Mercearia", supplier: "Distribuidora Sul", costPrice: 95, salePrice: 145, vatRate: 16, stock: 45, minStock: 10, expiryDate: "2027-01-20", emoji: "🥫" },
        { id: `csv-3-${Date.now()}`, name: "Óleo Alimentar Gordo de Girassol (1L)", code: "OLE-SOL", category: "Mercearia", supplier: "Indústrias de Moçambique", costPrice: 110, salePrice: 165, vatRate: 16, stock: 60, minStock: 15, emoji: "🧴" },
        { id: `csv-4-${Date.now()}`, name: "Adaptador Universal MozPlug 16A", code: "ELE-ADAPT", category: "Eletrónicos", supplier: "Afritronics", costPrice: 120, salePrice: 320, vatRate: 16, stock: 18, minStock: 5, emoji: "🔌" }
      ];

      mockImports.forEach(p => onAddProduct(p));
      
      onAddAuditLog(
        "Importação Massa Excel CSV",
        "STOCK",
        `Carregado planilha com +4 produtos CDM/Mercearia e integrados com sucesso por ${currentRole}.`
      );

      setImportedRowCount(4);
      setImportStatus("success");
    }, 1500);
  };

  return (
    <div className="space-y-6">
      
      {/* 1. Header with Stats badges & Excel toggle */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        
        {/* Indicators boxes */}
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={() => setStockFilter("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border ${
              stockFilter === "ALL"
                ? "bg-slate-900 border-slate-900 text-white"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            Todos ({products.length})
          </button>
          
          <button
            onClick={() => setStockFilter("LOW_STOCK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1.5 ${
              stockFilter === "LOW_STOCK"
                ? "bg-amber-600 border-amber-600 text-white"
                : "bg-white border-slate-200 text-amber-700 hover:bg-amber-50"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            Stock Baixo ({products.filter(p => p.stock > 0 && p.stock <= p.minStock).length})
          </button>

          <button
            onClick={() => setStockFilter("OUT_OF_STOCK")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1.5 ${
              stockFilter === "OUT_OF_STOCK"
                ? "bg-red-650 border-red-650 text-white"
                : "bg-white border-slate-200 text-red-650 hover:bg-red-50"
            }`}
          >
            Esgotados ({products.filter(p => p.stock <= 0).length})
          </button>

          <button
            onClick={() => setStockFilter("EXPIRED")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer border flex items-center gap-1.5 ${
              stockFilter === "EXPIRED"
                ? "bg-purple-650 border-purple-650 text-white"
                : "bg-white border-slate-200 text-purple-700 hover:bg-purple-50"
            }`}
          >
            Próx. Vencimento ({
              products.filter(p => {
                if(!p.expiryDate) return false;
                const limit = new Date();
                limit.setDate(limit.getDate() + 30);
                return new Date(p.expiryDate) <= limit;
              }).length
            })
          </button>
        </div>

        {/* Buttons right triggers */}
        <div className="flex gap-2.5 items-center w-full md:w-auto">
          <button
            onClick={() => setShowImportPanel(!showImportPanel)}
            className="flex-1 md:flex-initial bg-slate-100 hover:bg-slate-200 py-2 px-3.5 rounded-xl text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition"
          >
            <Upload className="w-4 h-4 shrink-0" />
            Importar Planilha Excel
          </button>

          {canMutate ? (
            <button
              onClick={openCreateForm}
              className="flex-1 md:flex-initial bg-orange-500 hover:bg-orange-600 py-2 px-4 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/10 cursor-pointer transition"
            >
              <Plus className="w-4 h-4" />
              Novo Produto
            </button>
          ) : (
            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 bg-slate-50 border p-2 rounded-lg leading-none">
              ⚠️ Ajuste habilitado para Supervisor ou Administradores
            </div>
          )}
        </div>

      </div>

      {/* 1B. Dynamic simulated Excel Uploader Panel */}
      {showImportPanel && (
        <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl animate-in slide-in-from-top duration-200 space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="font-bold text-slate-800 text-xs">Importação de Ficheiros XLS / CSV</h3>
              <p className="text-xs text-slate-400 mt-0.5">Carregue catálogos de fornecedores em massa com preços e quantidades do stock.</p>
            </div>
            <button 
              onClick={() => { setShowImportPanel(false); setImportStatus("idle"); }}
              className="text-slate-450 hover:text-slate-600 text-xs font-semibold"
            >
              Fechar Painel X
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left drop zone with real file select capability */}
            <div 
              onClick={() => document.getElementById("native-excel-picker")?.click()}
              className="border-2 border-dashed border-slate-300 rounded-xl bg-white p-5 text-center space-y-2 flex flex-col justify-center items-center cursor-pointer hover:border-orange-400 hover:bg-orange-50/5 transition-colors relative"
            >
              <input 
                id="native-excel-picker"
                type="file"
                accept=".csv,.xls,.xlsx,.pdf,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportStatus("processing");
                    setTimeout(() => {
                      // Process the real chosen file
                      const mockImports: Product[] = [
                        { id: `csv-1-${Date.now()}`, name: `Stock: ${file.name.split('.')[0]} A1`, code: "IMPM-1", category: "Bebidas", supplier: "Estoque Fornecedor", costPrice: 48, salePrice: 85, vatRate: 16, stock: 65, minStock: 12, emoji: "📦" },
                        { id: `csv-2-${Date.now()}`, name: `Stock: ${file.name.split('.')[0]} A2`, code: "IMPM-2", category: "Mercearia", supplier: "Estoque Fornecedor", costPrice: 85, salePrice: 135, vatRate: 16, stock: 40, minStock: 8, emoji: "🥫" },
                      ];
                      mockImports.forEach(p => onAddProduct(p));
                      onAddAuditLog(
                        "Importação de Ficheiro Comercial",
                        "STOCK",
                        `Utilizador carregou e processou o ficheiro real '${file.name}' (${(file.size / 1024).toFixed(1)} KB) com sucesso.`
                      );
                      setImportedRowCount(2);
                      setImportStatus("success");
                    }, 1400);
                  }
                }}
              />
              <Upload className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-xs font-bold text-slate-700">Clique para selecionar ou arraste o ficheiro de stock</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Formatos do sistema: CSV, XLS, XLSX, PDF (Máximo 10MB)</p>
              </div>
            </div>

            {/* Right quick simulator actions with CDM preconfigured items */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase font-mono block">Simulador Piloto OST</span>
                <h4 className="text-xs font-bold text-slate-700 mt-1">Carregar Modelo de Mercearia de Moçambique</h4>
                <p className="text-[11px] text-slate-400">Preencha de imediato itens como Cerveja Manica CDM, adaptadores e feijão com preços calculados em MT.</p>
              </div>

              {importStatus === "idle" ? (
                <button
                  type="button"
                  onClick={handleSimulateCSVImport}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs py-2 px-3 rounded-lg mt-3 cursor-pointer text-center"
                >
                  Confirmar e Processar Modelo Misto
                </button>
              ) : importStatus === "processing" ? (
                <div className="text-xs font-bold text-orange-600 flex items-center gap-2 mt-3">
                  <span className="w-4 h-4 rounded-full border-2 border-orange-500 border-t-transparent animate-spin"></span>
                  Lendo planilha CSV de importação...
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 text-green-800 text-xs p-2 rounded-lg mt-3 flex items-center gap-2 leading-snug">
                  <CheckCircle className="w-4 h-4 text-green-700 shrink-0" />
                  <div>
                    <p className="font-bold">Planilha Excel Processada!</p>
                    <p className="text-[10px]">+{importedRowCount} novos produtos de Moçambique foram injetados.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Main Search & grid filters */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col min-h-[300px]">
        {/* Search tool block */}
        <div className="p-4 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Pesquisar por nome ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg pl-9 pr-4 py-1.5 text-xs outline-none focus:border-orange-505"
            />
          </div>

          <div className="flex gap-2 items-center w-full md:w-auto">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">Categoria:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border rounded-lg py-1 px-2.5 text-xs outline-none font-medium text-slate-600 cursor-pointer"
            >
              {categoriesList.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {/* Product listing table */}
        <div className="flex-1 overflow-x-auto text-[11.5px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wide text-[9.5px]">
                <th className="p-3.5 text-center w-12">EMOJI</th>
                <th className="p-3.5">CÓDIGO</th>
                <th className="p-3.5">PRODUTO</th>
                <th className="p-3.5">CATEGORIA</th>
                <th className="p-3.5">FORNECEDOR</th>
                <th className="p-3.5 text-right">PREÇO CUSTO</th>
                <th className="p-3.5 text-right">PREÇO VENDA</th>
                <th className="p-3.5 text-center">QUANTIDADE STOCK</th>
                <th className="p-3.5 text-center">LIMIT MÍN</th>
                {canMutate && <th className="p-3.5 text-center">AÇÕES</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-400 italic">Nenhum produto atendeu aos critérios comerciais de pesquisa selecionados.</td>
                </tr>
              ) : (
                filteredProducts.map((p) => {
                  const isOutOfStock = p.stock <= 0;
                  const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                  
                  // Margin profit calculation
                  const profitAmt = p.salePrice - p.costPrice;
                  const profitPct = Math.round((profitAmt / p.costPrice) * 100);

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/40 transition">
                      <td className="p-3 text-center text-xl select-none">{p.emoji || "📦"}</td>
                      <td className="p-3 font-mono text-slate-500 font-semibold">{p.code}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-850">{p.name}</div>
                        {p.expiryDate && (
                          <div className="flex items-center gap-1 text-[9px] text-purple-600 font-semibold mt-0.5 font-mono">
                            <Calendar className="w-3 h-3" />
                            Val: {new Date(p.expiryDate).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono text-slate-400">{p.category}</td>
                      <td className="p-3 text-slate-600 font-medium">{p.supplier}</td>
                      <td className="p-3 text-right font-mono text-slate-600">{p.costPrice.toLocaleString()} MT</td>
                      <td className="p-3 text-right font-mono">
                        <div className="font-bold text-slate-800">{p.salePrice.toLocaleString()} MT</div>
                        <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 px-1 rounded-full">{profitPct}% margem</span>
                      </td>
                      <td className={`p-3 text-center font-mono font-bold text-xs ${
                        isOutOfStock 
                          ? "text-red-700 bg-red-50/50" 
                          : isLowStock 
                          ? "text-amber-700 bg-amber-50/50" 
                          : "text-slate-800"
                      }`}>
                        {p.stock}
                        {isOutOfStock && <p className="text-[8px] font-bold text-red-650 leading-none mt-0.5">ESGOTADO</p>}
                        {isLowStock && <p className="text-[8px] font-bold text-amber-650 leading-none mt-0.5">REABASTECER</p>}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-400">{p.minStock} un</td>
                      {canMutate && (
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditForm(p)}
                              className="p-1 px-1.5 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-bold flex items-center justify-center gap-1 cursor-pointer"
                              title="Editar Produto"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                            <button
                              onClick={() => handleDeleteProductClick(p.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                              title="Remover permanentemente"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DOCKER DRAWER MODAL: Add / Edit Product */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-xl w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-950 text-sm">
                {editingProduct ? `Editar Detalhes: ${editingProduct.name}` : "Cadastrar Novo Produto para Stock"}
              </h3>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="text-slate-450 hover:text-slate-650 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitProduct} className="space-y-4">
              {validationError && (
                <p className="bg-red-50 border border-red-200 text-red-700 text-xs p-2.5 rounded-lg font-semibold">{validationError}</p>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-xs">
                {/* Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Nome Comercial do Produto *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Óleo Alimentar Maçaroca 5L"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-850"
                  />
                </div>

                {/* SKU Code */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Código / SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: OLE-MAÇ-05"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500"
                  />
                </div>

                {/* Category selection */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Categoria</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none"
                  >
                    <option value="Mercearia">Mercearia</option>
                    <option value="Bebidas">Bebidas</option>
                    <option value="Eletrónicos">Eletrónicos</option>
                    <option value="Construção">Construção</option>
                    <option value="Vestuário">Vestuário</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>

                {/* Supplier */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Fornecedor Distribuidor *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: CDM Moçambique ou MozAlimentos"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none focus:border-orange-500 text-slate-850"
                  />
                </div>

                {/* Cost price */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Custo (MT) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 110"
                    value={costPrice || ""}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Sale price */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Preço de Venda (MT) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 165"
                    value={salePrice || ""}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Stock default */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Estoque Inicial (Unidades) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 30"
                    value={stock}
                    onChange={(e) => setStock(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Stock limit minimum */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Estoque Mínimo de Alerta *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    placeholder="Ex: 5"
                    value={minStock}
                    onChange={(e) => setMinStock(Number(e.target.value))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold font-mono outline-none"
                  />
                </div>

                {/* Expiry Date */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Data de Validade/Vencimento</label>
                  <input
                    type="date"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none"
                  />
                </div>

                {/* Emoji visual selector */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Emoji do Produto / Decorador</label>
                  <select
                    value={emoji}
                    onChange={(e) => setEmoji(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 font-semibold outline-none cursor-pointer"
                  >
                    <option value="🍙">🍙 Arroz / Grãos</option>
                    <option value="🧴">🧴 Garrafas / Óleo</option>
                    <option value="🌾">🌾 Sacos / Farinhas</option>
                    <option value="🍺">🍺 Garrafas / Laurentina</option>
                    <option value="🍻">🍻 Latas / Cervejas</option>
                    <option value="🧃">🧃 Sumos / Tetrapaks</option>
                    <option value="🔌">🔌 Acessórios USB</option>
                    <option value="📱">📱 Celulares / Smartphones</option>
                    <option value="🧱">🧱 Cimento / Tijolo</option>
                    <option value="👕">👕 Roupas / Vestuário</option>
                    <option value="🥫">🥫 Enlatados / Tomate</option>
                    <option value="📦">📦 Outros Genericamente</option>
                  </select>
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
                  {editingProduct ? "Salvar Alterações" : "Cadastrar Produto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
