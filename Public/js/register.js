document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('registerForm');
    const messageDisplay = document.getElementById('message');

    registerForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o recarregamento da página

        const username = document.getElementById('username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const isAdmin = document.getElementById('isAdmin').checked; // Pega o estado do checkbox
        
        // Coleta os módulos selecionados
        const selectedModules = Array.from(document.querySelectorAll('input[name="modulos"]:checked'))
                                     .map(cb => cb.value);

        // Validações básicas no frontend
        if (password !== confirmPassword) {
            showMessage('As senhas não coincidem!', 'error');
            return;
        }

        if (password.length < 6) {
            showMessage('A senha deve ter no mínimo 6 caracteres.', 'error');
            return;
        }

        try {
            const response = await fetch('http://localhost:3000/register', { // Nova rota no backend
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username,
                    email: email,
                    password: password,
                    isAdmin: isAdmin,
                    modulos: selectedModules // Envia os módulos selecionados
                })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message, 'success');
                // Opcional: Limpar o formulário após sucesso
                registerForm.reset(); 
                // Opcional: Redirecionar para a tela de login após um tempo
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 2000); 
            } else {
                showMessage(data.message || 'Erro ao cadastrar usuário.', 'error');
            }
        } catch (error) {
            console.error('Erro:', error);
            showMessage('Erro na comunicação com o servidor. Tente novamente.', 'error');
        }
    });

    function showMessage(message, type) {
        messageDisplay.textContent = message;
        messageDisplay.className = `message ${type}`; // Adiciona a classe 'error' ou 'success'
        messageDisplay.style.display = 'block';
    }
});