// public/js/user-management.js

document.addEventListener('DOMContentLoaded', () => {
    const userTableBody = document.querySelector('#user-table tbody');
    const noUsersMessage = document.getElementById('no-users-message');
    const addUserBtn = document.getElementById('add-user-btn');
    const userFormModal = document.getElementById('user-form-modal');
    const closeButton = userFormModal.querySelector('.close-button');
    const userForm = document.getElementById('user-form');
    const formTitle = document.getElementById('form-title');
    const userIdInput = document.getElementById('user-id');
    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const roleSelect = document.getElementById('role');
    const statusSelect = document.getElementById('status');
    const submitFormBtn = document.getElementById('submit-form-btn');
    const cancelFormBtn = document.getElementById('cancel-form-btn');
    const formMessage = document.getElementById('form-message');
    const userSearchInput = document.getElementById('user-search');

    let users = []; // Array para armazenar os usuários carregados

    // --- Funções Auxiliares ---

    // Função para buscar usuários do backend
    async function fetchUsers() {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/users', {
                headers: {
                    'Authorization': `Bearer ${token}` // Inclui o token para autenticação
                }
            });
            if (!response.ok) {
                // Se a resposta não for OK (ex: 403 Forbidden), lidar com isso
                if (response.status === 403) {
                    console.error('Acesso negado: Você não tem permissão para ver os usuários.');
                    userTableBody.innerHTML = '<tr><td colspan="5">Você não tem permissão para visualizar esta informação.</td></tr>';
                    noUsersMessage.style.display = 'none'; // Ou mostrar uma mensagem específica
                    return;
                }
                throw new Error(`Erro ao buscar usuários: ${response.statusText}`);
            }
            users = await response.json();
            renderUsersTable(users);
        } catch (error) {
            console.error('Erro ao carregar usuários:', error);
            userTableBody.innerHTML = '<tr><td colspan="5">Erro ao carregar usuários. Tente novamente mais tarde.</td></tr>';
            noUsersMessage.style.display = 'none';
        }
    }

    // Função para renderizar a tabela de usuários
    function renderUsersTable(usersToRender) {
        userTableBody.innerHTML = ''; // Limpa a tabela
        if (usersToRender.length === 0) {
            noUsersMessage.style.display = 'block';
            return;
        }
        noUsersMessage.style.display = 'none';

        usersToRender.forEach(user => {
            const row = userTableBody.insertRow();
            row.dataset.userId = user._id; // Armazena o ID do usuário na linha para referência
            
            row.insertCell().textContent = user.name;
            row.insertCell().textContent = user.email;
            row.insertCell().textContent = user.role === 'admin' ? 'Administrador' : 'Usuário Padrão';
            row.insertCell().textContent = user.status === 'active' ? 'Ativo' : 'Inativo';

            const actionsCell = row.insertCell();
            actionsCell.classList.add('action-buttons'); // Adiciona classe para estilização dos botões
            
            const editButton = document.createElement('button');
            editButton.textContent = 'Editar';
            editButton.classList.add('edit-btn');
            editButton.addEventListener('click', () => openEditUserModal(user._id));

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Excluir';
            deleteButton.classList.add('delete-btn');
            deleteButton.addEventListener('click', () => confirmDeleteUser(user._id, user.name));

            actionsCell.appendChild(editButton);
            actionsCell.appendChild(deleteButton);
        });
    }

    // Função para abrir o modal de adicionar usuário
    function openAddUserModal() {
        formTitle.textContent = 'Cadastrar Novo Usuário';
        userForm.reset(); // Limpa o formulário
        userIdInput.value = ''; // Garante que o ID do usuário esteja vazio para cadastro
        passwordInput.required = true; // Senha é obrigatória ao cadastrar
        formMessage.style.display = 'none'; // Esconde mensagens anteriores
        userFormModal.style.display = 'flex'; // Exibe o modal
    }

    // Função para abrir o modal de edição de usuário
    async function openEditUserModal(userId) {
        formTitle.textContent = 'Editar Usuário';
        userForm.reset();
        formMessage.style.display = 'none';

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/users/${userId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (!response.ok) throw new Error(`Erro ao buscar detalhes do usuário: ${response.statusText}`);
            const user = await response.json();

            userIdInput.value = user._id;
            nameInput.value = user.name;
            emailInput.value = user.email;
            roleSelect.value = user.role;
            statusSelect.value = user.status;
            passwordInput.required = false; // Senha não é obrigatória na edição (deixe em branco para não alterar)

            userFormModal.style.display = 'flex';
        } catch (error) {
            console.error('Erro ao carregar dados para edição:', error);
            showFormMessage('Erro ao carregar dados do usuário para edição.', 'error');
        }
    }

    // Função para fechar o modal
    function closeUserModal() {
        userFormModal.style.display = 'none';
        formMessage.style.display = 'none';
    }

    // Função para lidar com a submissão do formulário (cadastro ou edição)
    userForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const userId = userIdInput.value;
        const method = userId ? 'PUT' : 'POST';
        const url = userId ? `/api/users/${userId}` : '/api/users';

        const userData = {
            name: nameInput.value,
            email: emailInput.value,
            role: roleSelect.value,
            status: statusSelect.value,
        };

        // Adiciona a senha apenas se ela foi preenchida (para PUT) ou se for um POST
        if (passwordInput.value || method === 'POST') {
            userData.password = passwordInput.value;
        }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok) {
                showFormMessage(result.message || 'Operação realizada com sucesso!', 'success');
                fetchUsers(); // Recarrega a lista de usuários
                setTimeout(closeUserModal, 1500); // Fecha o modal após um tempo
            } else {
                showFormMessage(result.message || 'Erro na operação.', 'error');
            }
        } catch (error) {
            console.error('Erro ao enviar formulário:', error);
            showFormMessage('Erro ao conectar com o servidor.', 'error');
        }
    });

    // Função para confirmar e deletar usuário
    async function confirmDeleteUser(userId, userName) {
        if (confirm(`Tem certeza que deseja excluir o usuário "${userName}"? Esta ação é irreversível!`)) {
            try {
                const token = localStorage.getItem('token');
                const response = await fetch(`/api/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                const result = await response.json();

                if (response.ok) {
                    alert(result.message || 'Usuário excluído com sucesso!');
                    fetchUsers(); // Recarrega a lista de usuários
                } else {
                    alert(result.message || 'Erro ao excluir usuário.');
                }
            } catch (error) {
                console.error('Erro ao excluir usuário:', error);
                alert('Erro ao conectar com o servidor para excluir usuário.');
            }
        }
    }

    // Função para exibir mensagens no formulário
    function showFormMessage(message, type) {
        formMessage.textContent = message;
        formMessage.className = `form-message ${type}-message`; // Adiciona classes de estilo
        formMessage.style.display = 'block';
    }

    // --- Event Listeners ---
    addUserBtn.addEventListener('click', openAddUserModal);
    closeButton.addEventListener('click', closeUserModal);
    cancelFormBtn.addEventListener('click', closeUserModal);

    // Fechar o modal clicando fora
    window.addEventListener('click', (event) => {
        if (event.target === userFormModal) {
            closeUserModal();
        }
    });

    // Lógica de busca/filtro (simples, filtra na lista atual)
    userSearchInput.addEventListener('input', () => {
        const searchTerm = userSearchInput.value.toLowerCase();
        const filteredUsers = users.filter(user => 
            user.name.toLowerCase().includes(searchTerm) || 
            user.email.toLowerCase().includes(searchTerm)
        );
        renderUsersTable(filteredUsers);
    });

    // --- Inicialização ---
    fetchUsers(); // Carrega os usuários ao iniciar a página
});