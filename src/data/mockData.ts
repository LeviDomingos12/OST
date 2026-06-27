import { Product, Customer, Transaction, CashFlowEntry, Employee, SystemSettings, AuditLog } from "../types";

export const initialProducts: Product[] = [
  { id: "p1", name: "Arroz Nacional de Chicualacuala (25kg)", code: "ARR-025", category: "Mercearia", supplier: "MozAlimentos Lda", costPrice: 850, salePrice: 1200, vatRate: 16, stock: 45, minStock: 10, emoji: "🍙", brand: "Chicualacuala", barcode: "560123456781", isFavorite: true, promotion: "MAIS_VENDIDO" },
  { id: "p2", name: "Óleo Alimentar Maçaroca (5L)", code: "OLE-005", category: "Mercearia", supplier: "Indústrias de Moçambique", costPrice: 420, salePrice: 580, vatRate: 16, stock: 4, minStock: 8, emoji: "🧴", brand: "Maçaroca", barcode: "560123456782", isFavorite: true, promotion: "DESCONTO" },
  { id: "p3", name: "Farinha de Milho Top Score (10kg)", code: "FAR-010", category: "Mercearia", supplier: "MiliMoçambique", costPrice: 380, salePrice: 520, vatRate: 16, stock: 35, minStock: 15, emoji: "🌾", brand: "Top Score", barcode: "560123456783", isFavorite: true },
  { id: "p4", name: "Cerveja Laurentina Preta (Garrafa 330ml)", code: "CER-LAU", category: "Bebidas", supplier: "CDM - Cervejas de Moçambique", costPrice: 55, salePrice: 85, vatRate: 16, stock: 120, minStock: 40, emoji: "🍺", brand: "Laurentina", barcode: "560123456784", promotion: "PROMO" },
  { id: "p5", name: "Cerveja 2M (Lata 330ml)", code: "CER-2M", category: "Bebidas", supplier: "CDM - Cervejas de Moçambique", costPrice: 50, salePrice: 75, vatRate: 16, stock: 180, minStock: 50, emoji: "🍻", brand: "2M", barcode: "560123456785", isFavorite: true },
  { id: "p6", name: "Sumo Santal Maçã (1L)", code: "SUM-SAN", category: "Bebidas", supplier: "Distribuidora Sul", costPrice: 90, salePrice: 140, vatRate: 16, stock: 3, minStock: 12, expiryDate: "2026-07-15", emoji: "🧃", brand: "Santal", barcode: "560123456786", promotion: "DESCONTO" },
  { id: "p7", name: "Carregador Rápido USB-C 20W", code: "ELE-CRG", category: "Eletrónicos", supplier: "Afritronics", costPrice: 200, salePrice: 450, vatRate: 16, stock: 15, minStock: 5, emoji: "🔌", brand: "Afritronics", barcode: "560123456787", promotion: "NOVO" },
  { id: "p8", name: "Smartphone Itel A58 Lite", code: "ELE-ITE", category: "Eletrónicos", supplier: "Afritronics", costPrice: 2800, salePrice: 3990, vatRate: 16, stock: 2, minStock: 3, emoji: "📱", brand: "Itel", barcode: "560123456788", isFavorite: true },
  { id: "p9", name: "Cimento Limbo 42.5N (50kg)", code: "CON-CIM", category: "Construção", supplier: "Cimentos de Moçambique", costPrice: 580, salePrice: 710, vatRate: 16, stock: 80, minStock: 20, emoji: "🧱", brand: "Limbo", barcode: "560123456789" },
  { id: "p10", name: "Camiseta Polo Premium Masculina", code: "VEST-POL", category: "Vestuário", supplier: "Têxteis de Maputo", costPrice: 450, salePrice: 950, vatRate: 16, stock: 22, minStock: 6, emoji: "👕", brand: "Polo", barcode: "560123456790" },
  { id: "p11", name: "Iogurte Danone Morango (Pote 500g)", code: "MER-IOG", category: "Mercearia", supplier: "MozAlimentos Lda", costPrice: 80, salePrice: 130, vatRate: 16, stock: 18, minStock: 10, expiryDate: "2026-06-28", emoji: "🍧", brand: "Danone", barcode: "560123456791" },
  { id: "p12", name: "Tomate de Estufa Nacional (kg)", code: "HORT-TOM", category: "Frescos", supplier: "AgroPecuária Chimoio", costPrice: 40, salePrice: 85, vatRate: 0, stock: 150, minStock: 20, emoji: "🍅", brand: "Chimoio", barcode: "560123456792", weightBased: true, isFavorite: true },
  { id: "p13", name: "Batata Nevada Nacional (kg)", code: "HORT-BAT", category: "Frescos", supplier: "AgroPecuária Chimoio", costPrice: 30, salePrice: 65, vatRate: 0, stock: 200, minStock: 30, emoji: "🥔", brand: "Chimoio", barcode: "560123456793", weightBased: true },
  { id: "p14", name: "Maçã Vermelha Gala (kg)", code: "FRUT-MAC", category: "Frescos", supplier: "Frutas de Manica", costPrice: 70, salePrice: 120, vatRate: 0, stock: 90, minStock: 15, emoji: "🍎", brand: "Manica", barcode: "560123456794", weightBased: true, promotion: "PROMO" }
];

export const initialCustomers: Customer[] = [
  { id: "c1", name: "Carlos Tembe", phone: "847231455", email: "carlos.tembe@gmail.com", address: "Av. Julius Nyerere, Maputo", nuit: "142533669", totalSpent: 24500, purchaseCount: 14, lastPurchaseDate: "2026-06-21", debt: 2200, loyaltyPoints: 245 },
  { id: "c2", name: "Anabela Maquela", phone: "829913401", email: "anabela.m@yahoo.com", address: "Bairro Central, Beira", nuit: "299104882", totalSpent: 48900, purchaseCount: 32, lastPurchaseDate: "2026-06-22", debt: 0, loyaltyPoints: 680 },
  { id: "c3", name: "Sérgio Nhaca", phone: "852309112", email: "sergio.nhaca@outlook.com", address: "Sommerschield, Maputo", nuit: "330190442", totalSpent: 12500, purchaseCount: 8, lastPurchaseDate: "2026-06-18", debt: 6500, loyaltyPoints: 125 },
  { id: "c4", name: "Fátima Mussa", phone: "841103987", email: "fatima.mussa@gmail.com", address: "Bairro Triunfo, Maputo", nuit: "188204991", totalSpent: 75000, purchaseCount: 55, lastPurchaseDate: "2026-06-22", debt: 0, loyaltyPoints: 1120 },
  { id: "c5", name: "Mateus Chimbondzo", phone: "873302911", email: "mateus.ch@gamil.com", address: "Matchiki-Tchiki, Matola", nuit: "400192883", totalSpent: 6200, purchaseCount: 4, lastPurchaseDate: "2026-06-05", debt: 1500, loyaltyPoints: 62 }
];

export const initialEmployees: Employee[] = [
  { id: "e1", name: "Levi Domingos", role: "Administrador Completo", contact: "841234567", salary: 85000, admissionDate: "2024-01-10", status: "ACTIVE" },
  { id: "e2", name: "Inácio Macamo", role: "Supervisor de Vendas", contact: "859923881", salary: 45000, admissionDate: "2025-03-15", status: "ACTIVE" },
  { id: "e3", name: "Marta Ubisse", role: "Operadora de Caixa / Vendas", contact: "823301923", salary: 22000, admissionDate: "2025-09-01", status: "ACTIVE" },
  { id: "e4", name: "Délio Chiponde", role: "Operador de Caixa", contact: "867712399", salary: 22000, admissionDate: "2026-01-15", status: "ACTIVE" }
];

export const initialCashFlow: CashFlowEntry[] = [
  { id: "f1", timestamp: "2026-06-22T08:00:00", type: "REINFORCEMENT", amount: 5000, reason: "Abertura de Caixa Padrão", responsibleUser: "Inácio Macamo" },
  { id: "f2", timestamp: "2026-06-22T11:30:00", type: "EXPENSE", amount: 450, reason: "Compra de Resmas de Papel A4", responsibleUser: "Marta Ubisse" },
  { id: "f3", timestamp: "2026-06-22T14:15:00", type: "QUEBRA", amount: 150, reason: "Diferença física de trocos em numerário", responsibleUser: "Marta Ubisse" },
  { id: "f4", timestamp: "2026-06-22T17:00:00", type: "INPUT", amount: 12000, reason: "Retirada parcial de caixa para cofre (Sangria)", responsibleUser: "Inácio Macamo" }
];

export const initialAuditLogs: AuditLog[] = [
  { id: "a1", timestamp: "2026-06-22T07:45:00", user: "Inácio Macamo", userRole: "SUPERVISOR", action: "Abertura de Caixa", module: "CAIXA", details: "Abertura efetuada com 5,000 MT de saldo inicial." },
  { id: "a2", timestamp: "2026-06-22T09:12:00", user: "Levi Domingos", userRole: "ADMIN", action: "Ajuste de Stock", module: "STOCK", details: "Arroz Nacional de Chicualacuala (25kg) aumentado em +20 unidades." },
  { id: "a3", timestamp: "2026-06-22T11:45:00", user: "Marta Ubisse", userRole: "CASHIER", action: "Desconto Autorizado por Supervisor", module: "VENDAS", details: "Venda #1032 teve desconto de 15% autorizado por Inácio Macamo." },
  { id: "a4", timestamp: "2026-06-22T15:30:00", user: "Levi Domingos", userRole: "ADMIN", action: "Atualização de Configurações", module: "CONFIGURAÇÕES", details: "Alterado o endereço SMTP do servidor de correio comercial para Gmail SSL." }
];

// Generates dynamic last-30-day transactions to populate charts perfectly
export const generateMockTransactions = (): Transaction[] => {
  const transactions: Transaction[] = [];
  const baseDate = new Date();
  
  // Past 30 days
  for (let i = 29; i >= 0; i--) {
    const currentDate = new Date();
    currentDate.setDate(baseDate.getDate() - i);
    const dateStr = currentDate.toISOString().split('T')[0];
    
    // Simulate 2-5 transactions per day
    const numTxOfToday = Math.floor(Math.random() * 4) + 2;
    for (let t = 0; t < numTxOfToday; t++) {
      const isMpesa = Math.random() > 0.4;
      const paymentMethod = isMpesa ? "MPESA_PAGA_FACIL" : (Math.random() > 0.5 ? "CASH" : "POS_CARD");
      
      const rate = 1 + (Math.sin(i / 3) * 0.2); // seasonality sine wave
      const qty1 = Math.floor(Math.random() * 3) + 1;
      const qty2 = Math.floor(Math.random() * 2) + 1;
      
      // Items sold
      const subtotal = Math.round((85 * qty1 + 1200 * qty2) * rate);
      const vatTotal = Math.round(subtotal * 0.16);
      const discountTotal = Math.random() > 0.7 ? Math.round(subtotal * 0.05) : 0;
      const grandTotal = subtotal + vatTotal - discountTotal;
      
      transactions.push({
        id: `tx-${i}-${t}`,
        invoiceNumber: `FAC-2026-${String(30 - i).padStart(2, '0')}${String(t).padStart(2, '0')}`,
        timestamp: `${dateStr}T${String(10 + t*2).padStart(2, '0')}:${String(15 + Math.floor(Math.random()*40)).padStart(2, '0')}:00`,
        subtotal,
        vatTotal,
        discountTotal,
        grandTotal,
        paymentMethod,
        cashierName: t % 2 === 0 ? "Marta Ubisse" : "Délio Chiponde",
        customerName: t === 1 ? "Carlos Tembe" : (t === 2 ? "Anabela Maquela" : undefined),
        nuit: t === 1 ? "142533669" : (t === 2 ? "299104882" : undefined),
        items: [
          { productId: "p5", productName: "Cerveja 2M (Lata 330ml)", quantity: qty1, price: 75, vatAmount: Math.round(75*qty1*0.16), discountAmount: 0, subtotal: qty1*75 },
          { productId: "p1", productName: "Arroz Nacional de Chicualacuala (25kg)", quantity: qty2, price: 1200, vatAmount: Math.round(1200*qty2*0.16), discountAmount: 0, subtotal: qty2*1200 }
        ]
      });
    }
  }
  return transactions;
};

export const defaultSettings: SystemSettings = {
  companyName: "OST Comércio Geral, Limitada",
  companyAddress: "Av. Marginal, Kiosk Nº 14, Maputo, Moçambique",
  companyNuit: "400293112",
  vatDefaultRate: 16,
  currency: "MT",
  logoUrl: "",
  autoBackup: true,
  smsGateway: "http://api.sms-mozambique.co.mz/v1/send",
  smtpServer: "smtp.gmail.com",
  reportRecipientEmail: "levidomingos12@gmail.com",
  reportHour: "02:00",
  reportFrequency: "daily",
  slogan: "Controle Total do Seu Negócio em Uma Única Plataforma",
  storeAddress: "Av. Marginal, Kiosk Nº 14, Maputo, Moçambique",
  storeContact: "+258 84 900 1200",
  defaultVat: 16
};

export interface MasterclassVideo {
  id: string;
  title: string;
  duration: string;
  description: string;
  thumbnail: string;
  category: "vendas" | "caixa" | "stock" | "relatorios";
  steps: string[];
}

export const masterclassVideos: MasterclassVideo[] = [
  {
    id: "v1",
    title: "Módulo de Vendas (POS): Como Efetuar Operações Rápidas",
    duration: "4:20",
    description: "Aprenda a pesquisar produtos por nome, categoria ou código de barras, gerir o carrinho inteligente e registrar pagamentos normais ou mistos no POS.",
    thumbnail: "💻",
    category: "vendas",
    steps: [
      "Selecione um cliente cadastrado no topo para habilitar acúmulo de pontos de fidelidade.",
      "Clique num produto uma vez para adicioná-lo; clique novamente para incrementar a quantidade.",
      "Defina descontos céleres ou customize o IVA (Automático / Isento).",
      "Selecione o método de pagamento ideal (E-Mola, M-Pesa Paga Fácil ou misto) e emita o recibo."
    ]
  },
  {
    id: "v2",
    title: "Controle e Cuidados Operacionais no Fechamento de Caixa",
    duration: "3:45",
    description: "Este tutorial mostra como registrar as entradas, saídas de despesa miúda e quebras justificadas, além de conferir a diferença física para o fecho geral.",
    thumbnail: "💰",
    category: "caixa",
    steps: [
      "Insira todos os registros de quebras (vidros quebrados, diferenças de troco) com explicação clara.",
      "Insira retiradas para o cofre (sangrias) no item de Despesas/Saídas.",
      "Execute o 'Fecho de Caixa' comparando o saldo teórico calculado pelo sistema com a contagem física real.",
      "Submeta a assinatura digital de validação do supervisor para homologar o relatório."
    ]
  },
  {
    id: "v3",
    title: "Gestão Eficiente de Stock e Alertas de Proximidade de Vencimento",
    duration: "5:10",
    description: "Entenda o mecanismo de aviso de stock mínimo e organize alertas de vencimento para itens de mercearia.",
    thumbnail: "📦",
    category: "stock",
    steps: [
      "Cadastre o preço de custo e venda dos itens para que o sistema possa gerar dados reais de margem e lucros.",
      "Adicione as datas de validade para que apareçam relatórios automáticos no painel do administrador.",
      "Configure as notificações de stock baixo para receber alertas no dashboard geral do sistema.",
      "Utilize a ferramenta de Importação de Arquivos em Massa para subidas rápidas e transições de sistemas antigos."
    ]
  },
  {
    id: "v4",
    title: "Configurando Relatórios Automáticos do OST Vendas por Email",
    duration: "2:50",
    description: "Saiba como parametrizar os canais SMTP e agendar o envio direto de relatórios PDF com todas as vendas do dia para os gestores.",
    thumbnail: "📈",
    category: "relatorios",
    steps: [
      "Acesse o separador de 'Faturação & Relatórios'.",
      "Configure o email principal do destinatário administrador (ex: levidomingos12@gmail.com).",
      "Selecione a hora correspondente para o envio robotizado das estatísticas consolidadas.",
      "Clique em 'Testar Envio Automático' para forçar um despacho piloto imediato para o seu correio eletrónico."
    ]
  }
];
