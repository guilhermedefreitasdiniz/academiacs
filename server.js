const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

app.post('/api/login', async (req, res) => {
    const { email, password, pin } = req.body;

    try {
        let usuarioTmd = null;

        if (pin && pin.trim() !== '') {
            console.log(`\n--- TENTATIVA DE LOGIN ---`);
            console.log(`🔎 Buscando PIN: "${pin}"`);

            const usuarios = await prisma.$queryRaw`SELECT * FROM tmd.usuario WHERE UPPER(pin) = UPPER(${pin}) LIMIT 1`;
            
            if (usuarios && usuarios.length > 0) {
                usuarioTmd = usuarios[0];
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

            const usuarios = await prisma.$queryRaw`SELECT * FROM tmd.usuario WHERE email = ${email} AND senha = ${hashDaSenhaDigitada} LIMIT 1`;
            
            if (usuarios && usuarios.length > 0) {
                usuarioTmd = usuarios[0];
            }
        } 
        else {
            return res.status(400).json({ success: false, error: 'Preencha os dados.' });
        }

        if (!usuarioTmd) {
            console.log(`❌ Falha: Credencial não existe no banco de dados.`);
            return res.status(401).json({ success: false, error: 'Credenciais inválidas na plataforma.' });
        }

        if (!usuarioTmd.ativo) {
            console.log(`❌ Falha: Conta desativada.`);
            return res.status(403).json({ success: false, error: 'Conta desativada.' });
        }

        let nomeEmpresa = "Meu Cliente";
        if (usuarioTmd.cliente_id) {
            try {
                const cliente = await prisma.$queryRaw`SELECT * FROM tmd.cliente WHERE cliente_id = ${usuarioTmd.cliente_id} LIMIT 1`;
                if (cliente && cliente.length > 0) {
                    nomeEmpresa = cliente[0].nome || cliente[0].razao_social || cliente[0].nome_fantasia || "Meu Cliente";
                }
            } catch (err) {
                console.error("Aviso: Falha ao buscar nome da empresa.");
            }
        }

        // 🎯 PERFIL ÚNICO PARA TODOS NA ACADEMIA
        let userRole = 'membro_cs'; 

        console.log(`✅ SUCESSO TOTAL! Acesso liberado para: ${usuarioTmd.nome}`);

        return res.json({
            success: true,
            user: {
                id: usuarioTmd.usuario_id,
                name: usuarioTmd.nome,
                email: usuarioTmd.email,
                initials: usuarioTmd.nome.substring(0, 2).toUpperCase(),
                retailer: nomeEmpresa,
                role: userRole
            }
        });

    } catch (error) {
        console.error("🔥 Erro catastrófico:", error);
        return res.status(500).json({ success: false, error: 'Erro interno no servidor.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Academia Backend rodando em http://localhost:${PORT}`);
});