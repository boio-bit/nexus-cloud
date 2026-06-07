import 'dotenv/config';
import express from 'express';
import { randomBytes } from 'crypto';
import { connectDB, Client, Token } from './db.js';

const app  = express();
const PORT = process.env.PORT || 3000;
const MASTER_KEY = process.env.MASTER_KEY;

app.use(express.json());

await connectDB();

// ── Middleware de autenticacao ─────────────────────────────────────────────
async function authClient(req, res, next) {
    const key = req.headers['x-api-key'];
    if (!key) return res.status(401).json({ error: 'x-api-key ausente' });
    const client = await Client.findOne({ api_key: key });
    if (!client) return res.status(403).json({ error: 'API key invalida' });
    req.clientKey = key;
    req.clientLabel = client.label;
    next();
}

function authMaster(req, res, next) {
    if (req.headers['x-master-key'] !== MASTER_KEY)
        return res.status(403).json({ error: 'Master key invalida' });
    next();
}

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS MASTER — so voce usa (criar/listar clientes)
// ══════════════════════════════════════════════════════════════════════════════

// Criar cliente (gera API key unica)
app.post('/admin/clients', authMaster, async (req, res) => {
    const { label } = req.body;
    if (!label) return res.status(400).json({ error: 'Campo label obrigatorio' });
    const api_key = randomBytes(24).toString('hex');
    const client = await Client.create({ api_key, label });
    res.json({ ok: true, label: client.label, api_key });
});

// Listar clientes
app.get('/admin/clients', authMaster, async (req, res) => {
    const list = await Client.find({}, '-__v');
    res.json(list);
});

// Revogar cliente
app.delete('/admin/clients/:api_key', authMaster, async (req, res) => {
    await Client.deleteOne({ api_key: req.params.api_key });
    await Token.deleteMany({ api_key: req.params.api_key });
    res.json({ ok: true });
});

// ══════════════════════════════════════════════════════════════════════════════
// ROTAS CLIENTE — cada dono de bot usa com sua api_key
// ══════════════════════════════════════════════════════════════════════════════

// Listar tokens (sem expor o access_token)
app.get('/tokens', authClient, async (req, res) => {
    const { guild_id } = req.query;
    const filter = { api_key: req.clientKey };
    if (guild_id) filter.guild_id = guild_id;
    const list = await Token.find(filter, '-access_token -__v');
    res.json(list);
});

// Cadastrar token
app.post('/tokens', authClient, async (req, res) => {
    const { guild_id, label, access_token } = req.body;
    if (!guild_id || !label || !access_token)
        return res.status(400).json({ error: 'Campos obrigatorios: guild_id, label, access_token' });
    try {
        const t = await Token.create({ api_key: req.clientKey, guild_id, label, access_token });
        res.json({ ok: true, id: t._id });
    } catch(e) {
        if (e.code === 11000) return res.status(409).json({ error: 'Label ja existe nessa guild.' });
        throw e;
    }
});

// Obter token completo (para vincular — expoe o access_token)
app.get('/tokens/:id', authClient, async (req, res) => {
    const t = await Token.findOne({ _id: req.params.id, api_key: req.clientKey });
    if (!t) return res.status(404).json({ error: 'Token nao encontrado.' });
    res.json(t);
});

// Remover token
app.delete('/tokens/:id', authClient, async (req, res) => {
    const r = await Token.deleteOne({ _id: req.params.id, api_key: req.clientKey });
    res.json({ ok: true, removed: r.deletedCount });
});

app.listen(PORT, () => console.log('[Nexus Cloud] Rodando na porta ' + PORT));
