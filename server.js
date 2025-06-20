const express = require('express');
const fetch = require('node-fetch'); // Certifique-se de que node-fetch está instalado: npm install node-fetch@2
const app = express();
const cors = require('cors');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');

// Para usar variáveis de ambiente (recomendado para JWT_SECRET em produção)
// require('dotenv').config(); 

require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET; 
// ...
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

// --- 1. CONFIGURAÇÕES DE MIDDLEWARE GERAIS (DEVEM VIR NO INÍCIO) ---
// Configuração do CORS (se você estiver acessando de domínios diferentes, o que não parece ser o caso para localhost)
// Se o frontend e backend rodam no mesmo domínio/porta, cors() pode não ser estritamente necessário.
app.use(cors({
    origin: 'http://localhost:3000', // Ou o domínio do seu frontend
    credentials: true // Permite que cookies sejam enviados com as requisições
}));
app.use(bodyParser.json());
app.use(cookieParser());

// --- 2. CONFIGURAÇÃO DO TEMPLATE ENGINE (EJS) ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// --- 3. FUNÇÕES AUXILIARES E MIDDLEWARE DE AUTENTICAÇÃO ---
function dataBRparaISO(dataBR) {
    if (!dataBR) return null;
    const partes = dataBR.split('/');
    if (partes.length !== 3) return null;
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

function authenticateToken(req, res, next) {
    // console.log('--- Requisição para rota protegida ---'); // Remova ou comente após depurar
    // console.log('URL da requisição:', req.originalUrl); // Remova ou comente após depurar

    const token = req.cookies.jwtToken; // Apenas verificamos o cookie

    // console.log('Token via Cookie (jwtToken):', token ? 'Presente' : 'Ausente'); // Remova ou comente após depurar
    // console.log('Requisição aceita HTML:', req.accepts('html') ? 'Sim' : 'Não'); // Remova ou comente após depurar

    if (token == null) {
        // console.log('ERRO: Token ausente nos cookies para acesso HTML/API. Redirecionando para login.'); // Remova ou comente após depurar
        if (req.accepts('html')) { // Se a requisição é para uma página HTML
            return res.redirect('/?session_expired=true'); // Redireciona para o login com uma flag de sessão expirada
        }
        // Se a requisição é uma API (AJAX), responde com erro JSON
        return res.status(401).json({ message: 'Token de autenticação não fornecido ou sessão expirada.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            // console.log('ERRO: Falha na verificação do token JWT.', err.message); // Remova ou comente após depurar
            if (req.accepts('html')) {
                // Redireciona com flag de sessão expirada se a página solicitar HTML
                return res.redirect('/?session_expired=true');
            }
            // Para APIs, responde com 403
            return res.status(403).json({ message: 'Token inválido ou expirado.' });
        }
        req.user = user; // Anexa os dados do usuário ao objeto de requisição
        // console.log('SUCESSO: Token JWT verificado para usuário:', user.username || user.email); // Remova ou comente após depurar
        next(); // Continua para a próxima função middleware ou rota
    });
}

function checkRole(allowedRolesOrModules) {
    return (req, res, next) => {
        // req.user é preenchido pelo authenticateToken
        if (!req.user) {
            // Isso não deve acontecer se authenticateToken rodou, mas é uma segurança
            return res.status(401).json({ message: 'Autenticação necessária.' });
        }

        const userIsAdmin = req.user.is_admin;
        const userModules = req.user.modulos || []; // Garante que seja um array

        // Se o usuário é um administrador, ele tem acesso irrestrito.
        if (userIsAdmin) {
            return next();
        }

        // Verifica se o usuário tem algum dos módulos necessários
        const hasRequiredModule = allowedRolesOrModules.some(roleOrModule => {
            // Se a permissão for 'admin' e o usuário não for admin (já verificado acima), ignore.
            if (roleOrModule === 'admin') return false; 
            // Verifica se o módulo específico está na lista de módulos do usuário
            return userModules.includes(roleOrModule);
        });

        if (hasRequiredModule) {
            return next(); // O usuário tem o módulo necessário
        }

        // Se nenhuma das condições for atendida, nega acesso
        console.warn(`Acesso negado para o usuário ${req.user.email} (isAdmin: ${userIsAdmin}, Módulos: ${userModules.join(',')}) tentando acessar rota com permissões: ${allowedRolesOrModules.join(', ')}`);
        
        if (req.accepts('html')) {
            // Se a requisição é para uma página HTML, renderiza uma página de acesso negado
            // Você precisará criar um arquivo views/access-denied.ejs
            return res.status(403).render('access-denied', { 
                userName: req.user.username || 'Usuário',
                isAdmin: req.user.is_admin,
                userModules: req.user.modulos 
            });
        }
        // Para requisições de API (AJAX), responde com erro JSON
        return res.status(403).json({ message: 'Acesso negado: Você não tem permissão para realizar esta ação.' });
    };
}

// --- 4. ROTAS PARA SERVIR PÁGINAS HTML (EJS VIEWS - GERALMENTE GET) ---
app.get('/', (req, res) => {
    res.render('index', { sessionExpired: req.query.session_expired === 'true' });
});

app.get('/register', (req, res) => {
    res.render('register');
});

app.get('/dashboard', authenticateToken, (req, res) => {
    const userName = req.user.username || 'Usuário';
    const isAdmin = req.user.is_admin;
    const userModules = req.user.modulos;

    res.render('main', {
        userName: userName,
        isAdmin: isAdmin,
        userModules: userModules
    });
});

app.get('/consulta-cnpj', authenticateToken, (req, res) => {
    const userName = req.user.username || 'Usuário';
    const isAdmin = req.user.is_admin;
    const userModules = req.user.modulos;

    res.render('consulta-cnpj', {
        userName: userName,
        isAdmin: isAdmin,
        userModules: userModules
    });
});

app.get('/admin/user-management', authenticateToken, checkRole(['admin', 'gerenciamento_usuarios']), (req, res) => {
    const userName = req.user.username || 'Usuário';
    const isAdmin = req.user.is_admin;
    const userModules = req.user.modulos;

    res.render('admin/user-management', {
        userName: userName,
        isAdmin: isAdmin,
        userModules: userModules,
        currentPage: 'user-management' // Útil para destacar o menu ou outras lógicas
    });
});

// --- FIM DAS ROTAS DE PÁGINAS EJS ---


// --- 5. ROTAS DE API (POST, GET, PUT, DELETE) ---

// Rota de Login (POST)
app.post('/login', async (req, res) => {
    // console.log('Conteúdo de req.body:', req.body); // Remova ou comente após depurar
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Nome de usuário/e-mail e senha são obrigatórios.' });
    }

    try {
        let user = null;

        // Tenta buscar por email
        let [rowsByEmail] = await db.execute('SELECT id, nome, email, senha AS password_hash, is_admin FROM usuarios WHERE email = ?', [email]);
        if (rowsByEmail.length > 0) {
            user = rowsByEmail[0];
            // console.log('Usuário encontrado por email.'); // Remova ou comente após depurar
        } else {
            // Se não encontrou por email, tenta buscar por nome (username)
            let [rowsByUsername] = await db.execute('SELECT id, nome, email, senha AS password_hash, is_admin FROM usuarios WHERE nome = ?', [email]);
            if (rowsByUsername.length > 0) {
                user = rowsByUsername[0];
                // console.log('Usuário encontrado por nome (username).'); // Remova ou comente após depurar
            }
        }

        if (!user) {
            // console.log('Usuário NÃO encontrado por email ou nome:', email); // Remova ou comente após depurar
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        // console.log('Comparando senha...'); // Remova ou comente após depurar
        const isMatch = await bcrypt.compare(password, user.password_hash);
        // console.log('Senha corresponde:', isMatch); // Remova ou comente após depurar

        if (!isMatch) {
            // console.log('Senha incorreta para usuário:', user.nome || user.email); // Remova ou comente após depurar
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }

        const [permissoesRows] = await db.execute(
            `SELECT m.nome_modulo
            FROM permissoes p
            JOIN modulos m ON p.modulo_id = m.id
            WHERE p.usuario_id = ? AND p.pode_acessar = TRUE`,
            [user.id]
        );
        const modulosPermitidos = permissoesRows.map(row => row.nome_modulo);

        const token = jwt.sign(
            {
                userId: user.id,
                username: user.nome,
                email: user.email,
                is_admin: user.is_admin,
                modulos: modulosPermitidos
            },
            JWT_SECRET,
            { expiresIn: '1h' } // 1 hora de validade para o token
        );

        // Define o cookie JWT
        res.cookie('jwtToken', token, {
            httpOnly: true, // O cookie só pode ser acessado pelo servidor, não pelo JavaScript do navegador (SEGURANÇA!)
            secure: process.env.NODE_ENV === 'production', // Apenas envia o cookie sobre HTTPS em produção
            maxAge: 3600000, // 1 hora em milissegundos
            sameSite: 'Lax' // Proteção CSRF
        });

        const userDataForFrontend = {
            id: user.id,
            name: user.nome,
            email: user.email,
            isAdmin: user.is_admin,
            modulos: modulosPermitidos
        };

        // console.log('Login bem-sucedido. Enviando resposta...'); // Remova ou comente após depurar
        res.json({
            message: 'Login bem-sucedido!',
            user: userDataForFrontend,
            redirectTo: '/dashboard'
        });

    } catch (error) {
        console.error('Erro detalhado no login:', error);
        res.status(500).json({ message: 'Erro interno do servidor.' });
    }
});

app.post('/logout', (req, res) => {
    // Limpa o cookie JWT no navegador do cliente
    // É crucial que as opções (path, httpOnly, secure) sejam as mesmas usadas para definir o cookie
    res.clearCookie('jwtToken', { 
        path: '/', 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production', 
        sameSite: 'Lax' // Use o mesmo sameSite que usou ao definir
    });
    res.status(200).json({ message: 'Deslogado com sucesso!' });
});

// Rota de Registro (POST) - CORRIGIDA
app.post('/register', async (req, res) => {
    // Note: Esta rota de registro é provavelmente para usuários que se registram sozinhos
    // A rota /api/users (POST) abaixo será para admins que adicionam usuários
    const { username, email, password } = req.body; // Removi isAdmin e modulos, pois usuários que se registram não devem definir isso.

    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Nome de usuário, e-mail e senha são obrigatórios.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    try {
        const [existingUsers] = await db.execute(
            'SELECT id FROM usuarios WHERE email = ? OR nome = ?',
            [email, username]
        );

        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Este e-mail ou nome de usuário já está cadastrado.' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // Por padrão, novos registros não são admin e são ativos
        const [result] = await db.execute(
            'INSERT INTO usuarios (nome, email, senha, is_admin, status) VALUES (?, ?, ?, ?, ?)',
            [username, email, hashedPassword, false, 'active'] // is_admin = false, status = 'active' por padrão
        );

        const newUserId = result.insertId;

        // Atribuir o módulo de consulta CNPJ por padrão para novos usuários registrados
        const [modulosDb] = await db.execute('SELECT id FROM modulos WHERE nome_modulo = ?', ['consulta_cnpj']);
        const cnpjModuleId = modulosDb.length > 0 ? modulosDb[0].id : null;

        if (cnpjModuleId) {
            await db.execute(
                'INSERT INTO permissoes (usuario_id, modulo_id, pode_acessar) VALUES (?, ?, TRUE)',
                [newUserId, cnpjModuleId]
            );
        } else {
            console.warn("Módulo 'consulta_cnpj' não encontrado no banco de dados. Verifique a tabela 'modulos'.");
        }

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao registrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar usuário.' });
    }
});

const authorizeUserManagement = checkRole(['admin', 'gerenciamento_usuarios']);

app.get('/api/users', authenticateToken, authorizeUserManagement, async (req, res) => {
    try {
        // Seleciona as colunas necessárias, excluindo a senha
        const [users] = await db.execute('SELECT id, nome, email, is_admin, status FROM usuarios');
        
        const formattedUsers = await Promise.all(users.map(async user => {
            // Busca os módulos do usuário
            const [permissoesRows] = await db.execute(
                `SELECT m.nome_modulo
                FROM permissoes p
                JOIN modulos m ON p.modulo_id = m.id
                WHERE p.usuario_id = ? AND p.pode_acessar = TRUE`,
                [user.id]
            );
            const userModules = permissoesRows.map(row => row.nome_modulo);

            return {
                _id: user.id, // Frontend espera _id
                name: user.nome,
                email: user.email,
                role: user.is_admin ? 'admin' : 'user', // Determine a role baseada em is_admin
                status: user.status,
                modulos: userModules // Inclua os módulos
            };
        }));

        res.json(formattedUsers);
    } catch (error) {
        console.error('Erro ao buscar usuários:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar usuários.' });
    }
});

app.get('/api/users/:id', authenticateToken, authorizeUserManagement, async (req, res) => {
    try {
        const [rows] = await db.execute('SELECT id, nome, email, is_admin, status FROM usuarios WHERE id = ?', [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const user = rows[0];

        const [permissoesRows] = await db.execute(
            `SELECT m.nome_modulo
            FROM permissoes p
            JOIN modulos m ON p.modulo_id = m.id
            WHERE p.usuario_id = ? AND p.pode_acessar = TRUE`,
            [user.id]
        );
        const userModules = permissoesRows.map(row => row.nome_modulo);

        const formattedUser = {
            _id: user.id,
            name: user.nome,
            email: user.email,
            role: user.is_admin ? 'admin' : 'user',
            status: user.status,
            modulos: userModules
        };
        res.json(formattedUser);
    } catch (error) {
        console.error('Erro ao buscar usuário por ID:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar usuário.' });
    }
});

app.post('/api/users', authenticateToken, authorizeUserManagement, async (req, res) => {
    const { name, email, password, role, status } = req.body;
    const isAdmin = (role === 'admin');

    if (!name || !email || !password || !role || !status) {
        return res.status(400).json({ message: 'Todos os campos obrigatórios (nome, email, senha, permissão, status) devem ser preenchidos.' });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    try {
        const [existingUsers] = await db.execute('SELECT id FROM usuarios WHERE email = ? OR nome = ?', [email, name]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Este e-mail ou nome de usuário já está cadastrado.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [result] = await db.execute(
            'INSERT INTO usuarios (nome, email, senha, is_admin, status) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, isAdmin, status]
        );

        const newUserId = result.insertId;

        // Lógica para atribuir módulos:
        const modulesToAdd = [];
        if (isAdmin) {
            modulesToAdd.push('consulta_cnpj', 'gerenciamento_usuarios');
        } else if (role === 'user') {
            modulesToAdd.push('consulta_cnpj'); // Exemplo: usuário padrão tem acesso só a CNPJ
        }
        // Se você tiver outras roles no futuro, adicione aqui.

        if (modulesToAdd.length > 0) {
            const [modulosDb] = await db.execute('SELECT id, nome_modulo FROM modulos WHERE nome_modulo IN (?)', [modulesToAdd]);
            const modulosMap = new Map(modulosDb.map(m => [m.nome_modulo, m.id]));

            const permissoesValues = [];
            for (const moduloNome of modulesToAdd) {
                const moduloId = modulosMap.get(moduloNome);
                if (moduloId) {
                    permissoesValues.push([newUserId, moduloId, true]);
                } else {
                    console.warn(`Módulo '${moduloNome}' não encontrado no banco de dados ao adicionar usuário ${newUserId}.`);
                }
            }

            if (permissoesValues.length > 0) {
                await db.query('INSERT INTO permissoes (usuario_id, modulo_id, pode_acessar) VALUES ?', [permissoesValues]);
            }
        }

        res.status(201).json({ message: 'Usuário cadastrado com sucesso!' });

    } catch (error) {
        console.error('Erro ao cadastrar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao cadastrar usuário.' });
    }
});

app.put('/api/users/:id', authenticateToken, authorizeUserManagement, async (req, res) => {
    const userId = req.params.id;
    const { name, email, password, role, status } = req.body;
    const isAdmin = (role === 'admin');
    const loggedInUserId = req.user.userId;

    // Impede que um usuário tente modificar sua própria role ou status para evitar travamento
    if (String(userId) === String(loggedInUserId)) {
        // Se for o próprio usuário, ele pode alterar o nome e email, mas não a role ou status
        // Depende da sua regra de negócio, pode ser mais permissivo ou restritivo
        // Por enquanto, vamos permitir a edição, mas avisar se tentar mudar role/status.
        if (user.is_admin !== isAdmin || user.status !== status) {
             console.warn(`Tentativa de usuário ${loggedInUserId} de alterar sua própria role/status.`);
             // Poderia retornar um erro ou ignorar a mudança de role/status
             // return res.status(403).json({ message: 'Você não pode alterar sua própria permissão ou status diretamente.' });
        }
    }


    try {
        const [users] = await db.execute('SELECT * FROM usuarios WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        const user = users[0];

        // Verifica se o email está sendo alterado para um email já existente por outro usuário
        if (email && email.toLowerCase() !== user.email.toLowerCase()) { // Case-insensitive
            const [existingUserByEmail] = await db.execute('SELECT id FROM usuarios WHERE email = ? AND id != ?', [email, userId]);
            if (existingUserByEmail.length > 0) {
                return res.status(400).json({ message: 'Este e-mail já está em uso por outro usuário.' });
            }
        }
        // Verifica se o nome está sendo alterado para um nome já existente por outro usuário
        if (name && name.toLowerCase() !== user.nome.toLowerCase()) { // Case-insensitive
             const [existingUserByName] = await db.execute('SELECT id FROM usuarios WHERE nome = ? AND id != ?', [name, userId]);
            if (existingUserByName.length > 0) {
                return res.status(400).json({ message: 'Este nome de usuário já está em uso por outro usuário.' });
            }
        }

        let hashedPassword = user.senha; // Mantém a senha existente se não for fornecida uma nova
        if (password) { // Se uma nova senha foi fornecida
            if (password.length < 6) {
                return res.status(400).json({ message: 'A nova senha deve ter no mínimo 6 caracteres.' });
            }
            hashedPassword = await bcrypt.hash(password, 10);
        }
        
        // Atualiza os dados do usuário no banco de dados
        await db.execute(
            'UPDATE usuarios SET nome = ?, email = ?, senha = ?, is_admin = ?, status = ? WHERE id = ?',
            [name, email, hashedPassword, isAdmin, status, userId]
        );

        // Lógica de atualização de módulos: limpa as permissões existentes e adiciona as novas baseado na role
        await db.execute('DELETE FROM permissoes WHERE usuario_id = ?', [userId]);
        
        const modulesToAdd = [];
        if (isAdmin) {
            modulesToAdd.push('consulta_cnpj', 'gerenciamento_usuarios');
        } else if (role === 'user') {
            modulesToAdd.push('consulta_cnpj'); // Usuário padrão tem acesso só a CNPJ
        }

        if (modulesToAdd.length > 0) {
            const [modulosDb] = await db.execute('SELECT id, nome_modulo FROM modulos WHERE nome_modulo IN (?)', [modulesToAdd]);
            const modulosMap = new Map(modulosDb.map(m => [m.nome_modulo, m.id]));

            const permissoesValues = [];
            for (const moduloNome of modulesToAdd) {
                const moduloId = modulosMap.get(moduloNome);
                if (moduloId) {
                    permissoesValues.push([userId, moduloId, true]);
                } else {
                     console.warn(`Módulo '${moduloNome}' não encontrado no banco de dados ao atualizar usuário ${userId}.`);
                }
            }

            if (permissoesValues.length > 0) {
                await db.query('INSERT INTO permissoes (usuario_id, modulo_id, pode_acessar) VALUES ?', [permissoesValues]);
            }
        }

        res.json({ message: 'Usuário atualizado com sucesso!' });

    } catch (error) {
        console.error('Erro ao atualizar usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar usuário.' });
    }
});

app.delete('/api/users/:id', authenticateToken, authorizeUserManagement, async (req, res) => {
    const userIdToDelete = req.params.id;
    const loggedInUserId = req.user.userId;

    // Impede que um usuário tente se excluir
    if (String(userIdToDelete) === String(loggedInUserId)) {
        return res.status(403).json({ message: 'Você não pode excluir seu próprio usuário.' });
    }

    try {
        // Primeiro, exclua as permissões associadas a este usuário
        await db.execute('DELETE FROM permissoes WHERE usuario_id = ?', [userIdToDelete]);

        // Em seguida, exclua o usuário
        const [result] = await db.execute('DELETE FROM usuarios WHERE id = ?', [userIdToDelete]);

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'Usuário não encontrado.' });
        }
        res.json({ message: 'Usuário excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir usuário:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao excluir usuário.' });
    }
});

// Rota para consultar CNPJ via ReceitaWS (GET)
app.get('/api/cnpj/:cnpj', authenticateToken, async (req, res) => {
    try {
        const response = await fetch(`https://receitaws.com.br/v1/cnpj/${req.params.cnpj}`, {
            headers: { "User-Agent": "ConsultaCNPJApp" }
        });
        const data = await response.json();
        // Inclua um pequeno delay se você estiver batendo no limite de requisições da ReceitaWS
        await new Promise(resolve => setTimeout(resolve, 500)); // 500ms de atraso
        res.json(data);
    } catch (err) {
        console.error('Erro ao buscar CNPJ na ReceitaWS:', err);
        res.status(500).json({ error: 'Erro ao buscar CNPJ externo.' });
    }
});

// Rota para salvar CNPJ (POST)
app.post('/salvar_cnpj', authenticateToken, async (req, res) => {
    const d = req.body;
    // Garante que o usuario_id do token seja usado para salvar
    const userId = req.user.userId; 

    try {
        await db.execute(
            `INSERT INTO cnpjs (
                usuario_id, cnpj, nome, fantasia, abertura, situacao, tipo, porte, natureza_juridica,
                cnae_principal_codigo, cnae_principal_descricao, cnaes_secundarios, socios,
                endereco, telefone, email, capital_social, simples, simei, inscricao_estadual
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                nome=VALUES(nome), fantasia=VALUES(fantasia), abertura=VALUES(abertura),
                situacao=VALUES(situacao), tipo=VALUES(tipo), porte=VALUES(porte),
                natureza_juridica=VALUES(natureza_juridica), cnae_principal_codigo=VALUES(cnae_principal_codigo),
                cnae_principal_descricao=VALUES(cnae_principal_descricao), cnaes_secundarios=VALUES(cnaes_secundarios),
                socios=VALUES(socios), endereco=VALUES(endereco), telefone=VALUES(telefone),
                email=VALUES(email), capital_social=VALUES(capital_social), simples=VALUES(simples),
                simei=VALUES(simei), inscricao_estadual=VALUES(inscricao_estadual)
            `,
            [
                userId, // Usando o userId do token
                d.cnpj ? d.cnpj.replace(/\D/g, "") : null,
                d.nome || null,
                d.fantasia || null,
                dataBRparaISO(d.abertura),
                d.situacao || null,
                d.tipo || null,
                d.porte || null,
                d.natureza_juridica || null,
                d.cnae_principal_codigo || null,
                d.cnae_principal_descricao || null,
                d.cnaes_secundarios || null,
                d.socios || null,
                d.endereco || null,
                d.telefone || null,
                d.email || null,
                d.capital_social || null,
                d.simples || null,
                d.simei || null,
                d.inscricao_estadual || null
            ]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('Erro ao salvar CNPJ no banco de dados:', err);
        res.status(500).json({ error: 'Erro ao salvar no banco de dados.' });
    }
});

// Rota para listar CNPJs (GET)
app.get('/listar_cnpjs', authenticateToken, async (req, res) => {
    try {
        // Filtra os CNPJs pelo usuário logado
        const [rows] = await db.query('SELECT * FROM cnpjs WHERE usuario_id = ?', [req.user.userId]);
        res.json(rows);
    } catch (err) {
        console.error('Erro ao buscar CNPJs:', err);
        res.status(500).json({ error: 'Erro ao buscar CNPJs.' });
    }
});

// Rota para remover CNPJs (DELETE)
app.delete('/remover_cnpj/:cnpj', authenticateToken, async (req, res) => {
    const cnpjToRemove = req.params.cnpj.replace(/\D/g, "");
    const userId = req.user.userId; // ID do usuário logado

    try {
        const [result] = await db.execute(
            'DELETE FROM cnpjs WHERE cnpj = ? AND usuario_id = ?',
            [cnpjToRemove, userId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'CNPJ não encontrado ou não pertence a este usuário.' });
        }
        res.json({ success: true, message: 'CNPJ removido com sucesso.' });
    } catch (err) {
        console.error('Erro ao remover CNPJ:', err);
        res.status(500).json({ error: 'Erro ao remover CNPJ do banco de dados.' });
    }
});


// --- SERVIÇO DE ARQUIVOS ESTÁTICOS (DEVE SER O ÚLTIMO MIDDLEWARE DE ROTA) ---
app.use(express.static(path.join(__dirname, 'public'))); 

// Inicia o servidor
app.listen(3000, () => console.log('Proxy rodando em http://localhost:3000'));