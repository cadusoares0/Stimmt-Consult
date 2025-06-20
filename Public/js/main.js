// public/js/main.js

document.addEventListener('DOMContentLoaded', () => {
    // Referências aos cards do dashboard e mensagens
    const cnpjModuleCard = document.getElementById('cnpjModuleCard');
    const userManagementModuleCard = document.getElementById('userManagementModuleCard');
    const accessDeniedMessage = document.getElementById('accessDeniedMessage');

    // --- Lógica de login e token (permanece aqui para proteger o dashboard) ---
    const token = localStorage.getItem('token');
    const userData = JSON.parse(localStorage.getItem('user'));

    // Se não houver token ou dados do usuário, redireciona para a tela de login
    if (!token || !userData) {
        window.location.href = '/'; // Redireciona para a rota raiz que serve index.ejs
        return;
    }

    // --- Lógica para controlar a visibilidade dos módulos com base nas permissões ---
    const userModules = userData.modulos || [];
    const isAdmin = userData.isAdmin;

    // Função para verificar permissão e exibir/ocultar cards dos módulos
    function checkModuleAccess() {
        // Módulo de Consulta CNPJ
        if (cnpjModuleCard) {
            // Verifica se o usuário tem permissão para 'cnpj_consult' OU é administrador
            if (userModules.includes('cnpj_consult') || isAdmin) {
                cnpjModuleCard.style.display = 'flex'; // Exibe o card
            } else {
                cnpjModuleCard.style.display = 'none'; // Oculta o card
            }
        }

        // Módulo de Gerenciamento de Usuários (somente para admins ou com permissão específica)
        if (userManagementModuleCard) {
            // Verifica se o usuário tem permissão para 'gerenciamento_usuarios' OU é administrador
            if (userModules.includes('gerenciamento_usuarios') || isAdmin) {
                userManagementModuleCard.style.display = 'flex'; // Exibe o card
            } else {
                userManagementModuleCard.style.display = 'none'; // Oculta o card
            }
        }
        
        // Adicione mais blocos 'if (seumoduloCard)' para outros módulos aqui, se tiver.
    }

    // Executa a verificação de acesso dos módulos ao carregar a página
    checkModuleAccess();

    // Eventos de clique para os cards de módulo (os 'href's já cuidam da navegação,
    // mas você pode adicionar lógica extra aqui se precisar)
});