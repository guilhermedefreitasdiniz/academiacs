const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Conexão direta via PostgreSQL Pool (compatível com AWS e Vercel Serverless)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }
});

app.post('/api/login', async (req, res) => {
    const { email, password, pin } = req.body;

    try {
        let usuarioTmd = null;

        if (pin && pin.trim() !== '') {
            const pinFormatted = pin.trim().toUpperCase();
            console.log(`\n--- TENTATIVA DE LOGIN ---`);
            console.log(`🔎 Buscando PIN: "${pinFormatted}"`);

            const result = await pool.query(
                'SELECT * FROM tmd.usuario WHERE UPPER(pin) = UPPER($1) LIMIT 1',
                [pinFormatted]
            );
            
            if (result.rows && result.rows.length > 0) {
                usuarioTmd = result.rows[0];
            }
        } 
        else if (email && password) {
            console.log(`\n--- TENTATIVA DE LOGIN ---`);
            console.log(`🔎 Buscando E-mail: "${email}"`);

            const hashDaSenhaDigitada = crypto
                .createHash('sha1')
                .update(password)
                .digest('hex')
                .toUpperCase();

            const result = await pool.query(
                'SELECT * FROM tmd.usuario WHERE email = $1 AND senha = $2 LIMIT 1',
                [email, hashDaSenhaDigitada]
            );
            
            if (result.rows && result.rows.length > 0) {
                usuarioTmd = result.rows[0];
            }
        } 
        else {
            return res.status(400).json({ success: false, error: 'Preencha os dados de login.' });
        }

        if (!usuarioTmd) {
            console.log(`❌ Falha: Credencial não encontrada.`);
            return res.status(401).json({ success: false, error: 'Credenciais inválidas na plataforma.' });
        }

        if (!usuarioTmd.ativo) {
            console.log(`❌ Falha: Conta desativada.`);
            return res.status(403).json({ success: false, error: 'Conta desativada.' });
        }

        let nomeEmpresa = "Meu Cliente";
        if (usuarioTmd.cliente_id) {
            try {
                const resultCliente = await pool.query(
                    'SELECT * FROM tmd.cliente WHERE cliente_id = $1 LIMIT 1',
                    [usuarioTmd.cliente_id]
                );
                if (resultCliente.rows && resultCliente.rows.length > 0) {
                    const c = resultCliente.rows[0];
                    nomeEmpresa = c.nome || c.razao_social || c.nome_fantasia || "Meu Cliente";
                }
            } catch (err) {
                console.error("Aviso: Falha ao buscar nome da empresa.");
            }
        }

        console.log(`✅ SUCESSO TOTAL! Liberando acesso para: ${usuarioTmd.nome}`);

        return res.json({
            success: true,
            user: {
                id: usuarioTmd.usuario_id,
                name: usuarioTmd.nome,
                email: usuarioTmd.email,
                initials: usuarioTmd.nome ? usuarioTmd.nome.substring(0, 2).toUpperCase() : 'CS',
                retailer: nomeEmpresa,
                role: 'membro_cs'
            }
        });

    } catch (error) {
        console.error("🔥 Erro na rota de login:", error);
        return res.status(500).json({ success: false, error: 'Erro de conexão no banco de dados.' });
    }
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Academia Backend rodando em http://localhost:${PORT}`);
  });
}

module.exports = app;