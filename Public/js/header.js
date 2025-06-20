// public/js/header.js

document.addEventListener('DOMContentLoaded', () => {
    const userDropdown = document.getElementById('userDropdown');
    const userDropdownContent = document.getElementById('userDropdownContent');
    const logoutButton = document.getElementById('logoutButton');
    const dashboardLink = document.getElementById('dashboard-link');
    const userManagementLink = document.getElementById('user-management-link'); 

    const currentPath = window.location.pathname; // Pega o caminho da URL atual

    // --- Lógica para o link "Dashboard" ---
    if (dashboardLink) {
        // Se a rota atual for exatamente '/dashboard', esconda o link do Dashboard.
        if (currentPath === '/dashboard') {
            dashboardLink.style.display = 'none'; 
        } else {
            dashboardLink.style.display = 'block'; // Ou 'inline-block' dependendo do seu CSS
        }
    }

    // --- Lógica para o link "Gerenciar Usuários" ---
    if (userManagementLink) {
        // Obter as permissões do usuário dos atributos data-
        const isAdmin = userManagementLink.dataset.isAdmin === 'true'; // Converte string para booleano
        let userModules = [];
        try {
            userModules = JSON.parse(userManagementLink.dataset.userModules || '[]'); 
        } catch (e) {
            console.error('Erro ao fazer parse dos módulos do usuário:', e);
            userModules = []; 
        }

        // Primeiro, verifica se o usuário tem permissão para ver o link
        const hasPermission = isAdmin || userModules.includes('gerenciamento_usuarios');

        // Se o usuário tem permissão E não está na página do Dashboard, mostre o link
        if (hasPermission && currentPath !== '/dashboard') {
            userManagementLink.style.display = 'block'; // Ou 'inline-block'
        } else {
            userManagementLink.style.display = 'none';
        }
    }

    // --- Lógica para o dropdown de usuário ---
    if (userDropdown && userDropdownContent) {
        userDropdown.addEventListener('click', (event) => {
            event.preventDefault();
            userDropdownContent.classList.toggle('show');
            userDropdown.classList.toggle('active'); 
        });

        window.addEventListener('click', (event) => {
            if (!userDropdown.contains(event.target) && !userDropdownContent.contains(event.target)) {
                userDropdownContent.classList.remove('show');
                userDropdown.classList.remove('active');
            }
        });
    }

    // --- Lógica para o botão de sair (Logout) ---
    if (logoutButton) {
        logoutButton.addEventListener('click', async (event) => {
            event.preventDefault();
            try {
                const response = await fetch('/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    window.location.href = '/'; 
                } else {
                    const errorData = await response.json();
                    console.error('Falha ao deslogar:', errorData.message || response.statusText);
                    alert('Erro ao sair. Tente novamente.');
                }
            } catch (error) {
                console.error('Erro de rede ao deslogar:', error);
                alert('Erro de conexão ao sair. Tente novamente.');
            }
        });
    }
});