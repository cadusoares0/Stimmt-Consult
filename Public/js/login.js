// public/js/login.js
console.log('Login script loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Content para login.js");
    const loginForm = document.getElementById('login-form'); 

    if (loginForm) { // SE o formulário FOI ENCONTRADO
        console.log('Formulário de login ENCONTRADO.'); // <<-- Mude esta mensagem!
        
        const emailInput = document.getElementById('email');     
        const passwordInput = document.getElementById('password');
        const errorMessage = document.getElementById('errorMessage'); 

        // Limpar mensagem de erro (se houver) ao carregar a página, útil para o redirecionamento de sessão expirada
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('session_expired')) {
            errorMessage.textContent = 'Sua sessão expirou. Por favor, faça login novamente.';
            errorMessage.style.display = 'block';
        } else {
            errorMessage.style.display = 'none';
            errorMessage.textContent = '';
        }

        loginForm.addEventListener('submit', async (event) => {
            console.log('Formulário de login enviado'); // Este log está dentro do listener
            event.preventDefault();
            console.log("PreventDefault executado! Tentando fetch...");

            const email = emailInput.value;
            const password = passwordInput.value;

            errorMessage.style.display = 'none';
            errorMessage.textContent = '';

            try {
                const response = await fetch('http://localhost:3000/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ email, password })
                });

                // **ADICIONE ESTES CONSOLE.LOGS NOVAMENTE**
                console.log('Resposta bruta do servidor (fetch):', response); 
                const data = await response.json();
                console.log('Dados JSON da resposta (fetch):', data);

                if (response.ok) {
                    localStorage.setItem('token', data.token); 
                    localStorage.setItem('user', JSON.stringify(data.user));
                    
                    console.log('Redirecionando para:', data.redirectTo);
                    window.location.href = data.redirectTo; 
                } else {
                    errorMessage.textContent = data.message || 'Erro ao tentar fazer login.';
                    errorMessage.style.display = 'block';
                    passwordInput.value = ''; 
                    emailInput.focus();
                }

            } catch (error) {
                console.error('Erro na requisição de login (frontend):', error); // Log mais detalhado para o catch
                errorMessage.textContent = 'Não foi possível conectar ao servidor de login. Verifique sua conexão ou tente novamente mais tarde.';
                errorMessage.style.display = 'block';
            }
        });
    } else { // SE o formulário NÃO FOI ENCONTRADO
        console.error("ERRO GRAVE: Formulário de login com ID 'login-form' não encontrado.");
    }
});