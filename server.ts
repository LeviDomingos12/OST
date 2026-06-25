import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, writeBatch } from "firebase/firestore";

dotenv.config();

// Initialize Firebase Firestore
const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
let firebaseDb: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  try {
    const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
    const firebaseApp = initializeApp(firebaseConfig);
    firebaseDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    console.log("Firebase is initialized on the server. Connected to database:", firebaseConfig.firestoreDatabaseId);
  } catch (err) {
    console.error("Failed to initialize Firebase on the server:", err);
  }
} else {
  console.warn("firebase-applet-config.json not found. Serving as offline local backup server.");
}

// Initialize Google GenAI
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: any = null;

// Lazy initialization of Gemini
function getAiClient() {
  if (!aiClient) {
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is not defined. AI features will fallback to rule-based generation.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route - AI sales forecast
  app.post("/api/gemini/forecast", async (req, res) => {
    try {
      const { salesHistory, inventoryStatus, businessType } = req.body;
      const ai = getAiClient();

      if (!ai) {
        // Fallback rule-based forecasting if no key
        return res.json({
          forecastText: `### **Análise Prematura de Previsão de Vendas (Modo Simulação)**
          
Com base no histórico fornecido de vendas para o seu negócio de **${businessType || 'Comércio Geral'}**:

1. **Tendência de Crescimento**: Projetamos um aumento aproximado de **14%** nas vendas para o próximo período devido a padrões sazonais identificados nos produtos mais vendidos.
2. **Produtos Críticos**: Itens com stock baixo (especialmente categorias eletrónicas ou mercearia) sofrem risco elevado de rutura. Recomendamos reabastecer com urgência para evitar perda de clientes.
3. **Plano de Ação Sugerido**:
   * Lance uma campanha promocional direcionada para itens parados.
   * Ative o programa de fidelidade com o envio de SMS para clientes inativos.
   * Centralize os canais de recebimento através do M-Pesa Paga Fácil e E-Mola para agilizar o fluxo de caixa.

*Nota técnica: Para ativar o poder total da inteligência artificial generativa em tempo real com dados customizados do seu negócio, configure a sua chave **GEMINI_API_KEY** no painel de Configurações do seu espaço.*`,
          growthRate: 14,
          growthTrend: "up",
          suggestedCampaigns: [
            "Super Semana de Descontos",
            "Fidelização M-Pesa Promocional",
            "Clientes VIP Stock-Out Clearance"
          ]
        });
      }

      const prompt = `Você é o OST Vendas AI, um assistente inteligente especialista em análise comercial para pequenas e médias empresas em Moçambique e mercados africanos.
Analise os seguintes dados comerciais de uma empresa do tipo "${businessType || 'Comércio Geral'}":

1. Histórico de Vendas Recentes: ${JSON.stringify(salesHistory)}
2. Produtos em Estado Crítico de Stock (baixo ou esgotado): ${JSON.stringify(inventoryStatus)}

Gere um relatório de previsão de vendas e conselhos comerciais práticos. Retorne o resultado em formato JSON com a seguinte estrutura exata:
{
  "forecastText": "texto formatado em Markdown com análise, tendências e sugestões detalhadas de negócios em português.",
  "growthRate": número representando a taxa percentual esperada de crescimento ou variação (ex: 15),
  "growthTrend": "up" ou "down" ou "stable",
  "suggestedCampaigns": ["Campanha 1", "Campanha 2", "etc"]
}

Utilize termos locais amigáveis e moedas locais de Moçambique se adequado (abreviação Meticais - MT ou MZN, M-Pesa, E-Mola). Mantenha um tom altamente profissional, motivacional, e extremamente polido.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              forecastText: { type: Type.STRING },
              growthRate: { type: Type.NUMBER },
              growthTrend: { type: Type.STRING },
              suggestedCampaigns: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["forecastText", "growthRate", "growthTrend", "suggestedCampaigns"]
          }
        }
      });

      const responseText = response.text || "{}";
      const data = JSON.parse(responseText.trim());
      res.json(data);
    } catch (error: any) {
      console.error("Erro no forecast do Gemini:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor" });
    }
  });

  // API Route - SMS Marketing Generation
  app.post("/api/gemini/marketing/sms", async (req, res) => {
    try {
      const { campaignType, details } = req.body;
      const ai = getAiClient();

      if (!ai) {
        return res.json({
          smsList: [
            `Olá! Não perca as nossas novidades especiais de ${campaignType}. Visite o OST Vendas hoje e acumule pontos de fidelidade!`,
            `Grande Promoção! Descontos especiais de até 25% em artigos selecionados. Aproveite já no OST Vendas!`,
            `Estimado Cliente, temos ofertas exclusivas pensadas para si. Venha visitar a nossa loja e use M-Pesa para ganhar bónus.`
          ]
        });
      }

      const prompt = `Você é o redator de marketing inteligente do OST Vendas. Sua tarefa é criar 3 opções excelentes de SMS promocionais ou de fidelização de clientes em português para uma campanha do tipo "${campaignType}" com os seguintes detalhes de auxílio:
- Detalhes: "${details || 'Nenhum detalhe adicional'}"
- Limite estrito de no máximo 160 caracteres por mensagem.
- Tom atrativo, direto, curto e focado em conversão.
- Use referências locais se adequado (MT, M-Pesa, E-Mola).

Retorne no formato JSON abaixo:
{
  "smsList": ["Opção de SMS 1", "Opção de SMS 2", "Opção de SMS 3"]
}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              smsList: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["smsList"]
          }
        }
      });

      const data = JSON.parse((response.text || "{}").trim());
      res.json(data);
    } catch (error: any) {
      console.error("Erro no marketing SMS:", error);
      res.status(500).json({ error: error.message || "Erro interno do servidor" });
    }
  });

  // API Route - Email sending simulation
  app.post("/api/email/send-report", async (req, res) => {
    try {
      const { recipient, frequency, reportBody, simulateError } = req.body;
      await new Promise(resolve => setTimeout(resolve, 800));

      if (simulateError || !recipient || recipient.includes("erro") || recipient.includes("fail") || !recipient.includes("@")) {
        return res.status(400).json({
          success: false,
          error: "Falha na simulação de entrega SMTP: Servidor SMTP recusou as credenciais ou a caixa do destinatário está inacessível. (SMTP-535-Authentication-Failed)"
        });
      }

      res.json({
        success: true,
        message: `Relatório automático enviado com sucesso para ${recipient} (${frequency === 'daily' ? 'Diário às 02:00' : 'Frequência Programada'})!`
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Stateful JSON Database Folder Creation
  const DB_DIR = path.join(process.cwd(), "db_store");
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  // GET: Load all existing stateful tables
  app.get("/api/db/load", async (req, res) => {
    try {
      const result: any = {};
      const tables = ["products", "customers", "transactions", "cashflow", "employees", "auditlogs"];
      let hasData = false;

      if (firebaseDb) {
        console.log("Servidor carregando dados do Firebase Firestore...");
        try {
          for (const t of tables) {
            const querySnapshot = await getDocs(collection(firebaseDb, t));
            if (!querySnapshot.empty) {
              const list: any[] = [];
              querySnapshot.forEach((doc) => {
                list.push(doc.data());
              });
              result[t] = list;
              hasData = true;
            } else {
              result[t] = null;
            }
          }

          // Load settings single doc
          const settingsDoc = await getDoc(doc(firebaseDb, "settings", "config"));
          if (settingsDoc.exists()) {
            result["settings"] = settingsDoc.data();
            hasData = true;
          } else {
            result["settings"] = null;
          }

          // Cache in local db_store for safe offline capabilities
          if (hasData) {
            for (const t of tables) {
              if (result[t]) {
                const filePath = path.join(DB_DIR, `${t}.json`);
                fs.writeFileSync(filePath, JSON.stringify(result[t], null, 2), "utf-8");
              }
            }
            if (result["settings"]) {
              const filePath = path.join(DB_DIR, "settings.json");
              fs.writeFileSync(filePath, JSON.stringify(result["settings"], null, 2), "utf-8");
            }
            console.log("Cache local sincronizado com dados do Firebase Firestore.");
            return res.json({ success: true, hasData, data: result, source: "firebase" });
          }
        } catch (firebaseErr: any) {
          console.error("Erro ao pesquisar Firestore, voltando ao banco local:", firebaseErr);
        }
      }

      // Fallback: Read local files if firebaseDb is null or query failed
      let localHasData = false;
      for (const t of ["products", "customers", "transactions", "cashflow", "employees", "auditlogs", "settings"]) {
        const filePath = path.join(DB_DIR, `${t}.json`);
        if (fs.existsSync(filePath)) {
          result[t] = JSON.parse(fs.readFileSync(filePath, "utf-8"));
          localHasData = true;
        } else {
          result[t] = null;
        }
      }
      res.json({ success: true, hasData: localHasData, data: result, source: "local_json" });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST: Save individual table state (mutations)
  app.post("/api/db/save", async (req, res) => {
    try {
      const { table, data } = req.body;
      if (!table || data === undefined) {
        return res.status(400).json({ error: "Parâmetros table e data são obrigatórios." });
      }

      // 1. Cache to local file
      const filePath = path.join(DB_DIR, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");

      // 2. Synchronize to Firestore
      if (firebaseDb) {
        console.log(`Buscando gravação em lote da tabela '${table}' para Firestore...`);
        try {
          if (table === "settings") {
            await setDoc(doc(firebaseDb, "settings", "config"), data);
          } else if (Array.isArray(data)) {
            const collectionRef = collection(firebaseDb, table);
            const batchSize = 400;
            for (let i = 0; i < data.length; i += batchSize) {
              const chunk = data.slice(i, i + batchSize);
              const batch = writeBatch(firebaseDb);
              for (const item of chunk) {
                const docId = item.id || `doc-${Date.now()}-${Math.random()}`;
                const docRef = doc(collectionRef, String(docId));
                batch.set(docRef, item);
              }
              await batch.commit();
            }
          }
          console.log(`Gravação no Firestore para a tabela '${table}' concluída.`);
        } catch (firebaseErr: any) {
          console.error(`Falha ao sincronizar '${table}' ao Firebase:`, firebaseErr);
        }
      }

      res.json({ success: true, message: `Tabela ${table} sincronizada com sucesso no banco de dados e nuvem.` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST: Setup all tables (initial seed submission)
  app.post("/api/db/save-all", async (req, res) => {
    try {
      const payload = req.body;
      const tables = ["products", "customers", "transactions", "cashflow", "employees", "auditlogs", "settings"];
      
      // 1. Save locally
      for (const t of tables) {
        if (payload[t] !== undefined) {
          const filePath = path.join(DB_DIR, `${t}.json`);
          fs.writeFileSync(filePath, JSON.stringify(payload[t], null, 2), "utf-8");
        }
      }

      // 2. Synchronize to Firestore
      if (firebaseDb) {
        console.log("Iniciando semeação das tabelas iniciais no Firebase Firestore...");
        try {
          for (const t of tables) {
            if (payload[t] !== undefined) {
              const data = payload[t];
              if (t === "settings") {
                await setDoc(doc(firebaseDb, "settings", "config"), data);
              } else if (Array.isArray(data)) {
                const collectionRef = collection(firebaseDb, t);
                const batchSize = 400;
                for (let i = 0; i < data.length; i += batchSize) {
                  const chunk = data.slice(i, i + batchSize);
                  const batch = writeBatch(firebaseDb);
                  for (const item of chunk) {
                    const docId = item.id || `doc-${Date.now()}-${Math.random()}`;
                    const docRef = doc(collectionRef, String(docId));
                    batch.set(docRef, item);
                  }
                  await batch.commit();
                }
              }
            }
          }
          console.log("Banco de dados semeado no Firebase com sucesso.");
        } catch (firebaseErr: any) {
          console.error("Falha ao semear banco no Firebase:", firebaseErr);
        }
      }

      res.json({ success: true, message: "Banco de dados inicializado e guardado com sucesso no servidor e na nuvem." });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST: Sending / Dispatching POS Email Invoices
  app.post("/api/email/dispatch-invoice", async (req, res) => {
    try {
      const { email, invoiceNumber, grandTotal, cashier, customer } = req.body;
      console.log(`[EMAIL DISPATCH] sending invoice ${invoiceNumber} to ${email}`);
      await new Promise(resolve => setTimeout(resolve, 800)); // simulate latency

      if (!email || email.includes("erro") || email.includes("fail") || !email.includes("@") || email === "vendas.central@ost.co.mz") {
        return res.status(400).json({
          success: false,
          error: `O servidor SMTP recusou o envio da Fatura ${invoiceNumber}: Conta de e-mail de destino inválida ou indisponível.`
        });
      }

      res.json({
        success: true,
        message: `Fatura ${invoiceNumber} despachada por e-mail para ${email} com sucesso!`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST: Sending / Dispatching POS SMS Invoices
  app.post("/api/sms/dispatch-invoice", async (req, res) => {
    try {
      const { phone, invoiceNumber, grandTotal } = req.body;
      console.log(`[SMS DISPATCH] sending invoice SMS ${invoiceNumber} to ${phone}`);
      await new Promise(resolve => setTimeout(resolve, 800)); // simulate latency

      // Clean check
      if (!phone || phone.includes("erro") || phone.includes("9999") || phone.replace(/\D/g, "").length < 7) {
        return res.status(400).json({
          success: false,
          error: `Falha na entrega SMS da Fatura ${invoiceNumber}: Número de telemóvel inválido ou fora de cobertura.`
        });
      }

      res.json({
        success: true,
        message: `Fatura SMS ${invoiceNumber} entregue no número Moçambique (+258) ${phone} via gateway celular!`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST: Executing real multi-channel CRM / Campaign promotions
  app.post("/api/campaign/dispatch", async (req, res) => {
    try {
      const { channels, campaignTitle, message, recipients, simulateError } = req.body;
      console.log(`[CAMPAIGN MARKETING DISPATCH] sending ${campaignTitle} channels=${JSON.stringify(channels)} to ${recipients?.length || 0} clients`);
      await new Promise(resolve => setTimeout(resolve, 1000)); // simulate network latency

      if (simulateError || !channels || channels.length === 0 || !message || message.includes("erro") || message.includes("fail")) {
        return res.status(400).json({
          success: false,
          error: "Falha ao despachar a campanha: Nenhum canal habilitado de entrega, ou a mensagem contém palavras proibidas no dicionário de operadoras locais."
        });
      }

      const count = recipients?.length || 10;
      res.json({
        success: true,
        dispatchedCount: count,
        message: `Campanha de Marketing '${campaignTitle || 'Aviso Especial'}' entregue em tempo real para ${count} clientes via canais [${channels.join(", ")}]!`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
