import mongoose from 'mongoose';

export async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('[Nexus Cloud] MongoDB conectado!');
}

// Schema de cliente (quem usa o sistema)
const clientSchema = new mongoose.Schema({
    api_key:    { type: String, unique: true, required: true },
    label:      { type: String, required: true },   // ex: "Loja do Joao"
    created_at: { type: Date, default: Date.now }
});

// Schema de token MP
const tokenSchema = new mongoose.Schema({
    api_key:      { type: String, required: true },  // dono do token
    guild_id:     { type: String, required: true },  // servidor onde foi cadastrado
    label:        { type: String, required: true },  // nome amigavel
    access_token: { type: String, required: true },
    created_at:   { type: Date, default: Date.now }
});

tokenSchema.index({ api_key: 1, guild_id: 1, label: 1 }, { unique: true });

export const Client = mongoose.model('Client', clientSchema);
export const Token  = mongoose.model('Token',  tokenSchema);
