document.addEventListener("DOMContentLoaded", () => {
    const cnpjList = document.getElementById("cnpj-list");
    const cnpjDetails = document.getElementById("cnpj-details");
    const loadingMessage = document.getElementById("loading-message");
    const errorMessage = document.getElementById("error-message");
    const btnConsultaMassa = document.getElementById("btn-consulta-massa");
    const inputExcel = document.getElementById("input-excel");
    const massLoading = document.getElementById("mass-loading");
    // const massProgress = document.getElementById("mass-progress"); // REMOVA OU COMENTE ESTA LINHA
    const searchInput = document.getElementById("input-cnpj");
    const cnpjNaoEncontrado = document.getElementById("cnpj-nao-encontrado");
    const btnCadastrarSim = document.getElementById("btn-cadastrar-cnpj-sim");
    const btnCadastrarNao = document.getElementById("btn-cadastrar-cnpj-nao");
    const btnExportarExcel = document.getElementById("btn-exportar-excel");

    // NOVAS CONSTANTES PARA OS ELEMENTOS DA BARRA DE PROGRESSO
    const massTextProgress = document.getElementById("mass-text-progress"); // Elemento para o TEXTO de progresso
    const progressBarFill = document.getElementById("mass-progress"); // Elemento que será o PREENCHIMENTO da barra

    // Função auxiliar para fazer requisições autenticadas
    async function fetchAuthenticated(url, options = {}) {
        const headers = {
            ...options.headers,
        };
        const response = await fetch(url, { credentials: 'include', ...options, headers });
        if (response.status === 401 || response.status === 403) {
            alert('Sessão expirada ou acesso negado. Faça login novamente.');
            localStorage.removeItem("userDetails");
            window.location.href = '/';
            throw new Error(`Erro de autenticação: ${response.status}`);
        }
        return response;
    }

    // --- Funções de Manipulação de CNPJ ---

    btnExportarExcel.addEventListener("click", async function () {
        try {
            const response = await fetchAuthenticated('http://localhost:3000/listar_cnpjs');
            const cnpjs = await response.json();

            const dadosParaExportar = cnpjs.map(cnpj => ({
                CNPJ: mascaraCNPJ(cnpj.cnpj),
                Nome: cnpj.nome,
                Fantasia: cnpj.fantasia,
                Abertura: cnpj.abertura ? new Date(cnpj.abertura).toLocaleDateString('pt-BR') : "",
                Situacao: cnpj.situacao,
                Tipo: cnpj.tipo,
                Porte: cnpj.porte,
                "Natureza Jurídica": cnpj.natureza_juridica,
                "CNAE Principal": cnpj.cnae_principal_codigo + " - " + (cnpj.cnae_principal_descricao || ""),
                "Atividades Secundárias": cnpj.cnaes_secundarias,
                Sócios: cnpj.socios,
                Endereço: cnpj.endereco,
                Telefone: cnpj.telefone,
                Email: cnpj.email,
                "Capital Social": cnpj.capital_social,
                Simples: cnpj.simples,
                Simei: cnpj.simei,
                "Inscrição Estadual": cnpj.inscricao_estadual
            }));

            const ws = XLSX.utils.json_to_sheet(dadosParaExportar);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "CNPJs");
            XLSX.writeFile(wb, "cnpjs_exportados.xlsx");
        } catch (error) {
            alert("Erro ao exportar: " + error.message);
            console.error(error);
        }
    });

    btnCadastrarSim.addEventListener("click", async function () {
        const cnpj = searchInput.value.replace(/\D/g, "");
        if (cnpj.length !== 14 || !validarCNPJ(cnpj)) {
            alert("CNPJ inválido.");
            return;
        }
        cnpjNaoEncontrado.style.display = "none";
        loadingMessage.style.display = "block";
        errorMessage.style.display = "none";
        try {
            const response = await fetchAuthenticated(`http://localhost:3000/api/cnpj/${cnpj}`);
            if (response.ok) {
                const data = await response.json();
                if (!data.cnpj) throw new Error("CNPJ não encontrado ou inválido");
                await salvarNoBanco(data);
                await carregarCNPJsSalvos(data.cnpj);
                mostrarDetalhesCNPJ(data);
                searchInput.value = "";
            } else {
                const errorText = await response.text();
                throw new Error(`Erro ao buscar CNPJ: ${response.status} - ${errorText}`);
            }
        } catch (error) {
            errorMessage.style.display = "block";
            errorMessage.textContent = error.message || "Erro ao buscar CNPJ";
            cnpjDetails.innerHTML = "";
            console.error(error);
        } finally {
            loadingMessage.style.display = "none";
        }
    });

    btnCadastrarNao.addEventListener("click", function () {
        cnpjNaoEncontrado.style.display = "none";
        searchInput.value = "";
        carregarCNPJsSalvos();
    });

    btnConsultaMassa.addEventListener("click", () => {
        inputExcel.value = "";
        inputExcel.click();
    });

    inputExcel.addEventListener("change", async function () {
        const file = this.files[0];
        if (!file) return;

        // Garante que o loader é exibido imediatamente e reseta a barra e o texto
        massLoading.style.display = "flex";
        massTextProgress.innerHTML = `<div class="mass-center">Preparando dados...</div>`;
        progressBarFill.style.width = "0%"; // Inicia a barra em 0%
        progressBarFill.style.backgroundColor = "var(--primary-blue)"; // Garante a cor inicial de preenchimento

        const responseListar = await fetchAuthenticated('http://localhost:3000/listar_cnpjs');
        const cadastrados = await responseListar.json();
        const cadastradosSet = new Set(cadastrados.map(c => c.cnpj.replace(/\D/g, "")));

        const reader = new FileReader();
        reader.onload = async function (e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: "array" });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

            const cnpjs = [];
            rows.forEach(row => {
                for (let cell of row) {
                    const cnpj = String(cell || "").replace(/\D/g, "");
                    if (cnpj.length === 14) {
                        cnpjs.push(cnpj);
                    }
                }
            });

            const cnpjsUnicos = [...new Set(cnpjs)];
            const jaCadastrados = cnpjsUnicos.filter(cnpj => cadastradosSet.has(cnpj));
            const novosCnpjs = cnpjsUnicos.filter(cnpj => !cadastradosSet.has(cnpj));

            if (cnpjsUnicos.length === 0) {
                alert("Nenhum CNPJ válido encontrado na planilha.");
                massLoading.style.display = "none"; // Esconde o loader se não houver CNPJs
                return;
            }

            let mensagemInicial = ""; // Renomeei de 'mensagem' para 'mensagemInicial' para clareza
            if (jaCadastrados.length > 0) {
                mensagemInicial = `<div class="mass-msg">O arquivo importado contém ${jaCadastrados.length} de ${cnpjsUnicos.length} CNPJ(s) já consultados.</div>`;
            }

            const DELAY_PER_REQUEST = 2000; // 2 segundos

            if (novosCnpjs.length === 0) {
                massTextProgress.innerHTML = `<div class="mass-center">${mensagemInicial}<br>Todos os CNPJs já estão cadastrados!</div>`;
                progressBarFill.style.width = "100%"; // Barra completa
                progressBarFill.style.backgroundColor = "var(--accent-green)"; // Cor de sucesso
                setTimeout(() => {
                    massLoading.style.display = "none";
                    carregarCNPJsSalvos();
                }, 2000);
                return;
            }

            for (let i = 0; i < novosCnpjs.length; i++) {
                const cnpj = novosCnpjs[i];
                try {
                    const resp = await fetchAuthenticated(`http://localhost:3000/api/cnpj/${cnpj}`);
                    const dataCnpj = await resp.json();
                    await salvarNoBanco(dataCnpj);
                } catch (err) {
                    console.error(`Erro ao consultar CNPJ ${cnpj}:`, err);
                }

                const consultados = i + 1;
                const totalNovos = novosCnpjs.length;
                const restantes = totalNovos - consultados;

                const segundosRestantes = (restantes * DELAY_PER_REQUEST) / 1000;

                const horas = Math.floor(segundosRestantes / 3600);
                const minutos = Math.floor((segundosRestantes % 3600) / 60);
                const segundos = Math.floor(segundosRestantes % 60);

                let tempoMsg = "";
                if (restantes > 0) {
                    tempoMsg = `<br><span style="font-size:0.95em;color:var(--medium-gray-text);">Tempo estimado restante: `; // Usando variável CSS
                    if (horas > 0) tempoMsg += `${horas}h `;
                    if (minutos > 0 || horas > 0) tempoMsg += `${minutos}min `;
                    tempoMsg += `${segundos}s</span>`;
                }

                // Calcula a porcentagem de progresso para a barra
                const progressPercentage = (consultados / totalNovos) * 100;
                progressBarFill.style.width = `${progressPercentage}%`; // ATUALIZA A LARGURA DO PREENCHIMENTO DA BARRA

                // Atualiza o conteúdo do NOVO elemento de texto
                massTextProgress.innerHTML = `
                    <div class="mass-center">
                        ${mensagemInicial}
                        <div class="mass-msg">Consultando: ${consultados} de ${totalNovos}</div>
                        ${tempoMsg}
                    </div>
                `;

                if (consultados < totalNovos) {
                    await new Promise(r => setTimeout(r, DELAY_PER_REQUEST));
                }
            }

            // Mensagem final e barra 100%
            massTextProgress.innerHTML = `<div class="mass-center">Consulta em massa finalizada!</div>`;
            progressBarFill.style.width = "100%";
            progressBarFill.style.backgroundColor = "var(--accent-green)"; // Cor de sucesso
            setTimeout(() => {
                massLoading.style.display = "none";
                carregarCNPJsSalvos();
            }, 1500);
        };
        reader.readAsArrayBuffer(file);
    });

    // --- Lógica para busca por CNPJ e Nome ---
    searchInput.addEventListener("input", function () {
        const termoOriginal = this.value;
        const numerosDigitados = termoOriginal.replace(/\D/g, "");

        if (numerosDigitados.length > 0 && numerosDigitados.length <= 14 && /^\d+$/.test(numerosDigitados)) {
            this.value = mascaraCNPJ(numerosDigitados);
        } else {
            this.value = termoOriginal;
        }

        const termoBuscaNumeros = this.value.replace(/\D/g, "");
        const termoBuscaNome = this.value.toLowerCase();

        let encontradoCNPJExato = false;
        let cnpjsVisiveis = 0;

        document.querySelectorAll("#cnpj-list li").forEach(li => {
            const cnpjLi = li.getAttribute("data-cnpj");
            const nomeEmpresaLi = li.getAttribute("data-nome-empresa") ? li.getAttribute("data-nome-empresa").toLowerCase() : "";

            let isVisible = false;

            if (termoBuscaNumeros.length === 14 && validarCNPJ(termoBuscaNumeros)) {
                if (cnpjLi === termoBuscaNumeros) {
                    li.style.display = "";
                    isVisible = true;
                    encontradoCNPJExato = true;
                } else {
                    li.style.display = "none";
                }
            } else {
                const matchCnpjParcial = termoBuscaNumeros.length > 0 && cnpjLi.includes(termoBuscaNumeros);
                const matchNome = nomeEmpresaLi.includes(termoBuscaNome);

                if (matchCnpjParcial || matchNome) {
                    li.style.display = "";
                    isVisible = true;
                } else {
                    li.style.display = "none";
                }
            }
            
            if (isVisible) {
                cnpjsVisiveis++;
            }
        });

        const quantidadeDiv = document.getElementById("cnpj-quantidade");
        if (quantidadeDiv) {
            if (termoBuscaNumeros.length === 0 && termoBuscaNome.length === 0) {
                carregarCNPJsSalvos();
            } else {
                quantidadeDiv.textContent = `${cnpjsVisiveis} CNPJ${cnpjsVisiveis === 1 ? "" : "s"} encontrado${cnpjsVisiveis === 1 ? "" : "s"}`;
            }
        }

        if (termoBuscaNumeros.length === 14) {
            if (!validarCNPJ(termoBuscaNumeros)) {
                cnpjNaoEncontrado.style.display = "block";
                cnpjNaoEncontrado.querySelector("span").textContent = "CNPJ inválido.";
                btnCadastrarSim.style.display = "none";
                btnCadastrarNao.style.display = "none";
            } else if (!encontradoCNPJExato) {
                cnpjNaoEncontrado.style.display = "flex";
                cnpjNaoEncontrado.querySelector("span").textContent = "CNPJ não encontrado. Deseja cadastrar?";
                btnCadastrarSim.style.display = "";
                btnCadastrarNao.style.display = "";
            } else {
                cnpjNaoEncontrado.style.display = "none";
            }
        } else {
            cnpjNaoEncontrado.style.display = "none";
        }
    });

    // --- NOVO: Listener para atalhos de teclado ---
    searchInput.addEventListener("keydown", (event) => {
        // Verifica se a seção "CNPJ não encontrado" está visível
        if (cnpjNaoEncontrado.style.display === "flex") {
            if (event.key === "Enter") {
                // Previne o comportamento padrão do Enter (ex: submeter formulário)
                event.preventDefault(); 
                // Simula o clique no botão "Cadastrar Sim"
                btnCadastrarSim.click();
            } else if (event.key === "Escape") {
                // Previne o comportamento padrão do Esc
                event.preventDefault(); 
                // Simula o clique no botão "Cadastrar Não"
                btnCadastrarNao.click();
            }
        }
    });

    function createCnpjListItem(cnpj, nome, data) {
        const listItem = document.createElement("li");
        const maskedCnpj = cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");

        const textContainer = document.createElement("div");
        textContainer.classList.add("cnpj-info-text"); 

        const cnpjSpan = document.createElement("span");
        cnpjSpan.textContent = maskedCnpj;
        textContainer.appendChild(cnpjSpan); 

        const nomeSpan = document.createElement("span");
        nomeSpan.className = "empresa-nome";
        nomeSpan.textContent = nome || "N/A";
        nomeSpan.style.display = "block"; 
        textContainer.appendChild(nomeSpan); 

        const lixeiraImg = document.createElement("img");
        lixeiraImg.src = "assets/images/lixeira-delete-cnpj.png"; 
        lixeiraImg.alt = "Excluir CNPJ";
        lixeiraImg.classList.add("lixeira-img"); 
        lixeiraImg.title = "Remover CNPJ"; 

        const cnpjSemMascara = cnpj.replace(/\D/g, "");
        listItem.setAttribute("data-cnpj", cnpjSemMascara);
        listItem.setAttribute("data-nome-empresa", nome || "");

        lixeiraImg.addEventListener("click", async (event) => {
            event.stopPropagation(); 
            if (confirm(`Tem certeza que deseja remover o CNPJ ${maskedCnpj}?`)) {
                try {
                    await fetchAuthenticated(`http://localhost:3000/remover_cnpj/${encodeURIComponent(cnpj)}`, {
                        method: "DELETE"
                    });
                    await carregarCNPJsSalvos(); 
                    cnpjDetails.innerHTML = ""; 
                } catch (error) {
                    alert("Erro ao remover do banco de dados: " + error.message);
                    console.error(error);
                }
            }
        });

        listItem.appendChild(textContainer); 
        listItem.appendChild(lixeiraImg); 

        listItem.cnpjData = data; 
        
        return listItem;
    }

    async function carregarCNPJsSalvos(cnpjToSelect = null) {
        cnpjList.innerHTML = "";
        cnpjDetails.innerHTML = '';
        try {
            const response = await fetchAuthenticated('http://localhost:3000/listar_cnpjs');
            let cnpjs = await response.json(); 

            cnpjs.sort((a, b) => new Date(b.data_cadastro || b.createdAt) - new Date(a.data_cadastro || a.createdAt));

            cnpjs.forEach(data => {
                const listItem = createCnpjListItem(data.cnpj, data.nome, data);
                listItem.addEventListener("click", () => {
                    document.querySelectorAll("#cnpj-list li").forEach(li => li.classList.remove("selected"));
                    listItem.classList.add("selected");
                    mostrarDetalhesCNPJ(data);
                });
                cnpjList.appendChild(listItem);
            });

            if (cnpjToSelect) {
                const itemParaSelecionar = document.querySelector(`#cnpj-list li[data-cnpj="${cnpjToSelect.replace(/\D/g, "")}"]`);
                if (itemParaSelecionar) {
                    document.querySelectorAll("#cnpj-list li").forEach(li => li.classList.remove("selected"));
                    itemParaSelecionar.classList.add("selected");
                    mostrarDetalhesCNPJ(itemParaSelecionar.cnpjData); 
                }
            }

            const quantidadeDiv = document.getElementById("cnpj-quantidade");
            if (quantidadeDiv) {
                quantidadeDiv.textContent = `${cnpjs.length} CNPJ${cnpjs.length === 1 ? "" : "s"}`;
            }
        } catch (error) {
            console.error('Erro ao carregar CNPJs salvos:', error);
        }
    }

    carregarCNPJsSalvos();

    async function salvarNoBanco(data) {
        try {
            let simplesValue = "Não";
            let simeiValue = "Não";
            if (data.simples) {
                const simplesStr = typeof data.simples.simples === "string" ? data.simples.simples.toLowerCase() : "";
                if (simplesStr.includes("sim")) simplesValue = "Sim";
                if (data.simples.simples === true) simplesValue = "Sim";
                const simeiStr = typeof data.simples.simei === "string" ? data.simples.simei.toLowerCase() : "";
                if (simeiStr.includes("sim")) simeiValue = "Sim";
                if (data.simples.simei === true) simeiValue = "Sim";
            }

            const response = await fetchAuthenticated('http://localhost:3000/salvar_cnpj', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    cnpj: data.cnpj.replace(/\D/g, ""),
                    nome: data.nome,
                    fantasia: data.fantasia,
                    abertura: data.abertura,
                    situacao: data.situacao,
                    tipo: data.tipo,
                    porte: data.porte,
                    natureza_juridica: typeof data.natureza_juridica === 'object' && data.natureza_juridica !== null ? data.natureza_juridica.descricao : data.natureza_juridica,
                    cnae_principal_codigo: data.atividade_principal?.[0]?.code || "",
                    cnae_principal_descricao: data.atividade_principal?.[0]?.text || "",
                    cnaes_secundarias: data.atividades_secundarias?.map(a => a.text).join(", ") || "",
                    socios: data.qsa?.map(q => q.nome).join(", ") || "",
                    endereco: `${data.logradouro || "N/A"}, ${data.numero || "S/N"}, ${data.bairro || "N/A"}, ${data.municipio || "N/A"} - ${data.uf || "N/A"}, CEP: ${data.cep || "N/A"}`,
                    telefone: data.telefone,
                    email: data.email,
                    capital_social: data.capital_social,
                    simples: simplesValue,
                    simei: simeiValue,
                    inscricao_estadual: data.inscricao_estadual || ""
                }),
            });

            if (!response.ok) {
                throw new Error('Erro ao salvar no banco de dados.');
            }

            console.log('CNPJ salvo com sucesso no banco de dados.');
        } catch (error) {
            console.error(error.message);
        }
    }

    function mascaraCNPJ(valor) {
        return valor
            .replace(/\D/g, "")
            .replace(/^(\d{2})(\d)/, "$1.$2")
            .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d)/, ".$1/$2")
            .replace(/(\d{4})(\d)/, "$1-$2")
            .replace(/(-\d{2})\d+?$/, "$1");
    }

    function mostrarDetalhesCNPJ(data) {
        const naturezaJuridicaDisplay = typeof data.natureza_juridica === 'object' && data.natureza_juridica !== null
            ? data.natureza_juridica.descricao || 'N/A'
            : data.natureza_juridica || 'N/A';

        const atividadePrincipal = Array.isArray(data.atividade_principal)
            ? (data.atividade_principal[0]?.text || "")
            : (data.atividade_principal || data.cnae_principal_descricao || "");

        const cnaeCodigo = Array.isArray(data.atividade_principal)
            ? (data.atividade_principal[0]?.code || data.cnae_principal_codigo || "")
            : (data.cnae_principal_codigo || "");

        const atividadesSecundarias = Array.isArray(data.atividades_secundarias)
            ? (data.atividades_secundarias.map(a => a.text).join(", "))
            : (data.cnaes_secundarias || "");

        const socios = Array.isArray(data.qsa)
            ? (data.qsa.map(q => q.nome).join(", ") || "")
            : (data.socios || "");

        function formatarData(data) {
            if (!data) return "";
            const d = new Date(data);
            if (isNaN(d)) return data;
            const dia = String(d.getDate()).padStart(2, '0');
            const mes = String(d.getMonth() + 1).padStart(2, '0');
            const ano = d.getFullYear();
            return `${dia}/${mes}/${ano}`;
        }

        let html = `<div class="cnpj-info">`;

        function addInfo(label, value) {
            if (value && String(value).trim() !== "") {
                html += `<div class="info-row"><span class="info-label">${label}:</span><span class="info-value">${value}</span></div>`;
            }
        }

        addInfo("CNPJ", mascaraCNPJ(data.cnpj));
        addInfo("Nome", data.nome);
        addInfo("Fantasia", data.fantasia);
        addInfo("Abertura", formatarData(data.abertura));
        addInfo("Situação", data.situacao);
        addInfo("Tipo", data.tipo);
        addInfo("Porte", data.porte);
        addInfo("Natureza Jurídica", naturezaJuridicaDisplay);
        addInfo("CNAE Principal", (cnaeCodigo ? cnaeCodigo + " - " : "") + (atividadePrincipal || ""));
        addInfo("Atividades Secundárias", atividadesSecundarias);
        addInfo("Sócios", socios);
        addInfo("Endereço", data.endereco);
        addInfo("Telefone", data.telefone);
        addInfo("Email", data.email);
        addInfo("Capital Social", data.capital_social);
        addInfo("Simples", data.simples);
        addInfo("Simei", data.simei);
        addInfo("Inscrição Estadual", data.inscricao_estadual);

        html += `</div>`;
        cnpjDetails.innerHTML = html;
    }

    function validarCNPJ(cnpj) {
        cnpj = cnpj.replace(/[^\d]+/g, '');
        if (cnpj.length !== 14) return false;
        if (/^(\d)\1+$/.test(cnpj)) return false;
        let tamanho = cnpj.length - 2;
        let numeros = cnpj.substring(0, tamanho);
        let digitos = cnpj.substring(tamanho);
        let soma = 0;
        let pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        let resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(0)) return false;
        tamanho = tamanho + 1;
        numeros = cnpj.substring(0, tamanho);
        soma = 0;
        pos = tamanho - 7;
        for (let i = tamanho; i >= 1; i--) {
            soma += numeros.charAt(tamanho - i) * pos--;
            if (pos < 2) pos = 9;
        }
        resultado = soma % 11 < 2 ? 0 : 11 - soma % 11;
        if (resultado != digitos.charAt(1)) return false;
        return true;
    }
});