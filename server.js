const express = require("express");
const cookieSession = require("cookie-session");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const UPLOAD_DIR = path.join(DATA_DIR, "uploads");
const DB_FILE = path.join(DATA_DIR, "db.json");
const PRINTING_ENABLED = false;
const PAYMENT_MODE = "simulation";

if (!process.env.ADMIN_PASSWORD || !process.env.SESSION_SECRET) {
  console.warn("ATENÇÃO: configure ADMIN_PASSWORD e SESSION_SECRET nas variáveis do ambiente.");
}
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const defaults = {
  settings: {
    prices: { "10x15": 200, "15x21": 400, "20x30": 800 },
    deliveryFee: 0,
    pickupEnabled: true,
    deliveryEnabled: true,
    storeName: "FotoOn",
    pixInstructions: "Pagamento demonstrativo. Não faça transferências para este pedido."
  },
  orders: []
};
function readDB() {
  try { return { ...defaults, ...JSON.parse(fs.readFileSync(DB_FILE, "utf8")) }; }
  catch { return structuredClone(defaults); }
}
let db = readDB();
function saveDB() {
  const temp = DB_FILE + ".tmp";
  fs.writeFileSync(temp, JSON.stringify(db, null, 2));
  fs.renameSync(temp, DB_FILE);
}
if (!fs.existsSync(DB_FILE)) saveDB();

app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({
  name: "fotoon.sid",
  keys: [process.env.SESSION_SECRET || "configure-uma-chave-segura-no-render"],
  httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000
}));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Muitas tentativas. Aguarde 15 minutos." } });
function requireAdmin(req, res, next) {
  if (req.session && req.session.admin === true) return next();
  return res.status(401).json({ error: "Acesso administrativo necessário." });
}
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase())
});
const upload = multer({
  storage,
  limits: { files: 100, fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype))
});

app.get("/api/health", (_req, res) => res.json({ ok: true, paymentMode: PAYMENT_MODE, printingEnabled: PRINTING_ENABLED }));
app.get("/api/public-settings", (_req, res) => res.json({
  prices: db.settings.prices, deliveryFee: db.settings.deliveryFee,
  pickupEnabled: db.settings.pickupEnabled, deliveryEnabled: db.settings.deliveryEnabled,
  storeName: db.settings.storeName
}));
app.post("/api/orders", upload.array("photos", 100), (req, res) => {
  try {
    const { customerName, phone, size, fulfillment, address, notes } = req.body;
    if (!customerName?.trim() || !phone?.trim()) return res.status(400).json({ error: "Informe nome e telefone." });
    if (!["10x15", "15x21", "20x30"].includes(size)) return res.status(400).json({ error: "Tamanho inválido." });
    if (!req.files?.length) return res.status(400).json({ error: "Adicione ao menos uma foto." });
    if (fulfillment === "delivery" && (!db.settings.deliveryEnabled || !address?.trim())) return res.status(400).json({ error: "Informe o endereço para entrega." });
    if (fulfillment === "pickup" && !db.settings.pickupEnabled) return res.status(400).json({ error: "Retirada indisponível." });
    if (!["pickup", "delivery"].includes(fulfillment)) return res.status(400).json({ error: "Escolha retirada ou entrega." });
    const quantity = req.files.length;
    const subtotalCents = Number(db.settings.prices[size]) * quantity;
    const deliveryCents = fulfillment === "delivery" ? Number(db.settings.deliveryFee || 0) : 0;
    const order = {
      id: crypto.randomUUID(), number: "FO-" + Date.now().toString().slice(-8),
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      customerName: customerName.trim(), phone: phone.trim(), size, quantity,
      fulfillment, address: fulfillment === "delivery" ? String(address).trim() : "",
      notes: String(notes || "").trim().slice(0, 1000),
      subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents,
      status: "aguardando_pagamento_simulado", paymentStatus: "pendente_simulacao",
      paymentMode: PAYMENT_MODE, printingEnabled: PRINTING_ENABLED,
      photos: req.files.map(f => ({ filename: f.filename, originalName: f.originalname, size: f.size, mimeType: f.mimetype }))
    };
    db.orders.unshift(order); saveDB();
    res.status(201).json({ order: publicOrder(order), message: "Pedido criado. Nenhum pagamento real foi realizado." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Não foi possível registrar o pedido." });
  }
});
function publicOrder(o) {
  const { photos, ...safe } = o;
  return { ...safe, photoCount: photos.length, photos: photos.map(p => ({ name: p.originalName, url: "/uploads/" + encodeURIComponent(p.filename) })) };
}
app.post("/api/orders/:id/simulate-payment", requireAdmin, (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  if (order.paymentStatus !== "pendente_simulacao") return res.status(409).json({ error: "A simulação já foi realizada." });
  order.paymentStatus = "aprovado_simulado";
  order.status = "pago_simulado";
  order.updatedAt = new Date().toISOString();
  saveDB();
  res.json({ order: publicOrder(order), message: "Pagamento apenas simulado. Nenhuma cobrança foi feita." });
});
app.post("/api/admin/login", loginLimiter, (req, res) => {
  const supplied = Buffer.from(String(req.body.password || ""));
  const expected = Buffer.from(String(process.env.ADMIN_PASSWORD || ""));
  if (!expected.length || supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.status(401).json({ error: "Senha incorreta." });
  }
  req.session = { admin: true };
  res.json({ ok: true });
});
app.get("/api/admin/me", requireAdmin, (_req, res) => res.json({ authenticated: true }));
app.post("/api/admin/logout", requireAdmin, (req, res) => { req.session = null; res.json({ ok: true }); });
app.get("/api/admin/orders", requireAdmin, (_req, res) => res.json({ orders: db.orders.map(publicOrder) }));
app.get("/api/admin/settings", requireAdmin, (_req, res) => res.json({ settings: db.settings }));
app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const s = req.body || {};
  const prices = {};
  for (const size of ["10x15", "15x21", "20x30"]) {
    const value = Number(s.prices?.[size]);
    if (!Number.isFinite(value) || value < 0 || value > 1000000) return res.status(400).json({ error: "Confira os preços informados." });
    prices[size] = Math.round(value);
  }
  const fee = Number(s.deliveryFee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 1000000) return res.status(400).json({ error: "Taxa de entrega inválida." });
  db.settings = { ...db.settings, prices, deliveryFee: Math.round(fee),
    pickupEnabled: Boolean(s.pickupEnabled), deliveryEnabled: Boolean(s.deliveryEnabled),
    storeName: String(s.storeName || "FotoOn").slice(0, 80),
    pixInstructions: String(s.pixInstructions || "").slice(0, 500) };
  saveDB(); res.json({ settings: db.settings });
});
app.patch("/api/admin/orders/:id", requireAdmin, (req, res) => {
  const order = db.orders.find(o => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "Pedido não encontrado." });
  const allowed = ["recebido", "em_preparacao", "pronto_para_retirada", "saiu_para_entrega", "concluido", "cancelado"];
  if (!allowed.includes(req.body.status)) return res.status(400).json({ error: "Status inválido." });
  order.status = req.body.status; order.updatedAt = new Date().toISOString(); saveDB();
  res.json({ order: publicOrder(order) });
});
app.get("/admin", (_req, res) => res.sendFile(path.join(__dirname, "admin.html")));
app.use("/uploads", requireAdmin, express.static(UPLOAD_DIR, { fallthrough: false }));
app.use(express.static(__dirname, { index: "index.html" }));
app.listen(PORT, () => console.log("FotoOn iniciado na porta " + PORT));
