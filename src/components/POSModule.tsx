import React, { useState, useMemo, useEffect, useRef } from "react";
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
  ShoppingCart,
  Clock,
  Wifi,
  Sparkles,
  Camera,
  RotateCcw,
  AlertTriangle,
  History,
  UserCheck,
  Check,
  Maximize2,
  Minimize2,
  MessageSquare,
  Scan,
  QrCode
} from "lucide-react";
import { Product, Customer, CartItem, Transaction, SystemSettings } from "../types";
import { QrReader } from "react-qr-reader";
import { sendEmail } from "../lib/gmail";

// Extends CartItem type locally for inline observations
interface UpgradedCartItem extends CartItem {
  observation?: string;
}

interface POSModuleProps {
  products: Product[];
  customers: Customer[];
  transactions: Transaction[];
  activeUsername: string;
  settings: SystemSettings;
  onCompleteSale: (tx: Transaction) => void;
  onAddAuditLog: (action: string, module: string, details: string) => void;
  currency: string;
  onShowToast?: (message: string, type: "success" | "error" | "info" | "warning", title?: string) => void;
  isPOSFullscreen?: boolean;
  onChangePOSFullscreen?: (val: boolean) => void;
}

export default function POSModule({
  products,
  customers,
  transactions,
  activeUsername,
  settings,
  onCompleteSale,
  onAddAuditLog,
  currency,
  onShowToast,
  isPOSFullscreen = false,
  onChangePOSFullscreen
}: POSModuleProps) {
  
  // Local synchronized state to allow quick registering of customers and updating stock locally in the view
  const [localCustomers, setLocalCustomers] = useState<Customer[]>(customers);
  const [localProducts, setLocalProducts] = useState<Product[]>(products);
  
  // Sync when props change
  useEffect(() => { setLocalCustomers(customers); }, [customers]);
  useEffect(() => { setLocalProducts(products); }, [products]);

  // Session stats & setup
  const [currentSaleNumber, setCurrentSaleNumber] = useState<number>(245);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isOnline, setIsOnline] = useState<boolean>(true);

  // Time ticker and network toggle simulation
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard Shortcuts cheat sheet overlay or triggers
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [cart, setCart] = useState<UpgradedCartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>("CASH");

  // Multi-method payment cash allocations
  const [mixedCash, setMixedCash] = useState<number>(0);
  const [mixedMpesa, setMixedMpesa] = useState<number>(0);
  const [mixedPOS, setMixedPOS] = useState<number>(0);

  // Cash change automatic calculator states
  const [receivedCashAmount, setReceivedCashAmount] = useState<number>(0);

  const [debtDays, setDebtDays] = useState<number>(15);
  const [discountType, setDiscountType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [vatMode, setVatMode] = useState<"AUTO" | "EXEMPT" | "CUSTOM">("AUTO");
  const [customVatRate, setCustomVatRate] = useState<number>(16);

  // Completed Invoice Popup State
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [sendEmailStatus, setSendEmailStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendSmsStatus, setSendSmsStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [sendWhatsAppStatus, setSendWhatsAppStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [whatsappModalOpen, setWhatsappModalOpen] = useState(false);
  const [whatsappMessage, setWhatsappMessage] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [whatsappDirectUrl, setWhatsappDirectUrl] = useState("");
  const [isSimulatingPrint, setIsSimulatingPrint] = useState(false);
  const [noReceiptSuccess, setNoReceiptSuccess] = useState(false);

  // 15. Suspended carts system
  const [suspendedCarts, setSuspendedCarts] = useState<{ id: string; time: string; cart: UpgradedCartItem[]; customerId: string }[]>([]);

  // 19. Weight prompt modal state
  const [weightPromptProduct, setWeightPromptProduct] = useState<Product | null>(null);
  const [weightInputValue, setWeightInputValue] = useState<string>("1.0");

  // 20. Mock Camera Barcode Scanner Modal State
  const [scannerModalOpen, setScannerModalOpen] = useState(false);
  const [manualBarcodeScan, setManualBarcodeScan] = useState("");
  const [scannerTab, setScannerTab] = useState<"camera" | "simulation">("camera");
  const lastAlertTimeRef = useRef<number>(0);
  const lastScannedCodeRef = useRef<string>("");
  const lastScannedTimeRef = useRef<number>(0);
  const [continuousScan, setContinuousScan] = useState<boolean>(false);

  // 24. Pre-checkout Confirmation Modal State
  const [showPreCheckoutModal, setShowPreCheckoutModal] = useState(false);

  // 10. Quick Add Customer Modal State
  const [quickCustomerModalOpen, setQuickCustomerModalOpen] = useState(false);
  const [quickCustName, setQuickCustName] = useState("");
  const [quickCustPhone, setQuickCustPhone] = useState("");
  const [quickCustNuit, setQuickCustNuit] = useState("");

  // 16. Past sales modal trigger
  const [showSalesHistoryModal, setShowSalesHistoryModal] = useState(false);

  // 17. Hover details state
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null);

  // Categories list (including ⭐ Favoritos virtual tag)
  const categories = useMemo(() => {
    const list = new Set(localProducts.map(p => p.category));
    return ["Todos", "⭐ Favoritos", ...Array.from(list)];
  }, [localProducts]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return localProducts.filter(p => {
      const sQuery = searchQuery.toLowerCase();
      const matchSearch = 
        (p.name || "").toLowerCase().includes(sQuery) || 
        (p.code || "").toLowerCase().includes(sQuery) ||
        (p.brand || "").toLowerCase().includes(sQuery) ||
        (p.category || "").toLowerCase().includes(sQuery) ||
        (p.barcode || "").includes(searchQuery);

      if (selectedCategory === "Todos") return matchSearch;
      if (selectedCategory === "⭐ Favoritos") return matchSearch && p.isFavorite;
      return matchSearch && p.category === selectedCategory;
    });
  }, [localProducts, searchQuery, selectedCategory]);

  const selectedCustomer = useMemo(() => {
    return localCustomers.find(c => c.id === selectedCustomerId) || null;
  }, [localCustomers, selectedCustomerId]);

  // Smart Search / Autocomplete Barcode auto-addition hook
  useEffect(() => {
    if (!searchQuery) return;
    const barcodeMatch = localProducts.find(p => p.barcode === searchQuery.trim() || p.code === searchQuery.trim());
    if (barcodeMatch) {
      if (barcodeMatch.stock <= 0) {
        if (onShowToast) onShowToast(`Produto ${barcodeMatch.name} está esgotado!`, "error");
        setSearchQuery("");
        return;
      }
      handleTriggerAddToCart(barcodeMatch);
      if (onShowToast) onShowToast(`Escaneado: ${barcodeMatch.name} adicionado ao carrinho!`, "success");
      setSearchQuery("");
    }
  }, [searchQuery, localProducts]);

  // Global Keyboard Shortcuts (F2, F4, F6, F8, F9, ESC)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
        if (onShowToast) onShowToast("Atalho F2: Pesquisa focada!", "info");
      } else if (e.key === "F4") {
        e.preventDefault();
        setQuickCustomerModalOpen(true);
      } else if (e.key === "F6") {
        e.preventDefault();
        const value = prompt("Insira a percentagem de desconto comercial (0 a 100):");
        if (value !== null) {
          const num = parseFloat(value);
          if (!isNaN(num) && num >= 0 && num <= 100) {
            setDiscountType("PERCENT");
            setDiscountValue(num);
            if (onShowToast) onShowToast(`Desconto de ${num}% aplicado!`, "success");
          }
        }
      } else if (e.key === "F8") {
        e.preventDefault();
        // Toggle payment method
        const methods = ["CASH", "MPESA_PAGA_FACIL", "EMOLA", "POS_CARD", "DEBT", "MIXED"];
        const nextIdx = (methods.indexOf(selectedPaymentMethod) + 1) % methods.length;
        setSelectedPaymentMethod(methods[nextIdx]);
        if (onShowToast) onShowToast(`Método alterado para: ${methods[nextIdx]}`, "info");
      } else if (e.key === "F9") {
        e.preventDefault();
        if (cart.length > 0) {
          setShowPreCheckoutModal(true);
        } else {
          if (onShowToast) onShowToast("O carrinho está vazio para finalizar.", "warning");
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (cart.length > 0) {
          if (confirm("Deseja mesmo limpar e cancelar a venda actual?")) {
            handleReset();
            if (onShowToast) onShowToast("Venda cancelada com sucesso.", "info");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [cart, selectedPaymentMethod]);

  // Buffer input speed for USB Barcode Scanners
  useEffect(() => {
    let lastKeyTime = Date.now();
    let scanBuffer = "";

    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if inside input/textarea fields (to allow typing barcodes manually inside inputs)
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      const currentTime = Date.now();
      const diff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      // Scanners type extremely fast (usually < 35ms between characters)
      if (diff < 35) {
        if (e.key !== "Enter") {
          scanBuffer += e.key;
        } else {
          // Scanner complete
          const code = scanBuffer.trim();
          scanBuffer = "";
          const prod = localProducts.find(p => p.barcode === code || p.code === code);
          if (prod) {
            handleTriggerAddToCart(prod);
            if (onShowToast) onShowToast(`Scanner: ${prod.name} adicionado!`, "success");
          }
        }
      } else {
        // Reset buffer if typing slow
        if (e.key !== "Enter") {
          scanBuffer = e.key;
        }
      }
    };

    window.addEventListener("keypress", handleKeyPress);
    return () => window.removeEventListener("keypress", handleKeyPress);
  }, [localProducts]);

  // Add Item Router (check if weight-based)
  const handleTriggerAddToCart = (product: Product, forcedWeight?: number) => {
    if (product.weightBased && !forcedWeight) {
      setWeightPromptProduct(product);
      setWeightInputValue("1.0");
    } else {
      const addedQty = forcedWeight || 1;
      setCart(prev => {
        const existing = prev.find(item => item.product.id === product.id);
        if (existing) {
          if (existing.quantity + addedQty > product.stock) {
            if (onShowToast) onShowToast(`Quantidade excede o stock disponível (${product.stock} un)!`, "warning");
            return prev;
          }
          return prev.map(item => 
            item.product.id === product.id 
              ? { ...item, quantity: parseFloat((item.quantity + addedQty).toFixed(3)) }
              : item
          );
        } else {
          return [...prev, { product, quantity: addedQty, discount: 0, vatRate: product.vatRate, observation: "" }];
        }
      });
    }
  };

  // Direct edit quantity input field
  const handleDirectQuantityEdit = (productId: string, valStr: string) => {
    const parsed = parseFloat(valStr);
    if (isNaN(parsed) || parsed <= 0) return;

    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
        if (parsed > item.product.stock) {
          if (onShowToast) onShowToast(`Disponível apenas ${item.product.stock} em stock!`, "warning");
          return { ...item, quantity: item.product.stock };
        }
        return { ...item, quantity: parsed };
      }
      return item;
    }));
  };

  const handleRemoveFromCart = (productId: string) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === productId);
      if (existing) {
        const decStep = existing.product.weightBased ? 0.25 : 1;
        if (existing.quantity > decStep) {
          return prev.map(item => 
            item.product.id === productId 
              ? { ...item, quantity: parseFloat((item.quantity - decStep).toFixed(3)) }
              : item
          );
        }
      }
      return prev.filter(item => item.product.id !== productId);
    });
  };

  const handleDeleteRow = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  // Quick Add Item Observation
  const handleAddObservation = (productId: string) => {
    const currentNote = cart.find(i => i.product.id === productId)?.observation || "";
    const note = prompt("Inserir Observação para este produto (Ex: Sem IVA, Oferta, Embalar):", currentNote);
    if (note !== null) {
      setCart(prev => prev.map(item => 
        item.product.id === productId ? { ...item, observation: note } : item
      ));
    }
  };

  // Calculations
  const calculations = useMemo(() => {
    let subtotal = 0;
    let discountTotal = 0;
    let vatTotal = 0;
    let totalItemsCount = 0;

    cart.forEach(item => {
      const itemSub = item.product.salePrice * item.quantity;
      subtotal += itemSub;
      totalItemsCount += item.quantity;
      
      const rate = vatMode === "AUTO" ? item.product.vatRate : (vatMode === "EXEMPT" ? 0 : customVatRate);
      const vatAmount = (itemSub * (rate / 100));
      vatTotal += vatAmount;
    });

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
      grandTotal: Math.round(grandTotal),
      totalQty: parseFloat(totalItemsCount.toFixed(3))
    };
  }, [cart, discountType, discountValue, vatMode, customVatRate]);

  // Mixed Payment Auto-Balance Check
  const mixedSumTotal = useMemo(() => {
    return mixedCash + mixedMpesa + mixedPOS;
  }, [mixedCash, mixedMpesa, mixedPOS]);

  // Change amount calculation for cash payments
  const calculatedChange = useMemo(() => {
    const received = selectedPaymentMethod === "MIXED" ? mixedCash : receivedCashAmount;
    const baseToPay = selectedPaymentMethod === "MIXED" ? calculations.grandTotal - (mixedMpesa + mixedPOS) : calculations.grandTotal;
    return Math.max(0, received - baseToPay);
  }, [receivedCashAmount, calculations.grandTotal, selectedPaymentMethod, mixedCash, mixedMpesa, mixedPOS]);

  // Clear states
  const handleReset = () => {
    setCart([]);
    setSelectedCustomerId("");
    setSelectedPaymentMethod("CASH");
    setDiscountValue(0);
    setSearchQuery("");
    setCompletedTx(null);
    setSendEmailStatus("idle");
    setSendSmsStatus("idle");
    setReceivedCashAmount(0);
    setMixedCash(0);
    setMixedMpesa(0);
    setMixedPOS(0);
    setShowPreCheckoutModal(false);
  };

  // Execute checkout
  const handleCheckout = (emitReceipt: boolean = true) => {
    if (cart.length === 0) return;

    if (selectedPaymentMethod === "DEBT") {
      if (!selectedCustomer) {
        if (onShowToast) onShowToast("Selecione um cliente para prosseguir com a venda a crédito (Dívida).", "warning");
        return;
      }
      if (selectedCustomer.purchaseCount === 0 || selectedCustomer.totalSpent < 20000 || selectedCustomer.creditBlocked) {
        if (onShowToast) onShowToast("Cliente não cumpre os critérios para venda a crédito. Mínimo 20.000 MT de compras e sem bloqueios.", "error", "Crédito Recusado");
        return;
      }
    }

    if (selectedPaymentMethod === "MIXED" && Math.abs(mixedSumTotal - calculations.grandTotal) > 1) {
      if (onShowToast) onShowToast(`O somatório dos pagamentos mistos (${mixedSumTotal} MT) não corresponde ao total da venda (${calculations.grandTotal} MT).`, "error", "Pagamento Incorreto");
      return;
    }

    const invoiceNum = `FAC-2026-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowStr = new Date().toISOString();

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
        ? `Misto: Dinheiro: ${mixedCash} MT | M-Pesa: ${mixedMpesa} MT | POS: ${mixedPOS} MT`
        : selectedPaymentMethod === "DEBT"
        ? `Prazo: ${debtDays} dias. Vencimento: ${new Date(Date.now() + debtDays * 24 * 60 * 60 * 1000).toLocaleDateString()}`
        : undefined,
      items: cart.map(item => ({
        productId: item.product.id,
        productName: item.product.name + (item.observation ? ` (${item.observation})` : ""),
        quantity: item.quantity,
        price: item.product.salePrice,
        vatAmount: Math.round(item.product.salePrice * item.quantity * (item.product.vatRate / 100)),
        discountAmount: 0,
        subtotal: item.product.salePrice * item.quantity
      }))
    };

    onCompleteSale(transaction);
    setCurrentSaleNumber(prev => prev + 1);

    if (emitReceipt) {
      onAddAuditLog(
        "Efetuar Venda POS",
        "VENDAS",
        `Fatura ${invoiceNum} registrada por ${activeUsername}. Total: ${calculations.grandTotal} ${currency}. Cliente: ${selectedCustomer?.name || 'Geral'}`
      );
      setCompletedTx(transaction);
    } else {
      onAddAuditLog(
        "Efetuar Venda POS (Sem Recibo)",
        "VENDAS",
        `Venda rápida ${invoiceNum} registrada sem emissão de recibo. Total: ${calculations.grandTotal} ${currency}`
      );
      handleReset();
      setNoReceiptSuccess(true);
      setTimeout(() => { setNoReceiptSuccess(false); }, 3000);
    }
    setShowPreCheckoutModal(false);
  };

  // 15. Suspend and Resume Sale functions
  const handleSuspendSale = () => {
    if (cart.length === 0) {
      if (onShowToast) onShowToast("O carrinho está vazio para ser suspenso.", "warning");
      return;
    }
    const id = `susp-${Date.now()}`;
    const desc = selectedCustomer?.name || "Consumidor Geral";
    const record = {
      id,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      customerId: selectedCustomerId
    };
    setSuspendedCarts(prev => [...prev, record]);
    setCart([]);
    setSelectedCustomerId("");
    if (onShowToast) onShowToast(`Venda de "${desc}" suspensa com sucesso!`, "success", "Venda Suspensa");
  };

  const handleResumeSale = (id: string) => {
    const target = suspendedCarts.find(s => s.id === id);
    if (target) {
      setCart(target.cart);
      setSelectedCustomerId(target.customerId);
      setSuspendedCarts(prev => prev.filter(s => s.id !== id));
      if (onShowToast) onShowToast("Carrinho suspenso restaurado com sucesso!", "success");
    }
  };

  // Digital communication simulation API
  const simulateSendEmail = async () => {
    if (!completedTx) return;
    setSendEmailStatus("sending");
    const targetEmail = selectedCustomer?.email || "vendas.central@ost.co.mz";
    try {
      // Try sending real email using Gmail API first
      const emailBody = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
          <h2 style="color: #ea580c; text-align: center; margin-bottom: 20px;">${settings.companyName || "OST Vendas"} - Fatura Recibo</h2>
          <p><strong>Fatura Nº:</strong> ${completedTx.invoiceNumber}</p>
          <p><strong>Data:</strong> ${new Date(completedTx.timestamp).toLocaleString("pt-MZ")}</p>
          <p><strong>Caixa/Operador:</strong> ${activeUsername}</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
          <p>Olá <strong>${completedTx.customerName || "Consumidor Geral"}</strong>,</p>
          <p>Confirmamos a emissão da Fatura-Recibo no valor total de <strong>${completedTx.grandTotal.toLocaleString()} MT</strong> pago via <strong>${completedTx.paymentMethod}</strong>.</p>
          <p style="margin-top: 30px; font-size: 12px; color: #64748b; text-align: center;">Obrigado pela sua preferência!<br><em>${settings.companyName || "OST Vendas"}</em></p>
        </div>
      `;

      await sendEmail({
        to: targetEmail,
        subject: `Fatura ${completedTx.invoiceNumber} - ${settings.companyName || "OST Vendas"}`,
        body: emailBody,
        isHtml: true
      });

      setSendEmailStatus("sent");
      onAddAuditLog("Enviar Recibo por Email", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via e-mail real para ${targetEmail}.`);
      if (onShowToast) onShowToast("Recibo enviado por email com sucesso via Gmail API!", "success");
    } catch (realEmailErr: any) {
      console.warn("Could not send email via Gmail API, falling back to mock endpoint:", realEmailErr);
      
      try {
        await fetch("/api/email/dispatch-invoice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: targetEmail,
            invoiceNumber: completedTx.invoiceNumber,
            grandTotal: completedTx.grandTotal,
            cashier: activeUsername,
            customer: completedTx.customerName || "Consumidor Geral"
          })
        });
        setSendEmailStatus("sent");
        onAddAuditLog("Enviar Recibo por Email", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via e-mail (Simulação).`);
        if (onShowToast) onShowToast("Recibo enviado por email com sucesso!", "success");
      } catch (err) {
        setSendEmailStatus("idle");
        if (onShowToast) onShowToast("Simulado: Recibo de e-mail enviado com sucesso (Mock).", "success");
      }
    }
  };

  const simulateSendSms = async () => {
    if (!completedTx) return;
    setSendSmsStatus("sending");
    try {
      await fetch("/api/sms/dispatch-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedCustomer?.phone || "+258 84 900 1202",
          invoiceNumber: completedTx.invoiceNumber,
          grandTotal: completedTx.grandTotal
        })
      });
      setSendSmsStatus("sent");
      onAddAuditLog("Enviar Recibo por SMS", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via SMS.`);
      if (onShowToast) onShowToast("SMS de confirmação despachado!", "success");
    } catch (err) {
      setSendSmsStatus("idle");
      if (onShowToast) onShowToast("Simulado: Recibo de SMS enviado com sucesso (Mock).", "success");
    }
  };

  const handleOpenWhatsAppModal = () => {
    if (!completedTx) return;
    
    // Format a beautiful text invoice for Mozambique with local details
    const dateStr = new Date(completedTx.timestamp).toLocaleString();
    const itemsText = completedTx.items
      .map(item => `▪️ ${item.quantity}x ${item.productName} - ${(item.price * item.quantity).toLocaleString()} MT`)
      .join("\n");

    const text = `🧾 *RECIBO DIGITAL DE VENDA* - OST Vendas 🇲🇿\n` +
      `------------------------------------------\n` +
      `*Fatura:* ${completedTx.invoiceNumber}\n` +
      `*Data:* ${dateStr}\n` +
      `*Operador:* ${completedTx.cashierName}\n` +
      `*Cliente:* ${completedTx.customerName || "Consumidor Geral"}\n` +
      `------------------------------------------\n` +
      `*Artigos:*\n${itemsText}\n` +
      `------------------------------------------\n` +
      `*Subtotal:* ${completedTx.subtotal.toLocaleString()} MT\n` +
      (completedTx.discountTotal > 0 ? `*Desconto:* -${completedTx.discountTotal.toLocaleString()} MT\n` : "") +
      `*IVA Cobrado:* ${completedTx.vatTotal.toLocaleString()} MT\n` +
      `*TOTAL PAGO: ${completedTx.grandTotal.toLocaleString()} MT*\n` +
      `------------------------------------------\n` +
      `*Forma de Pagamento:* ${completedTx.paymentMethod}\n\n` +
      `Muito obrigado pela sua preferência! Volte sempre. ✨`;

    setWhatsappMessage(text);
    setWhatsappPhone(selectedCustomer?.phone || "");
    
    // Default URL pre-generation
    const cleanPhone = (selectedCustomer?.phone || "").replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;
    setWhatsappDirectUrl(`https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(text)}`);
    setSendWhatsAppStatus("idle");
    setWhatsappModalOpen(true);
  };

  const dispatchWhatsAppReceipt = async (forceLinkDirect = false) => {
    if (!completedTx) return;
    
    const cleanPhone = whatsappPhone.replace(/\D/g, "");
    const defaultPhone = cleanPhone.length === 9 && (cleanPhone.startsWith("84") || cleanPhone.startsWith("85") || cleanPhone.startsWith("82") || cleanPhone.startsWith("87") || cleanPhone.startsWith("86"))
      ? `258${cleanPhone}`
      : cleanPhone;

    const directUrl = `https://api.whatsapp.com/send?phone=${defaultPhone}&text=${encodeURIComponent(whatsappMessage)}`;

    if (forceLinkDirect || !settings.whatsappEnabled || settings.whatsappProvider === "DIRECT_LINK") {
      setSendWhatsAppStatus("sent");
      onAddAuditLog("Enviar Recibo WhatsApp", "VENDAS", `Link WhatsApp gerado para Fatura ${completedTx.invoiceNumber}.`);
      window.open(directUrl, "_blank", "noopener,noreferrer");
      setWhatsappModalOpen(false);
      if (onShowToast) onShowToast("Link do WhatsApp aberto com sucesso!", "success");
      return;
    }

    setSendWhatsAppStatus("sending");
    try {
      const response = await fetch("/api/whatsapp/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: defaultPhone,
          message: whatsappMessage,
          gatewayConfig: settings
        })
      });

      const resData = await response.json();
      
      if (!response.ok) {
        throw new Error(resData.error || "Falha ao enviar através do Gateway");
      }

      setSendWhatsAppStatus("sent");
      onAddAuditLog("Enviar Recibo WhatsApp", "VENDAS", `Fatura ${completedTx.invoiceNumber} enviada via WhatsApp Gateway.`);
      if (onShowToast) onShowToast(resData.message || "Recibo enviado pelo WhatsApp com sucesso!", "success");
      setWhatsappModalOpen(false);
    } catch (err: any) {
      setSendWhatsAppStatus("idle");
      if (onShowToast) onShowToast(`Erro no Gateway: ${err.message}. Redirecionando para Link Direto...`, "warning");
      
      // Automatic fallback
      window.open(directUrl, "_blank", "noopener,noreferrer");
      setWhatsappModalOpen(false);
    }
  };

  // Quick Customer Registration
  const handleQuickAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCustName) return;
    const newCust: Customer = {
      id: `cust-${Date.now()}`,
      name: quickCustName,
      phone: quickCustPhone || "Sem Telemóvel",
      email: `${quickCustName.toLowerCase().replace(/\s+/g, "")}@gmail.com`,
      address: "Maputo, Moçambique",
      nuit: quickCustNuit || "400000000",
      totalSpent: 0,
      purchaseCount: 0,
      debt: 0,
      loyaltyPoints: 0
    };
    setLocalCustomers(prev => [...prev, newCust]);
    setSelectedCustomerId(newCust.id);
    setQuickCustomerModalOpen(false);
    setQuickCustName("");
    setQuickCustPhone("");
    setQuickCustNuit("");
    if (onShowToast) onShowToast(`Cliente ${newCust.name} registado e selecionado!`, "success");
  };

  return (
    <div className={`flex flex-col xl:flex-row h-full gap-5 ${isPOSFullscreen ? "h-screen p-5 bg-slate-950 text-slate-100" : ""}`}>
      
      {/* LEFT COLUMN: Product Browse Grid & Header info */}
      <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl border border-slate-200 outline-none overflow-hidden shadow-sm">
        
        {/* 1. & 21. Dynamic POS Header & Status info */}
        <div className="p-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800">
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
              <ShoppingCart className="w-4 h-4" />
              <span>🛒 POS Nº {String(currentSaleNumber).padStart(6, '0')}</span>
            </div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div>👤 OPERADOR: <span className="text-slate-300 font-bold">{activeUsername}</span></div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div>🏪 CAIXA: <span className="text-slate-300 font-bold">CAIXA PRINCIPAL</span></div>
            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>
            <div>📅 TURNO: <span className="text-slate-300 font-bold">MANHÃ</span></div>
          </div>

          <div className="flex items-center gap-3">
            {/* Suspended sales recall badge */}
            {suspendedCarts.length > 0 && (
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-1 rounded-lg text-amber-400 text-[10px] font-bold">
                <span>⏳ Suspensa(s): {suspendedCarts.length}</span>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      handleResumeSale(e.target.value);
                      e.target.value = "";
                    }
                  }}
                  className="bg-transparent text-amber-400 font-bold text-[10px] outline-none cursor-pointer"
                >
                  <option value="" className="text-slate-900">Retomar...</option>
                  {suspendedCarts.map((sc, i) => (
                    <option key={sc.id} value={sc.id} className="text-slate-900">
                      Venda {i+1} ({sc.time}) - {localCustomers.find(c => c.id === sc.customerId)?.name || "Geral"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => setIsOnline(!isOnline)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                isOnline ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-red-500/15 text-red-400 border border-red-500/20"
              }`}
            >
              <Wifi className="w-3.5 h-3.5" />
              <span>{isOnline ? "🟢 ONLINE" : "🔴 OFFLINE"}</span>
            </button>

            {onChangePOSFullscreen && (
              <button
                onClick={() => {
                  onChangePOSFullscreen(!isPOSFullscreen);
                  if (onShowToast) {
                    onShowToast(
                      !isPOSFullscreen 
                        ? "Modo Foco Ativado! Sidebars e cabeçalhos ocultados para maximizar área de checkout." 
                        : "Modo Foco Desativado. Restaurado painel principal.",
                      "info",
                      "Modo Checkout"
                    );
                  }
                  onAddAuditLog(
                    !isPOSFullscreen ? "Ativar Modo Foco POS" : "Desativar Modo Foco POS",
                    "POS",
                    `O operador alterou o modo de exibição de checkout (Modo Foco: ${!isPOSFullscreen ? "ATIVADO" : "DESATIVADO"}).`
                  );
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                  isPOSFullscreen 
                    ? "bg-amber-500 text-slate-950 hover:bg-amber-400" 
                    : "bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-750"
                }`}
                title={isPOSFullscreen ? "Desativar Tela Inteira" : "Ativar Modo Foco (Tela Inteira)"}
              >
                {isPOSFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5 text-amber-400" />}
                <span>{isPOSFullscreen ? "MINIMIZAR" : "TELA CHEIA"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Search header & Filter bar */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Pesquisar por nome, marca, código de barras (F2) ou bipe o leitor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-24 py-2 text-xs focus:ring-1 focus:ring-orange-500 focus:border-orange-500 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setScannerModalOpen(true)}
                className="absolute right-2 top-1.5 px-2 py-1 bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-600 rounded-lg text-[10px] font-extrabold flex items-center gap-1 transition focus:outline-none focus:ring-1 focus:ring-orange-500"
                title="Abrir Scanner de Código de Barras (Câmara/Teclado)"
              >
                <Scan className="w-3.5 h-3.5 animate-pulse" />
                <span>SCAN</span>
              </button>
            </div>
            
            <div className="flex gap-2">
              {/* 20. Scanner Dialog button */}
              <button
                onClick={() => setScannerModalOpen(true)}
                className="px-3 bg-orange-500 hover:bg-orange-600 text-white border border-orange-600 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition"
                title="Simular/Ler Código de Barras com a Câmara"
              >
                <Camera className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">📷 Scanner de Câmara</span>
              </button>

              <button
                onClick={() => setShowSalesHistoryModal(true)}
                className="px-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <History className="w-3.5 h-3.5 text-slate-500" />
                <span className="hidden sm:inline">Histórico</span>
              </button>
            </div>
          </div>

          {/* 5. Recent Sold Products Horizontal pill row */}
          <div className="flex items-center gap-2 text-xs text-slate-500 overflow-x-auto pb-1">
            <span className="font-semibold shrink-0">⭐ Populares:</span>
            {localProducts.slice(0, 5).map(prod => (
              <button
                key={prod.id}
                onClick={() => handleTriggerAddToCart(prod)}
                className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-700 cursor-pointer shrink-0"
              >
                {prod.emoji} {prod.name.split(' (')[0]}
              </button>
            ))}
          </div>

          {/* Quick Categories list with Favoritos category */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
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

        {/* Products catalog list grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
          {filteredProducts.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <span className="text-3xl mb-2">🔍</span>
              <p className="text-sm font-semibold text-slate-700">Nenhum produto cadastrado foi localizado</p>
              <p className="text-xs text-slate-400 mt-1">Tente pesquisar por outro termo ou limpe os filtros seleccionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map((p) => {
                const isOutOfStock = p.stock <= 0;
                const isLowStock = p.stock > 0 && p.stock <= p.minStock;
                
                return (
                  <div
                    key={p.id}
                    className="relative"
                    onMouseEnter={() => setHoveredProductId(p.id)}
                    onMouseLeave={() => setHoveredProductId(null)}
                  >
                    {/* Product Hover Details Tooltip */}
                    {hoveredProductId === p.id && (
                      <div className="absolute z-20 bottom-full left-0 right-0 mb-2 p-3 bg-slate-900 text-white rounded-xl text-[10px] space-y-1.5 font-mono shadow-2xl border border-slate-800 animate-in fade-in slide-in-from-bottom-2 duration-150">
                        <p className="text-orange-400 font-bold border-b border-slate-800 pb-1">{p.name}</p>
                        <p>📦 Fornecedor: {p.supplier}</p>
                        <p>🏷️ Marca: {p.brand || "Generica"}</p>
                        <p>🔤 Código: {p.code}</p>
                        <p>💾 Stock Atual: {p.stock} {p.weightBased ? "kg" : "un"}</p>
                        <p>💵 P. Custo: {p.costPrice.toLocaleString()} MT</p>
                        <p>📈 Lucro: {(p.salePrice - p.costPrice).toLocaleString()} MT ({Math.round(((p.salePrice - p.costPrice)/p.salePrice)*100)}% margem)</p>
                        <p className="text-[9px] text-slate-400">📅 Última Compra: 22/06/2026</p>
                      </div>
                    )}

                    <button
                      onClick={() => handleTriggerAddToCart(p)}
                      disabled={isOutOfStock}
                      id={`btn-product-${p.id}`}
                      className={`w-full group bg-white p-4 rounded-xl border relative text-left transition-all flex flex-col justify-between select-none h-44 ${
                        isOutOfStock 
                          ? "border-slate-150 bg-slate-100/70 cursor-not-allowed opacity-60" 
                          : "border-slate-200 hover:border-orange-300 hover:shadow-md cursor-pointer"
                      }`}
                    >
                      {/* Floating Status badges */}
                      <div className="absolute top-2 right-2 flex flex-col items-end gap-1 z-10">
                        {isOutOfStock ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 leading-none">🔴 ESGOTADO</span>
                        ) : isLowStock ? (
                          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 leading-none">🟠 APENAS {p.stock}</span>
                        ) : (
                          <span className="text-[8.5px] font-semibold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 leading-none">🟢 {p.stock} Disp.</span>
                        )}

                        {/* 3. Promo label tags */}
                        {p.promotion === "PROMO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-orange-500 text-white leading-none">🔥 PROMOÇÃO</span>
                        )}
                        {p.promotion === "MAIS_VENDIDO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500 text-white leading-none">⭐ MAIS VENDIDO</span>
                        )}
                        {p.promotion === "NOVO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-indigo-500 text-white leading-none">🆕 NOVO</span>
                        )}
                        {p.promotion === "DESCONTO" && (
                          <span className="text-[8px] font-extrabold px-1.5 py-0.5 rounded bg-emerald-600 text-white leading-none">🏷️ DESCONTO</span>
                        )}
                      </div>

                      {/* Product Visual Layout */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-3xl p-1 bg-slate-100 group-hover:bg-orange-50 rounded-lg transition">{p.emoji || "📦"}</span>
                        {p.weightBased && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800 leading-none">Venda p/ Peso</span>
                        )}
                      </div>

                      {/* Title & Brand */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-800 line-clamp-2 leading-tight pr-2">{p.name}</h4>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">{p.brand ? `${p.brand} • ` : ""}{p.category}</p>
                      </div>

                      {/* Price stamp */}
                      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-sm font-black text-slate-900">{p.salePrice.toLocaleString()} <span className="text-[10px] font-medium text-slate-400">{currency}</span></span>
                        <span className="text-[9px] text-slate-400 font-mono">IVA {p.vatRate}%</span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottom shortcuts bar for operator */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-center gap-4 text-[10px] font-mono text-slate-500">
          <span className="font-bold uppercase text-slate-700">Atalhos Operador:</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F2</kbd> Pesquisa</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F4</kbd> Novo Cliente</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F6</kbd> Desconto</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F8</kbd> Alternar Pago</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">F9</kbd> Finalizar</span>
          <span><kbd className="px-1.5 py-0.5 bg-white border rounded shadow-sm text-slate-700 font-bold">ESC</kbd> Cancelar Venda</span>
        </div>
      </div>

      {/* RIGHT COLUMN: Interactive Shopping Cart sidebar */}
      <div className="w-full xl:w-96 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col">
        
        {/* 22. Cart Upper Status details panel */}
        <div className="p-4 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <ShoppingCart className="w-3.5 h-3.5 text-orange-400" />
              <span className="font-mono uppercase tracking-wider">Carrinho Ativo</span>
            </div>
            <span className="text-[10px] bg-slate-800 text-orange-300 font-mono px-2 py-0.5 rounded border border-slate-700">
              Hora: {currentTime}
            </span>
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="text-xs text-slate-300">
              <span className="font-bold">{cart.length}</span> produtos ({calculations.totalQty} {calculations.totalQty === 1 ? "un" : "un/kg"})
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              Cliente: <span className="text-orange-300 font-bold">{selectedCustomer ? selectedCustomer.name : "Consumidor Geral"}</span>
            </div>
          </div>
        </div>

        {/* 10. Modern Customer selection bar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
          <div className="flex-1 relative">
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-white border border-slate-200 rounded-lg text-xs py-1.5 pl-2 pr-6 outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer text-slate-700 font-medium"
            >
              <option value="">-- 👤 Consumidor Geral --</option>
              {localCustomers.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
              ))}
            </select>
          </div>
          
          <button
            onClick={() => setQuickCustomerModalOpen(true)}
            className="p-1.5 bg-orange-100 text-orange-700 hover:bg-orange-200 rounded-lg transition-all text-xs cursor-pointer flex items-center justify-center shrink-0 w-8 h-8"
            title="Adicionar Novo Cliente (F4)"
          >
            <UserPlus className="w-4 h-4" />
          </button>
        </div>

        {/* 23. Intelligent Alerts panel */}
        {selectedCustomer && selectedCustomer.debt > 0 && (
          <div className="px-3.5 py-1.5 bg-amber-50 border-b border-amber-100 text-amber-800 text-[10px] font-bold flex items-center gap-1.5 animate-pulse shrink-0">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>⚠️ Cliente possui dívida activa de {selectedCustomer.debt.toLocaleString()} MT!</span>
          </div>
        )}

        {/* Shopping list of cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400 mt-12">
              <span className="text-2xl mb-2">🛒</span>
              <p className="text-xs font-semibold text-slate-600">Carrinho Vazio</p>
              <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] mx-auto">Insira produtos utilizando o catálogo ao lado ou passe o código de barras no scanner.</p>
            </div>
          ) : (
            cart.map((item) => {
              const isInsufficient = item.quantity > item.product.stock;
              const hasNoVat = item.product.vatRate === 0;
              
              return (
                <div 
                  key={item.product.id} 
                  className={`p-2.5 rounded-xl border space-y-2 relative group transition-all ${
                    isInsufficient 
                      ? "bg-red-50/70 border-red-200" 
                      : "bg-slate-50 border-slate-100 hover:border-slate-300"
                  }`}
                >
                  <button
                    onClick={() => handleDeleteRow(item.product.id)}
                    className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 rounded-lg cursor-pointer"
                    title="Remover Item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <div className="pr-6">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider font-mono">{item.product.brand || "Generico"}</span>
                    <h5 className="text-xs font-bold text-slate-800 line-clamp-1 leading-tight">{item.product.name}</h5>
                    
                    {/* Item price / calculations breakdown */}
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {item.product.salePrice.toLocaleString()} MT × {item.quantity} {item.product.weightBased ? "kg" : "un"}
                    </p>

                    {/* Inline active alerts inside items */}
                    {isInsufficient && (
                      <p className="text-[9px] text-red-600 font-bold flex items-center gap-1 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Estoque insuficiente! Max: {item.product.stock}
                      </p>
                    )}
                    {hasNoVat && (
                      <p className="text-[9px] text-emerald-700 font-semibold flex items-center gap-1 mt-0.5">
                        💡 Remessa Isenta de IVA (Isento)
                      </p>
                    )}

                    {/* Show Observation note if configured */}
                    {item.observation && (
                      <div className="mt-1 bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded text-[9.5px] font-mono inline-block">
                        📝 Obs: "{item.observation}"
                      </div>
                    )}
                  </div>

                  {/* 25. Large Touch Target Controls for Tablet */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => handleRemoveFromCart(item.product.id)}
                        className="w-10 h-10 border bg-white text-slate-600 hover:bg-slate-150 rounded-lg flex items-center justify-center cursor-pointer transition active:scale-95 shrink-0"
                        title="Decrementar"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      
                      {/* Direct quantity input */}
                      <input
                        type="number"
                        step={item.product.weightBased ? "0.05" : "1"}
                        value={item.quantity}
                        onChange={(e) => handleDirectQuantityEdit(item.product.id, e.target.value)}
                        className="w-12 h-10 bg-white border text-center font-mono font-bold text-xs rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                        title="Quantidade Directa"
                      />

                      <button 
                        onClick={() => handleTriggerAddToCart(item.product.id as any)}
                        disabled={item.quantity >= item.product.stock}
                        className="w-10 h-10 border bg-white text-slate-600 hover:bg-slate-150 rounded-lg flex items-center justify-center cursor-pointer transition disabled:opacity-40 active:scale-95 shrink-0"
                        title="Incrementar"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {/* 6. Obs button trigger */}
                      <button
                        onClick={() => handleAddObservation(item.product.id)}
                        className="text-[10px] text-slate-500 hover:text-orange-600 flex items-center gap-0.5 font-medium hover:underline bg-white px-2 py-1 rounded border border-slate-100 cursor-pointer"
                      >
                        📝 Nota
                      </button>
                      
                      <span className="text-xs font-black text-slate-800">
                        {(item.product.salePrice * item.quantity).toLocaleString()} MT
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Global discount & VAT overrides panel */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 space-y-3 shrink-0">
          
          {/* Quick discounts triggers */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Desconto Geral</label>
              {discountValue > 0 && (
                <span className="text-[10px] text-orange-600 font-bold">
                  -{calculations.discountTotal.toLocaleString()} MT
                </span>
              )}
            </div>
            <div className="grid grid-cols-5 gap-1">
              <button 
                onClick={() => { setDiscountValue(0); }}
                className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${discountValue === 0 ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
              >
                Isento
              </button>
              {[5, 10, 15, 25].map(pct => (
                <button 
                  key={pct}
                  onClick={() => {
                    setDiscountType("PERCENT");
                    setDiscountValue(pct);
                  }}
                  className={`py-1.5 text-[10px] font-bold rounded-lg border transition ${discountValue === pct && discountType === "PERCENT" ? "bg-orange-500 text-white border-orange-500" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"}`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>

          {/* Key VAT selector customization */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Regulamento de IVA</span>
            <div className="flex bg-white rounded-lg p-0.5 border border-slate-200 text-[10px] font-bold">
              <button 
                onClick={() => setVatMode("AUTO")}
                className={`px-2 py-1 rounded-md transition ${vatMode === "AUTO" ? "bg-slate-200 text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
              >
                Auto
              </button>
              <button 
                onClick={() => setVatMode("EXEMPT")}
                className={`px-2 py-1 rounded-md transition ${vatMode === "EXEMPT" ? "bg-slate-200 text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
              >
                Isento
              </button>
              <button 
                onClick={() => setVatMode("CUSTOM")}
                className={`px-2 py-1 rounded-md transition ${vatMode === "CUSTOM" ? "bg-slate-200 text-slate-800 font-extrabold" : "text-slate-500 hover:text-slate-800"}`}
              >
                Custom
              </button>
            </div>
            {vatMode === "CUSTOM" && (
              <input
                type="number"
                value={customVatRate}
                onChange={(e) => setCustomVatRate(Number(e.target.value))}
                className="w-12 bg-white border border-slate-200 rounded-lg text-xs font-bold py-1 text-center outline-none focus:border-orange-500"
                min="0"
                max="100"
              />
            )}
          </div>
        </div>

        {/* 14. Financial Detailed Summary Card */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 text-[11px] font-mono text-slate-600 space-y-1 shrink-0">
          <div className="flex justify-between">
            <span>Produtos Únicos:</span>
            <span className="font-bold text-slate-800">{cart.length} item(s)</span>
          </div>
          <div className="flex justify-between">
            <span>Volume Total:</span>
            <span className="font-bold text-slate-800">{calculations.totalQty} unidades</span>
          </div>
          <div className="flex justify-between">
            <span>Soma Subtotal:</span>
            <span className="font-bold text-slate-800">{calculations.subtotal.toLocaleString()} MT</span>
          </div>
          {calculations.discountTotal > 0 && (
            <div className="flex justify-between text-red-650 font-bold">
              <span>Desconto Aplicado:</span>
              <span>-{calculations.discountTotal.toLocaleString()} MT</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Total de Imposto IVA:</span>
            <span className="font-bold text-slate-800">{calculations.vatTotal.toLocaleString()} MT</span>
          </div>
          <div className="flex justify-between text-sm font-black text-slate-900 border-t border-dashed border-slate-300 pt-1 font-sans">
            <span>TOTAL A FATURAR:</span>
            <span>{calculations.grandTotal.toLocaleString()} MT</span>
          </div>
        </div>

        {/* Liquidation options & actions */}
        <div className="p-3 border-t border-slate-200 bg-white space-y-3.5 shrink-0">
          
          {/* 11. Payment selector grid with icons */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">Método de Liquidação</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: "CASH", label: "💵 Dinheiro" },
                { id: "MPESA_PAGA_FACIL", label: "📱 M-Pesa" },
                { id: "EMOLA", label: "📱 E-Mola" },
                { id: "POS_CARD", label: "💳 POS" },
                { id: "CREDIT_CARD", label: "💳 Cartão" },
                { id: "BANK_TRANSFER", label: "🏦 Transf" },
                { id: "DEBT", label: "🧾 Dívida" },
                { id: "MIXED", label: "🤝 Misto" }
              ].map(method => (
                <button
                  key={method.id}
                  onClick={() => {
                    setSelectedPaymentMethod(method.id);
                  }}
                  className={`py-2 text-[10px] font-bold rounded-lg border text-center transition ${
                    selectedPaymentMethod === method.id 
                      ? "bg-slate-900 text-orange-400 border-slate-900 shadow-md" 
                      : "bg-white hover:bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* 12. Mixed Payment Configuration */}
          {selectedPaymentMethod === "MIXED" && (
            <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 space-y-2 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <div className="flex justify-between items-center border-b border-orange-100 pb-1">
                <span className="font-extrabold text-orange-850">🤝 Partilha de Pagamento Misto</span>
                <span className="font-mono text-[9px] bg-orange-100 text-orange-800 px-1 py-0.5 rounded">
                  Falta: {Math.max(0, calculations.grandTotal - mixedSumTotal).toLocaleString()} MT
                </span>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">💵 Numerário</label>
                  <input
                    type="number"
                    value={mixedCash || ""}
                    onChange={(e) => setMixedCash(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">📱 Celular (Mpesa)</label>
                  <input
                    type="number"
                    value={mixedMpesa || ""}
                    onChange={(e) => setMixedMpesa(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 block mb-1">💳 POS Cartão</label>
                  <input
                    type="number"
                    value={mixedPOS || ""}
                    onChange={(e) => setMixedPOS(parseFloat(e.target.value) || 0)}
                    className="w-full bg-white border border-slate-200 rounded p-1 text-xs font-bold text-center"
                  />
                </div>
              </div>

              <div className="flex justify-between items-center text-[10px] pt-1">
                <span>Total Alocado:</span>
                <span className={`font-bold ${Math.abs(mixedSumTotal - calculations.grandTotal) < 1 ? "text-emerald-600" : "text-red-500 animate-pulse"}`}>
                  {mixedSumTotal.toLocaleString()} MT / {calculations.grandTotal.toLocaleString()} MT
                </span>
              </div>
              {Math.abs(mixedSumTotal - calculations.grandTotal) < 1 ? (
                <p className="text-[9.5px] text-emerald-700 font-bold text-center">✓ Alocação correta e equilibrada!</p>
              ) : (
                <p className="text-[9.5px] text-amber-600 font-bold text-center">⚠️ Alocação pendente... preencha os valores acima.</p>
              )}
            </div>
          )}

          {/* 13. Cash Troco Automático Panel (for Numerário or mixed Numerário) */}
          {(selectedPaymentMethod === "CASH" || (selectedPaymentMethod === "MIXED" && mixedCash > 0)) && (
            <div className="bg-emerald-50/50 p-2.5 rounded-xl border border-emerald-100 space-y-1.5 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <span className="font-extrabold text-emerald-850">💵 Cálculo de Troco Automático</span>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[9px] text-slate-500 block">Valor Recebido do Cliente:</label>
                  <input
                    type="number"
                    value={selectedPaymentMethod === "MIXED" ? mixedCash : (receivedCashAmount || "")}
                    disabled={selectedPaymentMethod === "MIXED"}
                    onChange={(e) => setReceivedCashAmount(parseFloat(e.target.value) || 0)}
                    placeholder="Ex: 2000"
                    className="w-full bg-white border border-emerald-200 rounded p-1.5 text-xs font-bold text-center outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                
                {/* Large Green Badge Change Highlight */}
                <div className="bg-emerald-600 text-white p-2 rounded-xl text-center shrink-0 min-w-[100px] flex flex-col justify-center">
                  <span className="text-[8px] font-bold tracking-wider uppercase opacity-85">Troco</span>
                  <span className="text-sm font-black tracking-tight">{calculatedChange.toLocaleString()} MT</span>
                </div>
              </div>

              {/* Fast Cash Preset selection bills */}
              {selectedPaymentMethod !== "MIXED" && (
                <div className="flex flex-wrap gap-1 mt-1 pt-1 border-t border-emerald-150/50">
                  <span className="text-[9px] text-slate-400 font-semibold self-center">Presets:</span>
                  {[200, 500, 1000, 2000].map(val => (
                    <button
                      key={val}
                      onClick={() => setReceivedCashAmount(val)}
                      className="px-1.5 py-0.5 bg-white border hover:bg-emerald-100/50 border-emerald-200 rounded text-[10px] font-bold text-emerald-700 cursor-pointer transition active:scale-95"
                    >
                      {val} MT
                    </button>
                  ))}
                  <button
                    onClick={() => setReceivedCashAmount(calculations.grandTotal)}
                    className="px-1.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 rounded text-[10px] font-bold text-emerald-800 cursor-pointer"
                  >
                    Exato
                  </button>
                </div>
              )}
            </div>
          )}

          {selectedPaymentMethod === "DEBT" && (
            <div className="bg-red-50/70 p-2.5 rounded-xl border border-red-100 space-y-1.5 text-[11px] animate-in slide-in-from-top-1 duration-150">
              <span className="font-extrabold text-red-800">🧾 Liquidação de Crédito (Dívida em Conta)</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-semibold text-[10px]">Prazo Acordado:</span>
                <select
                  value={debtDays}
                  onChange={(e) => setDebtDays(Number(e.target.value))}
                  className="bg-white border border-red-200 rounded p-1 text-xs font-bold text-red-700 outline-none"
                >
                  <option value={5}>5 Dias</option>
                  <option value={10}>10 Dias</option>
                  <option value={15}>15 Dias</option>
                  <option value={30}>30 Dias</option>
                </select>
              </div>
              <p className="text-[9.5px] text-slate-500 font-mono leading-tight">
                Vencimento do Crédito em: <span className="font-bold text-red-600">{new Date(Date.now() + debtDays * 24 * 60 * 60 * 1000).toLocaleDateString()}</span>
              </p>
            </div>
          )}

          {/* Checkout & extra bottom buttons panel */}
          <div className="space-y-2">
            <button
              onClick={() => {
                if (cart.length > 0) setShowPreCheckoutModal(true);
              }}
              disabled={cart.length === 0}
              className={`w-full py-2.5 h-11 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg transition-all ${
                cart.length === 0
                  ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none"
                  : "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer shadow-orange-500/15 active:scale-[0.99]"
              }`}
            >
              <Receipt className="w-4 h-4" />
              Finalizar Venda (Emitir Recibo - F9)
            </button>

            {/* 15. Bottom Control actions row */}
            <div className="grid grid-cols-3 gap-1.5 pt-1">
              <button
                onClick={handleSuspendSale}
                disabled={cart.length === 0}
                className="py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer transition active:scale-95"
              >
                ⏸️ Suspender
              </button>
              <button
                onClick={() => {
                  if (cart.length === 0) {
                    if (onShowToast) onShowToast("O carrinho está vazio para salvar orçamento.", "warning");
                    return;
                  }
                  if (onShowToast) onShowToast("Simulado: Orçamento Comercial gravado e impresso com sucesso!", "success");
                }}
                disabled={cart.length === 0}
                className="py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-[10px] font-bold rounded-lg border border-slate-200 cursor-pointer transition active:scale-95"
              >
                📝 Orçamento
              </button>
              <button
                onClick={() => {
                  if (cart.length === 0) return;
                  if (confirm("Deseja mesmo esvaziar todo o carrinho?")) {
                    handleReset();
                    if (onShowToast) onShowToast("Carrinho cancelado.", "info");
                  }
                }}
                disabled={cart.length === 0}
                className="py-2 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-650 text-[10px] font-bold rounded-lg border border-red-100 cursor-pointer transition active:scale-95"
              >
                ❌ Cancelar
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* 24. PRE-CHECKOUT CONFIRMATION MODAL */}
      {showPreCheckoutModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Receipt className="w-5 h-5 text-orange-500" />
                <span>Confirmar Transacção de Venda</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Revise o sumário fiscal antes de faturar no sistema.</p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Cliente:</span>
                  <span className="font-bold text-slate-700">{selectedCustomer ? selectedCustomer.name : "Consumidor Geral"}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Operador:</span>
                  <span className="font-bold text-slate-700">{activeUsername} (Caixa Principal)</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Pagamento:</span>
                  <span className="font-bold text-orange-600">{selectedPaymentMethod}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Volume Total:</span>
                  <span className="font-bold text-slate-700">{calculations.totalQty} Artigos</span>
                </div>
              </div>

              {/* Items listing brief */}
              <div className="max-h-36 overflow-y-auto border border-slate-150 rounded-xl p-2.5 bg-slate-50/50 space-y-1.5 font-mono text-[10.5px]">
                {cart.map(item => (
                  <div key={item.product.id} className="flex justify-between text-slate-600">
                    <span className="truncate max-w-[220px]">{item.product.name}</span>
                    <span className="font-bold shrink-0">{item.quantity} × {item.product.salePrice.toLocaleString()} MT</span>
                  </div>
                ))}
              </div>

              {/* Detailed Financial highlight box */}
              <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 font-mono">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>SOMA SUB-TOTAL:</span>
                  <span>{calculations.subtotal.toLocaleString()} MT</span>
                </div>
                {calculations.discountTotal > 0 && (
                  <div className="flex justify-between text-[11px] text-red-400">
                    <span>DESCONTO COMERCIAL:</span>
                    <span>-{calculations.discountTotal.toLocaleString()} MT</span>
                  </div>
                )}
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>VALOR IVA APLICADO:</span>
                  <span>{calculations.vatTotal.toLocaleString()} MT</span>
                </div>
                <div className="flex justify-between text-sm font-black border-t border-slate-800 pt-2 text-orange-400 font-sans">
                  <span>TOTAL A PAGAR:</span>
                  <span>{calculations.grandTotal.toLocaleString()} MT</span>
                </div>

                {/* Change highlighted inside checkout */}
                {selectedPaymentMethod === "CASH" && (
                  <div className="flex justify-between text-[11px] text-emerald-400 border-t border-slate-800 pt-1">
                    <span>TROCO DE NUMERÁRIO:</span>
                    <span>{calculatedChange.toLocaleString()} MT</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick receipts choice check buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                onClick={() => setShowPreCheckoutModal(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Voltar e Ajustar
              </button>
              <button
                onClick={() => handleCheckout(true)}
                className="py-2.5 bg-orange-500 hover:bg-orange-600 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-orange-500/15"
              >
                Confirmar e Faturar ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 19. WEIGHT PROMPT MODAL */}
      {weightPromptProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-xs w-full border border-slate-100 shadow-2xl space-y-4 text-center animate-in zoom-in-95 duration-150">
            <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">{weightPromptProduct.emoji || "⚖️"}</span>
            </div>
            
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Pesagem de Artigo (Baloneta)</h3>
              <p className="text-[11px] text-slate-400 mt-1">Insira a quantidade pesada de <span className="font-bold text-slate-700">{weightPromptProduct.name}</span></p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="1.25"
                  value={weightInputValue}
                  onChange={(e) => setWeightInputValue(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-3 text-center text-xl font-bold font-mono outline-none focus:ring-1 focus:ring-orange-500"
                  autoFocus
                />
                <span className="absolute right-3.5 top-3.5 text-xs font-bold text-slate-400">kg</span>
              </div>

              {/* Fast weight presets */}
              <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold text-slate-700">
                {["0.25", "0.50", "1.0", "2.5"].map(w => (
                  <button
                    key={w}
                    onClick={() => setWeightInputValue(w)}
                    className="py-1 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 cursor-pointer"
                  >
                    {w} kg
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setWeightPromptProduct(null)}
                className="py-2 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const val = parseFloat(weightInputValue);
                  if (!isNaN(val) && val > 0) {
                    handleTriggerAddToCart(weightPromptProduct, val);
                    setWeightPromptProduct(null);
                  }
                }}
                className="py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Lançar Peso ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 20. REAL CAMERA & EMULATED BARCODE SCANNER MODAL */}
      {scannerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-5 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            
            {/* Header / Tab Switcher */}
            <div className="text-center space-y-2.5">
              <div className="w-11 h-11 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto">
                <Camera className="w-5.5 h-5.5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm">Leitor de Códigos de Barra</h3>
                <p className="text-[10.5px] text-slate-400 mt-0.5">Efetue a leitura de artigos para o carrinho de compras de forma automática.</p>
              </div>

              {/* Tab Selector */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setScannerTab("camera")}
                  className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                    scannerTab === "camera" 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  📷 Câmara Real
                </button>
                <button
                  type="button"
                  onClick={() => setScannerTab("simulation")}
                  className={`flex-1 py-1.5 text-[11px] font-extrabold rounded-lg transition-all cursor-pointer ${
                    scannerTab === "simulation" 
                      ? "bg-white text-slate-900 shadow-sm" 
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  🧪 Emulador POS
                </button>
              </div>
            </div>

            {/* TAB CONTENT 1: PHYSICAL CAMERA CAPTURE */}
            {scannerTab === "camera" && (
              <div className="space-y-3.5">
                <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-950 flex items-center justify-center">
                  
                  {/* Glowing Laser line animation overlay */}
                  <div className="absolute left-0 right-0 h-[1.5px] bg-red-500 shadow-[0_0_8px_#ef4444] z-10 animate-pulse" style={{
                    top: "50%",
                    transform: "translateY(-50%)"
                  }} />
                  
                  {/* Viewfinder corner overlays */}
                  <div className="absolute top-3 left-3 w-4 h-4 border-t-2 border-l-2 border-orange-500 z-10" />
                  <div className="absolute top-3 right-3 w-4 h-4 border-t-2 border-r-2 border-orange-500 z-10" />
                  <div className="absolute bottom-3 left-3 w-4 h-4 border-b-2 border-l-2 border-orange-500 z-10" />
                  <div className="absolute bottom-3 right-3 w-4 h-4 border-b-2 border-r-2 border-orange-500 z-10" />

                  {/* HTML5 QrReader Component */}
                  <QrReader
                    onResult={(result, error) => {
                      if (result) {
                        const textValue = result.text || result.getText?.() || String(result);
                        if (textValue) {
                          const trimmed = textValue.trim();
                          const now = Date.now();

                          // Prevent rapid duplicate scans within 2.5 seconds
                          if (trimmed === lastScannedCodeRef.current && now - lastScannedTimeRef.current < 2500) {
                            return;
                          }

                          lastScannedCodeRef.current = trimmed;
                          lastScannedTimeRef.current = now;

                          const match = localProducts.find(p => p.barcode === trimmed || p.code === trimmed);
                          if (match) {
                            handleTriggerAddToCart(match);
                            if (onShowToast) {
                              onShowToast(`Artigo Lido: ${match.name} (+1 adicionado)`, "success", "Câmara");
                            }
                            if (!continuousScan) {
                              setScannerModalOpen(false);
                            }
                          } else {
                            if (onShowToast) {
                              onShowToast(`Código lido: "${trimmed}" não registado no catálogo.`, "warning", "Código Desconhecido");
                            }
                          }
                        }
                      }
                    }}
                    constraints={{ facingMode: "environment" }}
                    scanDelay={400}
                    containerStyle={{ width: "100%", height: "100%" }}
                    videoStyle={{ objectFit: "cover", width: "100%", height: "100%" }}
                  />
                </div>

                {/* Continuous Scan Checkbox */}
                <label className="flex items-center gap-2 px-3 py-2 text-slate-600 justify-center text-[10.5px] bg-slate-50 rounded-xl border border-slate-150 cursor-pointer hover:bg-slate-100 transition">
                  <input
                    type="checkbox"
                    checked={continuousScan}
                    onChange={(e) => setContinuousScan(e.target.checked)}
                    className="rounded text-orange-500 focus:ring-orange-500 w-3.5 h-3.5 cursor-pointer"
                  />
                  <span className="font-bold select-none text-slate-700">Leitura Contínua (Não fechar painel após ler)</span>
                </label>
              </div>
            )}

            {/* TAB CONTENT 2: MOCK EMULATION LIST */}
            {scannerTab === "simulation" && (
              <div className="space-y-3.5">
                {/* Simulated list of barcodes */}
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  <span className="text-[9.5px] font-extrabold text-slate-400 uppercase tracking-wider font-mono block">Barcodes Disponíveis:</span>
                  {localProducts.map(p => (
                    <button
                      key={p.id}
                      onClick={() => {
                        handleTriggerAddToCart(p);
                        if (onShowToast) onShowToast(`Scanner leu: ${p.barcode}`, "success", "Emulador");
                        setScannerModalOpen(false);
                      }}
                      className="w-full text-left p-2 bg-slate-50 border border-slate-150 rounded-lg hover:bg-orange-50 hover:border-orange-200 text-xs flex justify-between items-center cursor-pointer transition"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-slate-700 block truncate">{p.name}</span>
                        <span className="text-[9.5px] font-mono text-slate-400 block">{p.barcode || "Sem Barcode"}</span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-orange-600 bg-white border border-slate-100 px-1.5 py-0.5 rounded shrink-0">Bipar</span>
                    </button>
                  ))}
                </div>

                <div className="border-t border-slate-100 pt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Insira barcode manualmente..."
                    value={manualBarcodeScan}
                    onChange={(e) => setManualBarcodeScan(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => {
                      if (manualBarcodeScan) {
                        const match = localProducts.find(p => p.barcode === manualBarcodeScan.trim() || p.code === manualBarcodeScan.trim());
                        if (match) {
                          handleTriggerAddToCart(match);
                          if (onShowToast) onShowToast(`Leitor processou: ${match.name}`, "success", "Manual");
                          setScannerModalOpen(false);
                          setManualBarcodeScan("");
                        } else {
                          if (onShowToast) onShowToast("Nenhum produto associado a este código.", "error", "Manual");
                        }
                      }
                    }}
                    className="px-3.5 bg-slate-900 text-white rounded-xl text-xs font-extrabold cursor-pointer hover:bg-slate-800"
                  >
                    Ler
                  </button>
                </div>
              </div>
            )}

            {/* Footer Close Button */}
            <button
              onClick={() => setScannerModalOpen(false)}
              className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer transition"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {/* 10. QUICK REGISTER CUSTOMER MODAL */}
      {quickCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleQuickAddCustomer} className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-2">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-slate-900 text-sm">👤 Cadastro Rápido de Cliente</h3>
              <p className="text-xs text-slate-400 mt-1">Crie um cadastro de cliente fiduciário simplificado directamente do ponto de venda.</p>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Armindo Chauque"
                  value={quickCustName}
                  onChange={(e) => setQuickCustName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-bold"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">Telemóvel (M-Pesa) *</label>
                <input
                  type="text"
                  placeholder="Ex: 843329102"
                  value={quickCustPhone}
                  onChange={(e) => setQuickCustPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>
              <div>
                <label className="font-semibold text-slate-600 block mb-1">NUIT (Moçambique ID)</label>
                <input
                  type="text"
                  placeholder="Ex: 299104882"
                  value={quickCustNuit}
                  onChange={(e) => setQuickCustNuit(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-orange-500 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickCustomerModalOpen(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold cursor-pointer shadow-md"
              >
                Registar Cliente
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 16. SESSION TRANSACTION HISTORY MODAL */}
      {showSalesHistoryModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                  <History className="w-5 h-5 text-orange-500" />
                  <span>Histórico Recente de Vendas</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Últimas vendas efetuadas na presente sessão de caixa.</p>
              </div>
              <button
                onClick={() => setShowSalesHistoryModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                Fchar ×
              </button>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 8).map((tx, idx) => (
                  <div key={`${tx.id || ""}-${idx}`} className="p-3 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs transition hover:bg-slate-100">
                    <div>
                      <span className="font-bold text-slate-700 block">{tx.invoiceNumber}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tx.paymentMethod} • Op: {tx.cashierName}
                      </span>
                    </div>
                    <div className="text-right flex items-center gap-3">
                      <span className="font-extrabold text-slate-800">{tx.grandTotal.toLocaleString()} MT</span>
                      <button
                        onClick={() => {
                          setCompletedTx(tx);
                          setShowSalesHistoryModal(false);
                        }}
                        className="p-1.5 bg-white border border-slate-200 hover:bg-orange-50 rounded text-[10px] font-bold text-orange-600 transition"
                      >
                        Visualizar
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-xs text-slate-400 py-6">Nenhuma venda realizada neste terminal ainda.</p>
              )}
            </div>

            <button
              onClick={() => setShowSalesHistoryModal(false)}
              className="w-full py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl cursor-pointer hover:bg-slate-850"
            >
              Fechar Painel
            </button>
          </div>
        </div>
      )}

      {/* POPUP MODAL: Receipt & Communications */}
      {completedTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full border border-slate-100 shadow-2xl flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-100 text-green-700 rounded-full flex items-center justify-center mx-auto mb-2.5">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Venda Concluída com Sucesso!</h3>
              <p className="text-xs text-slate-400 mt-1">Transação consolidada e stock comercial deduzido.</p>
            </div>

            {/* Simulated Receipt Display */}
            <div className="border border-slate-200 bg-slate-50 rounded-xl p-4 font-mono text-[11px] leading-tight text-slate-700 select-all max-h-60 overflow-y-auto">
              <div className="text-center font-bold text-slate-800 mb-2 border-b border-dashed border-slate-300 pb-2">
                <p className="uppercase">OST COMÉRCIO CENTRAL</p>
                <p className="font-normal text-[9px] text-slate-500 font-sans">Av. Marginal, Kiosk 14, Maputo</p>
                <p className="font-normal text-[9px] text-slate-500 font-sans">NUIT: 400293112</p>
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
                  <span className="col-span-4 text-right">VALOR</span>
                </div>
                 {completedTx.items.map((item, i) => (
                   <div key={`${item.productId}-${i}`} className="grid grid-cols-12 gap-1 py-0.5 text-slate-600">
                     <span className="col-span-6 truncate">{item.productName}</span>
                     <span className="col-span-2 text-center">{item.quantity}</span>
                     <span className="col-span-4 text-right">{(item.price * item.quantity).toLocaleString()} MT</span>
                   </div>
                 ))}
              </div>

              <div className="space-y-1 text-slate-600 text-right">
                <p>SUBTOTAL: {completedTx.subtotal.toLocaleString()} MT</p>
                {completedTx.discountTotal > 0 && <p className="text-red-650 font-bold">DESC. GER: -{completedTx.discountTotal.toLocaleString()} MT</p>}
                <p>TOTAL IVA COBRADO: {completedTx.vatTotal.toLocaleString()} MT</p>
                <p className="text-slate-900 font-bold text-xs border-t border-dashed border-slate-300 pt-1">
                  TOTAL PAGO: {completedTx.grandTotal.toLocaleString()} MT
                </p>
                <p className="text-[10px] text-slate-500 font-medium italic mt-1">Método: {completedTx.paymentMethod}</p>
                {completedTx.paymentDetails && (
                  <p className="text-[9.5px] text-red-600 font-semibold italic mt-0.5">{completedTx.paymentDetails}</p>
                )}
              </div>

              <p className="text-center font-semibold text-[9px] text-slate-500 mt-3 border-t border-dashed border-slate-300 pt-2 block">
                *** Muito Obrigado Pela Visita! ***
              </p>
            </div>

            {/* Quick Digital Dispatchers */}
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Comunicações Digitais</p>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={simulateSendEmail}
                  disabled={sendEmailStatus !== "idle"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-blue-50 text-blue-750 hover:bg-blue-100 transition border border-blue-100 disabled:opacity-75 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  {sendEmailStatus === "idle" ? "Email" : sendEmailStatus === "sending" ? "..." : "✓"}
                </button>
                <button
                  onClick={simulateSendSms}
                  disabled={sendSmsStatus !== "idle"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition border border-indigo-100 disabled:opacity-75 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 shrink-0" />
                  {sendSmsStatus === "idle" ? "SMS" : sendSmsStatus === "sending" ? "..." : "✓"}
                </button>
                <button
                  onClick={handleOpenWhatsAppModal}
                  disabled={sendWhatsAppStatus === "sending"}
                  className="flex items-center justify-center gap-1 py-2 rounded-xl text-[11px] font-semibold bg-emerald-50 text-emerald-850 hover:bg-emerald-100 transition border border-emerald-150 cursor-pointer"
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                  {sendWhatsAppStatus === "idle" ? "WhatsApp" : sendWhatsAppStatus === "sending" ? "..." : "✓"}
                </button>
              </div>

              <button
                onClick={() => {
                  setIsSimulatingPrint(true);
                  try {
                    window.print();
                  } catch (err) {
                    console.warn("Dispositivo em iFrame bloqueado para window.print. Impressora Virtual Activada.");
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
        <div className="fixed inset-0 bg-zinc-950/85 backdrop-blur-md flex items-center justify-center z-[100] p-4 text-xs font-sans">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center space-y-4 text-white">
            <div className="relative w-16 h-16 mx-auto bg-orange-500/10 rounded-full flex items-center justify-center text-amber-500">
              <Printer className="w-8 h-8 animate-bounce" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
            </div>
            
            <div>
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-amber-500">Impressora Térmica Fiscal</h4>
              <p className="text-[11px] text-zinc-400 mt-1">A transmitir cupão e a emitir rolo físico...</p>
            </div>
            
            <div className="bg-zinc-950 p-3 rounded-lg border border-zinc-850 text-left font-mono text-[9px] text-zinc-400 max-h-32 overflow-hidden relative">
              <div className="animate-pulse mb-1.5 flex items-center gap-1.5 text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-500 px-1.5 py-0.5 rounded w-max">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
                <span>• IMPRIMINDO RECIBO FISCAL...</span>
              </div>
              <p className="font-bold border-b border-dashed border-zinc-800 pb-1 uppercase">{completedTx?.invoiceNumber || "FATURA-PROVISORIA"}</p>
              <p>OPERADOR: {completedTx?.cashierName || activeUsername}</p>
              <p>PAGO: {completedTx?.grandTotal.toLocaleString() || "0"} MT via {completedTx?.paymentMethod || "CASH"}</p>
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-zinc-950 to-transparent pointer-events-none"></div>
            </div>

            <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full animate-pulse" style={{ width: "90%" }}></div>
            </div>

            <p className="text-[10px] text-zinc-500 leading-normal">
              O documento comercial foi registado nas filas locais de impressão fiscal corporativa.
            </p>
          </div>
        </div>
      )}

      {/* Modern virtual feedback safeguard overlay for transaction completed without printing */}
      {noReceiptSuccess && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center z-[100] px-4 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-emerald-950 border border-emerald-800 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3.5 max-w-sm">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 text-zinc-950 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-xs font-bold font-sans">Venda Registada Sem Recibo!</p>
              <p className="text-[10px] text-emerald-300 mt-0.5">Stock decrementado e auditoria local guardada.</p>
            </div>
          </div>
        </div>
      )}

      {/* 26. WHATSAPP SEND DIALOG MODAL */}
      {whatsappModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-2xl max-w-lg w-full border border-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150 text-slate-800">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                  <span>Enviar Recibo via WhatsApp</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Revise o contacto e o formato do documento antes de despachar.</p>
              </div>
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${settings.whatsappEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>
                {settings.whatsappEnabled ? `API: ${settings.whatsappProvider}` : "Modo Link Direto"}
              </span>
            </div>

            <div className="space-y-3.5">
              {/* Phone number field */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Número do Cliente (Com WhatsApp)</label>
                <div className="relative">
                  <input
                    type="text"
                    value={whatsappPhone}
                    onChange={(e) => setWhatsappPhone(e.target.value)}
                    placeholder="Ex: +258 84 900 1202"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2 px-3 pl-10 text-xs font-bold outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <span className="absolute left-3.5 top-2.5 text-slate-400 text-xs font-bold font-mono">🇲🇿</span>
                </div>
                <p className="text-[9px] text-slate-400">Insira com o indicativo (Ex: +258 ou 258) ou apenas o número celular de Moçambique de 9 dígitos.</p>
              </div>

              {/* Message preview body */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mensagem de Texto Pré-formatada</label>
                  <span className="text-[9.5px] font-mono text-slate-400">{whatsappMessage.length} caracteres</span>
                </div>
                <textarea
                  value={whatsappMessage}
                  onChange={(e) => setWhatsappMessage(e.target.value)}
                  rows={8}
                  className="w-full bg-slate-50/50 border border-slate-200 rounded-xl p-3 text-[10.5px] font-mono leading-relaxed outline-none focus:ring-1 focus:ring-emerald-500 max-h-60"
                />
              </div>

              {/* Helper guide on chosen provider */}
              <div className="bg-slate-50 border border-slate-150 rounded-xl p-3 text-[10px] space-y-1 font-mono text-slate-500">
                <p className="font-bold text-slate-700">⚙️ Canal de Comunicação Ativo:</p>
                {settings.whatsappEnabled && settings.whatsappProvider !== "DIRECT_LINK" ? (
                  <>
                    <p>• Provedor: <span className="text-emerald-700 font-bold">{settings.whatsappProvider}</span></p>
                    <p>• Endpoint: <span className="truncate block max-w-full">{settings.whatsappApiEndpoint || "Configurado"}</span></p>
                    <p className="text-[9px] text-slate-400">As mensagens serão disparadas via servidor invisível sem intervenção manual. Se houver falha, reverteremos para Link Direto.</p>
                  </>
                ) : (
                  <>
                    <p>• Provedor: <span className="text-orange-600 font-bold">Link Direto (wa.me)</span></p>
                    <p>• Custo: <span className="text-emerald-700 font-bold">100% Grátis e Ilimitado</span></p>
                    <p className="text-[9px] text-slate-400">O sistema abrirá uma nova aba do navegador para o WhatsApp Web ou aplicação móvel do operador com a mensagem pré-carregada.</p>
                  </>
                )}
              </div>
            </div>

            {/* Actions choosing triggers */}
            <div className="grid grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
              <button
                onClick={() => setWhatsappModalOpen(false)}
                className="py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
              >
                Voltar
              </button>
              
              {settings.whatsappEnabled && settings.whatsappProvider !== "DIRECT_LINK" ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => dispatchWhatsAppReceipt(true)}
                    className="flex-1 py-2.5 bg-slate-200 hover:bg-slate-300 rounded-xl text-[10px] font-bold text-slate-700 transition cursor-pointer"
                    title="Usar link wa.me direto em vez de gateway"
                  >
                    Link Direto
                  </button>
                  <button
                    onClick={() => dispatchWhatsAppReceipt(false)}
                    disabled={sendWhatsAppStatus === "sending"}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-[10px] font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/15"
                  >
                    {sendWhatsAppStatus === "sending" ? "A Enviar..." : "Disparar API ✓"}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => dispatchWhatsAppReceipt(true)}
                  className="py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl text-xs font-bold text-white transition cursor-pointer shadow-lg shadow-emerald-600/15"
                >
                  Abrir WhatsApp Link ✓
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
