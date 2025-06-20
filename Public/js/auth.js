// public/js/auth.js

// Variáveis globais para token e detalhes do usuário
const token = localStorage.getItem("jwtToken");
const userDetailsString = localStorage.getItem("userDetails");
let userDetails = null;

// --- Lógica de Autenticação e Redirecionamento ---
// Se não houver token ou detalhes do usuário, redireciona para a página de login (index.ejs)
if (!token || !userDetailsString) {
    window.location.href = 'index.ejs'; // <--- AQUI ESTÁ A MUDANÇA!
} else {
    try {
        userDetails = JSON.parse(userDetailsString);
        // Se o userDetails foi parseado com sucesso, mas por alguma razão está nulo, ainda redireciona
        if (!userDetails) {
            window.location.href = 'index.ejs'; // <--- E AQUI TAMBÉM!
        }
    } catch (e) {
        console.error("Erro ao parsear userDetails do localStorage:", e);
        // Em caso de erro ao parsear, limpa os dados e redireciona
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('userDetails');
        window.location.href = 'index.ejs'; // <--- E AQUI!
    }
}

// --- Função Auxiliar para Requisições Autenticadas (tornada global para ser acessível) ---
async function fetchAuthenticated(url, options = {}) {
    // Se userDetails ou token não estiverem disponíveis, já tratamos no início do script
    if (!token || !userDetails || !userDetails.userId) {
        logout(); // Garante o logout se algo der errado aqui
        throw new Error("Erro de autenticação: token ou detalhes do usuário ausentes.");
    }

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    // Adiciona o usuario_id ao corpo da requisição POST/PUT para /salvar_cnpj
    // Esta lógica agora está específica para a rota /salvar_cnpj
    if ((options.method === 'POST' || options.method === 'PUT') && url.includes('/salvar_cnpj')) {
        const body = JSON.parse(options.body || '{}');
        body.usuario_id = userDetails.userId; // userDetails.userId vem do JWT payload
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, { ...options, headers });

    // Tratamento de erro centralizado para 401 (Não Autorizado) e 403 (Proibido)
    if (response.status === 401 || response.status === 403) {
        alert('Sessão expirada ou acesso negado. Faça login novamente.');
        logout(); // Chama a função global de logout
        throw new Error(`Erro de autenticação: ${response.status}`);
    }

    return response;
}

// --- Função de Logout (tornada global para ser acessível de qualquer lugar) ---
window.logout = function() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('userDetails');
    window.location.href = 'index.ejs'; // <--- E AQUI TAMBÉM FOI MUDADO!
};

// --- Atualiza UI com informações do Usuário Logado ---
document.addEventListener("DOMContentLoaded", () => {
    const displayUserName = document.getElementById('display-user-name');
    if (displayUserName && userDetails && userDetails.name) {
        displayUserName.textContent = userDetails.name;
    }

    // Esconde/mostra elementos para administradores
    const adminOnlyElements = document.querySelectorAll('.admin-only');
    if (adminOnlyElements.length > 0 && userDetails && !userDetails.isAdmin) {
        adminOnlyElements.forEach(element => {
            element.style.display = 'none';
        });
    }

    // Controle de visibilidade de links/seções por módulo
    const userManagementLink = document.getElementById('user-management-link');
    if (userManagementLink && userDetails && !userDetails.modulos.includes('gerenciamento_usuarios')) {
        userManagementLink.style.display = 'none';
    } else if (userManagementLink) {
        userManagementLink.style.display = ''; // Garante visibilidade se o módulo estiver incluído
    }

    const adminSettingsButton = document.getElementById('admin-settings-button');
    if (adminSettingsButton && userDetails && userDetails.isAdmin) {
        adminSettingsButton.style.display = '';
    } else if (adminSettingsButton) {
        adminSettingsButton.style.display = 'none';
    }
});