import React, { useState, useMemo } from "react";
import { 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Tag, 
  Percent, 
  Receipt, 
  UserPlus, 
  CreditCard,
  CheckCircle2,
  Phone,
  Mail,
  Printer,
  Smartphone,
  ChevronRight,
  ShoppingCart
} from "lucide-react";
import { Product, Customer, CartItem, Transaction, UserRole } from "../types";

interface POSModuleProps {
  products: Product[];
  customers: Customer[];
  activeUsername: string;
  onCompleteSale: (tx: Transaction) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
}

export default function POSModule({
  products,
  customers,
  activeUsername,
  onCompleteSale,
  onAddAuditLog,
  currency,
  onShowToast
}: POSModuleProps) {
  
  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("CASH");
  
  // Mixed payment states
  const [mixedAmount1, setMixedAmount1] = useState<number>(0);
  const [mixedMethod1, setMixedMethod1] = useState<string>("CASH");
  const [mixedMethod2, setMixedMethod2] = useState<string>("MPESA_PAGA_FACIL");

  const [debtDays, setDebtDays] = useState<number>(15);

  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [vatMode, setVatMode] = useState<"AUTO" | "EXEMPT" | "CUSTOM">("AUTO");
  const [customVatRate, setCustomVatRate] = useState<number>(16);

  // Completed Invoice Popup State
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [sendEmailStatus, setSendEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendSmsStatus, setSendSmsStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);
  const [noReceiptSuccess, setNoReceiptSuccess] = useState(false);

  // Filter categories
  const categories = useMemo(() => {
    const list = new Set(products.map(p => p.category));
    return ["Todos", ...Array.from(list)];
  }, [products]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCat = selectedCategory === "Todos" || p.category === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [products, searchQuery, selectedCategory]);

  const selectedCustomer = useMemo(() => {
    return customers.find(c => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Add item to cart
  const handleAddToCart = (product: Product) => {
    if (product.stock <= 0) return; // out of stock

    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        // limit by stock
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { product, quantity: 1, discount: 0, vatRate: product.vatRate }];
      }
    });
  };

  // Decrement item
  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing && existing.quantity > 1) {
        return prev.map(item => 
          item.product.id === productId 
            ? { ...item, quantity: item.quantity - 1 }
            : item
        );
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  // Delete item row
  const handleDeleteRow = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let vatTotal = 0;

    cart.forEach(item => {
      const itemSub = item.product.salePrice * item.quantity;
      subtotal += itemSub;
      
      // Calculate item VAT
      const rate = vatMode === "AUTO" ? item.product.vatRate : (vatMode === "EXEMPT" ? 0 : customVatRate);
      const vatAmount = (itemSub * (rate / 100));
      vatTotal += vatAmount;
    });

    // Global Discount
    if (discountValue > 0) {
      if (discountType === "PERCENT") {
        discountTotal = (subtotal * (discountValue / 100));
      } else {
        discountTotal = discountValue;
      }
    }

    const grandTotal = Math.max(0, subtotal + vatTotal - discountTotal);

    return {
      subtotal: Math.round(subtotal),
      vatTotal: Math.round(vatTotal),
      discountTotal: Math.round(discountTotal),
      grandTotal: Math.round(grandTotal)
    };
  }, [cart, discountType, discountValue, vatMode, customVatRate]);

  // Handle Quick Discount Percent
  const applyQuickDiscount = (percent: number) => {
    setDiscountType("PERCENT");
    setDiscountValue(percent);
  };

  // Reset shopping screen
  const handleReset = () => {
    setCart([]);
    setSelectedCustomerId("");
    setSelectedPaymentMethod("CASH");
    setDiscountValue(0);
    setSearchQuery("");
    setCompletedTx(null);
    setSendEmailStatus("idle");
    setSendSmsStatus("idle");
  };

  // Complete Payment Action
  const handleCheckout = (emitReceipt: boolean = true) => {
    if (cart.length === 0) return;

    const invoiceNum = `FAC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowStr = new Date().toISOString();

    if (selectedPaymentMethod === "DEBT") {
      if (!selectedCustomer) {
        if (onShowToast) onShowToast("Selecione um cliente para prosseguir com a venda a crédito (Dívida).", "warning");
        return;
      }
      if (selectedCustomer.purchaseCount === 0 || selectedCustomer.totalSpent < 20000 || selectedCustomer.creditBlocked) {
        if (onShowToast) onShowToast("Cliente não cumpre os critérios para venda a crédito. Mínimo 20.000 MT e sem bloqueios.", "error", "Crédito Recusado");
        return;
      }
    }

    const transaction: Transaction = {
      id: `tx-${Date.now()}`,
      invoiceNumber: invoiceNum,
      timestamp: nowStr,
      subtotal: calculations.subtotal,
      vatTotal: calculations.vatTotal,
      discountTotal: calculations.discountTotal,
      grandTotal: calculations.grandTotal,
      paymentMethod: selectedPaymentMethod as any,
      cashierName: activeUsername,
      customerName: selectedCustomer?.name,
      customerId: selectedCustomer?.id,
      nuit: selectedCustomer?.nuit,
      paymentDetails: selectedPaymentMethod === "MIXED" 
        ? `${mixedMethod1}: ${mixedAmount1} ${currency} / ${mixedMethod2}: ${calculations.grandTotal - mixedAmount1} ${currency}`
        : selectedPaymentMethod === "DEBT"
        ? `Prazo: ${debtDays} dias. Vencimento: ${new Date(Date.now() + debtDays * 24 * 60 * 60 * 1000).toLocaleDateString()}`
        : undefined,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        price: item.product.salePrice,
        vatAmount: Math.round(item.product.salePrice * item.quantity * (item.product.vatRate / 100)),
        discountAmount: 0,
        subtotal: item.product.salePrice * item.quantity
      }))
    };

    // 1. Complete unified commercial transaction sale
    onCompleteSale(transaction);

    if (emitReceipt) {
      // Log Audit Actions
      onAddAuditLog(
        "Efetuar Venda POS",
        "VENDAS",
        `Fatura ${invoiceNum} registrada por ${activeUsername}. Total: ${calculations.grandTotal} ${currency}. Cliente: ${selectedCustomer?.name || 'Geral'}`
      );
      // Open printed modal
      setCompletedTx(transaction);
    } else {
      // Log Audit Actions without receipt
      onAddAuditLog(
        "Efetuar Venda POS (Sem Recibo)",
        "VENDAS",
        `Venda rápida ${invoiceNum} registrada por ${activeUsername} sem emissão de recibo. Total: ${calculations.grandTotal} ${currency}`
      );
      
      // Clear cart and reset setup
      setCart([]);
      setSelectedCustomerId("");
      setSelectedPaymentMethod("CASH");
      setDiscountValue(0);
      setSearchQuery("");
      setCompletedTx(null);
      setSendEmailStatus("idle");
      setSendSmsStatus("idle");

      // Trigger temporary success notification
      setNoReceiptSuccess(true);
      setTimeout(() => {
        setNoReceiptSuccess(false);
      }, 3000);
    }
  };

  // Real automated invoice communication dispatches
  const simulateSendEmail = async () => {
    if (!completedTx) return;
    setSendEmailStatus("sending");
    try {
      const response = await fetch("/api/email/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: selectedCustomer?.email || "vendas.central@ost.co.mz",
          invoiceNumber: completedTx.invoiceNumber,
          grandTotal: completedTx.grandTotal,
          cashier: activeUsername,
          customer: completedTx.customerName || "Consumidor Geral"
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSendEmailStatus("sent");
        onAddAuditLog("Enviar Recibo por Email", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via e-mail para ${selectedCustomer?.email || "balcão"}.`);
        if (onShowToast) onShowToast(`Recibo enviado para ${selectedCustomer?.email || "vendas.central@ost.co.mz"} com sucesso!`, "success", "Fatura Enviada");
      } else {
        throw new Error(data.error || "Ocorreu uma falha ao contatar o servidor SMTP.");
      }
    } catch (err: any) {
      setSendEmailStatus("idle");
      if (onShowToast) onShowToast(err.message || "Erro na conexão fiduciária.", "error", "Falha de Envio");
    }
  };

  const simulateSendSms = async () => {
    if (!completedTx) return;
    setSendSmsStatus("sending");
    try {
      const response = await fetch("/api/sms/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedCustomer?.phone || "+258 84 900 1202",
          invoiceNumber: completedTx.invoiceNumber,
          grandTotal: completedTx.grandTotal
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSendSmsStatus("sent");
        onAddAuditLog("Enviar Recibo por SMS", "VENDAS", `Notificação de recibo ${completedTx.invoiceNumber} enviada por SMS.`);
        if (onShowToast) onShowToast(`Notificação SMS enviada para ${selectedCustomer?.phone || "Telemóvel"} via gateway!`, "success", "Recebido pelo Celular");
      } else {
        throw new Error(data.error || "Falha ao consolidar entrega via Gateway SMS.");
      }
    } catch (err: any) {
      setSendSmsStatus("idle");
      if (onShowToast) onShowToast(err.message || "Erro ao conectar-se às antenas locais.", "error", "Falha no SMS");
    }
  };

  return (
    <div className="flex h-full gap-5">
      {/* LEFT: Products browser catalog */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm">
        
        {/* Search header & Filter bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Pesquisar por nome do produto ou código de barras (barcodes)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
            </div>
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Quick Categories list */}
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-thin">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer shrink-0 transition-all ${
                  selectedCategory === cat
                    ? "bg-orange-500 text-white shadow-sm shadow-orange-500/25"
                    : "bg-white hover:bg-slate-100 border border-slate-200 text-slate-600"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Products catalog list with grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-sm font-semibold text-slate-700">Nenhum produto cadastrado foi localizado</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">Tente ajustar a sua pesquisa ou adicione stock no separador de stock comercial.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3.5">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                
                return (
                  <button
                    key={p.id}
                    onClick={() => handleAddToCart(p)}
                    disabled={isOutOfStock}
                    id={`btn-product-${p.id}`}
                    className={`group bg-white p-3.5 rounded-xl border relative text-left transition-all flex flex-col justify-between select-none h-40 ${
                      isOutOfStock 
                        ? "border-slate-150 bg-slate-50/70 cursor-not-allowed opacity-60" 
                        : "border-slate-200 hover:border-orange-200 hover:shadow-lg hover:shadow-slate-100/60 cursor-pointer"
                    }`}
                  >
                    {/* Floating Status tags */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1 z-10">
                      {isOutOfStock ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 leading-none">ESGOTADO</span>
                      ) : isLowStock ? (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 leading-none">BAIXO ({p.stock})</span>
                      ) : (
                        <span className="text-[9.5px] font-mono font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 leading-none">{p.stock} un</span>
                      )}
                    </div>

                    {/* Product visual decoration */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2.5xl p-1 bg-slate-100 group-hover:bg-orange-50 rounded-lg transition">{p.emoji || "📦"}</span>
                      <span className="text-[9px] font-mono text-slate-400 px-1 py-0.5 max-w-[80px] truncate">{p.code}</span>
                    </div>

                    {/* Title and details */}
                    <div>
                      <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-tight pr-4">{p.name}</h4>
                      <p className="text-[10px] text-slate-400 font-mono mt-0.5">{p.category}</p>
                    </div>

                    {/* Price stamp */}
                    <div className="mt-2 pt-2 border-t border-slate-100/80 flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">{p.salePrice.toLocaleString()} <span className="text-[9.5px] font-medium text-slate-400">{currency}</span></span>
                      <span className="text-[9px] text-slate-400 font-mono">IVA {p.vatRate}%</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Carrinho de Compras */}
      <div className="w-96 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        {/* Cart Header */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-orange-400" />
            <h3 className="font-semibold text-sm">Carrinho Ativo</h3>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 font-mono text-[10px] font-medium text-orange-300">
            {cart.reduce((s, c) => s + c.quantity, 0)} Itens
          </span>
        </div>

        {/* Customer select row */}
        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <div className="flex-1">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs py-1.5 px-2 outline-none"
            >
              <option value="">-- Consumidor Geral --</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          {selectedCustomer && (
            <div className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-[10px] font-bold shrink-0 font-mono">
              ★ PTS: {selectedCustomer.loyaltyPoints}
            </div>
          )}
        </div>

        {/* Selected products scroll list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 divider-y">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 mt-12">
              <span className="text-2xl mb-2">🛒</span>
              <p className="text-xs font-semibold text-slate-600">Carrinho Vazio</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Selecione produtos no catálogo ao lado para faturar.</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product.id} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-2 relative group">
                <button
                  onClick={() => handleDeleteRow(item.product.id)}
                  className="absolute top-1 right-1 p-1 text-slate-300 hover:text-red-500 rounded-lg"
                  title="Remover Item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                <div className="pr-5">
                  <h5 className="text-xs font-bold text-slate-800 line-clamp-1">{item.product.name}</h5>
                  <p className="text-[9px] text-slate-400 font-mono">Preço unitário: {item.product.salePrice.toLocaleString()} {currency}</p>
                </div>

                <div className="flex items-center justify-between">
                  {/* Quantity adjustments */}
                  <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-1 py-0.5">
                    <button 
                      onClick={() => handleRemoveFromCart(item.product.id)}
                      className="p-1 text-slate-500 hover:bg-slate-100 rounded"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-mono font-bold px-1.5 select-none">{item.quantity}</span>
                    <button 
                      onClick={() => handleAddToCart(item.product.id)}
                      disabled={item.quantity >= item.product.stock}
                      className="p-1 text-slate-500 hover:bg-slate-100 rounded disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-800">
                      {(item.product.salePrice * item.quantity).toLocaleString()} {currency}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Global discount & VAT overrides panel */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-3">
          
          {/* Discount buttons */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Descontos Comerciais</label>
            <div className="grid grid-cols-5 gap-1">
              <button 
                onClick={() => setDiscountValue(0)}
                className={`py-1 text-[10px] font-bold rounded border ${discountValue === 0 ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200"}`}
              >
                Grátis
              </button>
              <button 
                onClick={() => applyQuickDiscount(5)}
                className={`py-1 text-[10px] font-bold rounded border ${discountValue === 5 && discountType === "PERCENT" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200"}`}
              >
                5%
              </button>
              <button 
                onClick={() => applyQuickDiscount(15)}
                className={`py-1 text-[10px] font-bold rounded border ${discountValue === 15 && discountType === "PERCENT" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200"}`}
              >
                15%
              </button>
              <button 
                onClick={() => applyQuickDiscount(25)}
                className={`py-1 text-[10px] font-bold rounded border ${discountValue === 25 && discountType === "PERCENT" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200"}`}
              >
                25%
              </button>
              {/* Custom input toggle */}
              <input
                type="number"
                placeholder="Ex 100"
                value={discountValue > 0 && discountType === "FIXED" ? discountValue : ""}
                onChange={(e) => {
                  setDiscountType("FIXED");
                  setDiscountValue(Number(e.target.value));
                }}
                className="bg-white border border-slate-200 text-[10px] py-1 text-center font-bold rounded text-slate-700 outline-none w-full"
                title="Desconto fixo em Meticais"
              />
            </div>
          </div>

          {/* Key VAT selector customization */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Imposto IVA</span>
            <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-[10px] font-bold">
              <button 
                onClick={() => setVatMode("AUTO")}
                className={`px-2 py-0.5 rounded ${vatMode === "AUTO" ? "bg-slate-200 text-slate-800" : "text-slate-500"}`}
              >
                Auto
              </button>
              <button 
                onClick={() => setVatMode("EXEMPT")}
                className={`px-2 py-0.5 rounded ${vatMode === "EXEMPT" ? "bg-slate-200 text-slate-800" : "text-slate-500"}`}
              >
                Isento
              </button>
              <button 
                onClick={() => setVatMode("CUSTOM")}
                className={`px-2 py-0.5 rounded ${vatMode === "CUSTOM" ? "bg-slate-200 text-slate-800" : "text-slate-500"}`}
              >
                Custom
              </button>
            </div>
            {vatMode === "CUSTOM" && (
              <input
                type="number"
                value={customVatRate}
                onChange={(e) => setCustomVatRate(Number(e.target.value))}
                className="w-10 bg-white border rounded text-[10px] font-bold py-0.5 text-center"
                min="0"
                max="100"
              />
            )}
          </div>
        </div>

        {/* Totals, Financial checkout options */}
        <div className="p-4 border-t border-slate-200 bg-white space-y-3.5">
          <div className="space-y-1 text-xs text-slate-600 font-mono">
            <div className="flex justify-between">
              <span>Subtotal Inicial:</span>
              <span>{calculations.subtotal.toLocaleString()} {currency}</span>
            </div>
            {calculations.discountTotal > 0 && (
              <div className="flex justify-between text-red-600 font-semibold">
                <span>Desconto Aplicado:</span>
                <span>-{calculations.discountTotal.toLocaleString()} {currency}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Total de IVA Cobrado:</span>
              <span>{calculations.vatTotal.toLocaleString()} {currency}</span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 border-t border-slate-100 pt-2 font-sans">
              <span>Total a Pagar:</span>
              <span>{calculations.grandTotal.toLocaleString()} {currency}</span>
            </div>
          </div>

          {/* Payment Method Selector Grid */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Método de Liquidação</label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { id: "CASH", label: "Dinheiro" },
                { id: "MPESA_PAGA_FACIL", label: "M-Pesa" },
                { id: "EMOLA", label: "E-Mola" },
                { id: "POS_CARD", label: "POS" },
                { id: "CREDIT_CARD", label: "Cartão" },
                { id: "BANK_TRANSFER", label: "Transf" },
                { id: "DEBT", label: "Dívida" },
                { id: "MIXED", label: "Misto" }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => {
                    if (method.id === "DEBT") {
                      if (!selectedCustomer) {
                        if (onShowToast) onShowToast("Selecione um cliente com cadastro completo para venda a crédito.", "warning");
                        return;
                      }
                      if (selectedCustomer.purchaseCount === 0 || selectedCustomer.totalSpent < 20000 || selectedCustomer.creditBlocked) {
                        if (onShowToast) onShowToast("Cliente inelegível para crédito. Requisitos: compras > 20.000 MT e sem bloqueios.", "error", "Crédito Recusado");
                        return;
                      }
                    }
                    setSelectedPaymentMethod(method.id);
                  }}
                  className={`py-1 text-[10px] font-bold rounded tracking-tight shadow-sm cursor-pointer ${
                    selectedPaymentMethod === method.id 
                      ? "bg-slate-900 text-orange-400 border border-slate-900" 
                      : "bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Extra Mixed settings triggers */}
          {selectedPaymentMethod === "MIXED" && (
            <div className="bg-orange-50/50 p-2.5 rounded-lg border border-orange-100 space-y-2 text-[11px]">
              <p className="font-bold text-orange-850">Configuração de Pagamento Misto / Divisão</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Valor Método 1"
                  value={mixedAmount1 || ""}
                  onChange={(e) => setMixedAmount1(Number(e.target.value))}
                  className="bg-white border rounded p-1 w-full text-center text-xs font-bold"
                  title="Valor do Método 1"
                />
                <select
                  value={mixedMethod1}
                  onChange={(e) => setMixedMethod1(e.target.value)}
                  className="bg-white border rounded p-1 text-xs"
                >
                  <option value="CASH">Dinheiro</option>
                  <option value="MPESA_PAGA_FACIL">M-Pesa</option>
                  <option value="EMOLA">E-Mola</option>
                </select>
              </div>
              <div className="flex items-center justify-between text-slate-600">
                <span>Método 2 Restante:</span>
                <span className="font-bold text-slate-800">{(calculations.grandTotal - mixedAmount1).toLocaleString()} {currency}</span>
              </div>
              <select
                value={mixedMethod2}
                onChange={(e) => setMixedMethod2(e.target.value)}
                className="bg-white border rounded p-1 text-xs w-full"
              >
                <option value="MPESA_PAGA_FACIL">M-Pesa Paga Fácil (Resto)</option>
                <option value="EMOLA">E-Mola (Resto)</option>
                <option value="POS_CARD">POS (Resto)</option>
                <option value="BANK_TRANSFER">Transferência (Resto)</option>
              </select>
            </div>
          )}

          {selectedPaymentMethod === "DEBT" && (
            <div className="bg-red-50 p-2.5 rounded-lg border border-red-100 space-y-2 text-[11px]">
              <p className="font-bold text-red-800">Configuração de Venda a Crédito (Dívida)</p>
              <div className="flex flex-col gap-1.5">
                <label className="text-slate-600 font-semibold">Prazo de Pagamento (Dias)</label>
                <select
                  value={debtDays}
                  onChange={(e) => setDebtDays(Number(e.target.value))}
                  className="bg-white border border-red-200 rounded p-1 text-xs w-full font-bold text-red-700 outline-none"
                >
                  <option value={5}>5 Dias</option>
                  <option value={10}>10 Dias</option>
                  <option value={15}>15 Dias</option>
                  <option value={30}>30 Dias</option>
                </select>
                {selectedCustomer && (
                  <p className="text-[9px] text-red-600/80 mt-1">
                    Cliente selecionado: <span className="font-bold">{selectedCustomer.name}</span>. O crédito será somado ao histórico do cliente.
                  </p>
                )}
                {!selectedCustomer && (
                  <p className="text-[9px] text-red-600 font-bold mt-1">
                    ATENÇÃO: É obrigatório selecionar um cliente para venda a crédito.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Action trigger buttons: Checkout options */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => handleCheckout(true)}
              disabled={cart.length === 0}
              className={`w-full py-2.5 h-10 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                cart.length === 0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-orange-500/15"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Finalizar Venda (Emitir Recibo)
            </button>
            <button
              onClick={() => handleCheckout(false)}
              disabled={cart.length === 0}
              className={`w-full py-2 h-9 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                cart.length === 0
                  ? "bg-slate-100 text-slate-300 cursor-not-allowed"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-md shadow-emerald-650/10"
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Finalizar Venda (Sem Recibo)
            </button>
          </div>
        </div>
      </div>

      {/* POPUP MODAL: Receipt & Communications */}
      {completedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Venda Concluída!</h3>
              <p className="text-xs text-slate-400 mt-1">Transação consolidada e stock decrementado.</p>
            </div>

            {/* Simulated Receipt Display */}
            <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 font-mono text-[11px] leading-tight text-slate-700 select-all max-h-60 overflow-y-auto">
              <div className="text-center font-bold text-slate-800 mb-2 border-b border-dashed border-slate-300 pb-2">
                <p className="uppercase">OST COMÉRCIO CENTRAL</p>
                <p className="font-normal text-[9px] text-slate-500">Av. Marginal, Kiosk 14, Maputo</p>
                <p className="font-normal text-[9px] text-slate-500">NUIT: 400293112</p>
              </div>

              <div className="space-y-1 mb-2">
                <p><span className="text-slate-450">Fatura:</span> {completedTx.invoiceNumber}</p>
                <p><span className="text-slate-450">Data/Hora:</span> {new Date(completedTx.timestamp).toLocaleString()}</p>
                <p><span className="text-slate-450">Operador:</span> {completedTx.cashierName}</p>
                <p><span className="text-slate-450">Cliente:</span> {completedTx.customerName || "Consumidor Geral"}</p>
                {completedTx.nuit && <p><span className="text-slate-450">NUIT Cli:</span> {completedTx.nuit}</p>}
              </div>

              <div className="border-b border-dashed border-slate-300 py-1 mb-2">
                <div className="grid grid-cols-12 gap-1 font-bold text-slate-800 text-[10px]">
                  <span className="col-span-6 truncate">PRODUTO</span>
                  <span className="col-span-2 text-center">QTD</span>
                  <span className="col-span-4 text-right">SUBTOTAL</span>
                </div>
                 {/* Cart items */}
                 {completedTx.items.map((item) => (
                   <div key={item.productId} className="grid grid-cols-12 gap-1 py-0.5 text-slate-600">
                     <span className="col-span-6 truncate">{item.productName}</span>
                     <span className="col-span-2 text-center">{item.quantity}</span>
                     <span className="col-span-4 text-right">{(item.price * item.quantity).toLocaleString()} MT</span>
                   </div>
                 ))}
              </div>

              <div className="space-y-1 text-slate-600 text-right">
                <p>SUBTOTAL: {completedTx.subtotal.toLocaleString()} MT</p>
                {completedTx.discountTotal > 0 && <p className="text-red-650 font-bold">DESC. GER: -{completedTx.discountTotal.toLocaleString()} MT</p>}
                <p>TOTAL IVA Cobrado: {completedTx.vatTotal.toLocaleString()} MT</p>
                <p className="text-slate-900 font-bold text-xs border-t border-dashed border-slate-300 pt-1">
                  PAGO: {completedTx.grandTotal.toLocaleString()} MT
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic mt-1">Método: {completedTx.paymentMethod}</p>
                {completedTx.paymentDetails && (
                  <p className="text-[10px] text-red-600 font-medium italic mt-0.5">{completedTx.paymentDetails}</p>
                )}
              </div>

              <p className="text-center font-semibold text-[9px] text-slate-500 mt-3 border-t border-dashed border-slate-300 pt-2 block">
                *** Muito Obrigado Pela Visita! ***
              </p>
            </div>

            {/* Quick Digital Dispatchers */}
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Comunicações Digitais</p>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={simulateSendEmail}
                  disabled={sendEmailStatus !== "idle"}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition border border-blue-100 disabled:opacity-75 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {sendEmailStatus === "idle" ? "Enviar Email" : sendEmailStatus === "sending" ? "A Enviar..." : "Enviado ✓"}
                </button>
                <button
                  onClick={simulateSendSms}
                  disabled={sendSmsStatus !== "idle"}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition border border-emerald-100 disabled:opacity-75 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  {sendSmsStatus === "idle" ? "Enviar SMS" : sendSmsStatus === "sending" ? "A Enviar..." : "Enviado ✓"}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsSimulatingPrint(true);
                  try {
                    window.print();
                  } catch (err) {
                    console.warn("Dispositivo em iFrame bloqueado para window.print. Impressora Virtual Activada de forma segura.");
                  }
                  setTimeout(() => {
                    setIsSimulatingPrint(false);
                  }, 4000);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 border border-slate-200 hover:bg-slate-50 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                Imprimir Documento Físico
              </button>
            </div>

            {/* Close button */}
            <button
              onClick={handleReset}
              className="w-full py-2.5 bg-slate-900 text-white font-bold rounded-xl text-xs transition cursor-pointer text-center"
            >
              Completar e Iniciar Nova Venda
            </button>
          </div>
        </div>
      )}

      {/* Elegant Real-time Virtual Printer Animation Overlay Safeguard */}
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
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-500">Impressora Térmica OST Vendas</h4>
              <p className="text-[11px] text-zinc-400 mt-1">A transmitir cupão e a emitir rolo físico...</p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left font-mono text-[9px] text-zinc-400 max-h-32 overflow-hidden relative">
              <div className="animate-pulse mb-1.5 flex items-center gap-1.5 text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded w-max">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>• IMPRIMINDO RECIBO DIGITAL...</span>
              </div>
              <p className="font-bold border-b border-dashed border-zinc-800 pb-1 uppercase">{completedTx?.invoiceNumber || "FATURA-PROVISORIA"}</p>
              <p>OPERADOR: {completedTx?.cashierName || activeUsername}</p>
              <p>PAGO: {completedTx?.grandTotal.toLocaleString() || "0"} MT via {completedTx?.paymentMethod || "CASH"}</p>
              <p className="text-zinc-600 mt-1">Artigos processados na base comercial...</p>
              <div className="absolute inset-x-0 bottom-x-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
            </div>

            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "90%" }}></div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-normal">
              O documento foi devidamente registado e submetido às filas locais de impressão fiscal corporativa.
            </p>
          </div>
        </div>
      )}

      {/* Modern virtual feedback safeguard overlay for transaction completed without printing */}
      {noReceiptSuccess && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center z-[100] px-4 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-emerald-900 border border-emerald-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3.5 max-w-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold font-sans">Venda Registada Sem Recibo!</p>
              <p className="text-[10px] text-emerald-300 mt-0.5">Stock decrementado e auditoria guardada.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
