/**
 * Controller do módulo de importação SPED
 * Gerencia a interface de usuário e o fluxo de importação
 */
const ImportacaoController = (function() {
    // Elementos da interface
    let elements = {};
    
    /**
     * Inicializa o controller
     */
    function inicializar() {
        // Mapeia elementos da interface
        elements = {
            // Inputs de arquivo
            spedFiscal: document.getElementById('sped-fiscal'),
            spedContribuicoes: document.getElementById('sped-contribuicoes'),
            spedEcf: document.getElementById('sped-ecf'),
            spedEcd: document.getElementById('sped-ecd'),
            
            // Checkboxes de opções
            importEmpresa: document.getElementById('import-empresa'),
            importProdutos: document.getElementById('import-produtos'),
            importImpostos: document.getElementById('import-impostos'),
            importCiclo: document.getElementById('import-ciclo'),
            
            // Controles adicionais
            periodoReferencia: document.getElementById('periodo-referencia'),
            
            // Botões
            btnImportar: document.getElementById('btn-importar-sped'),
            btnCancelar: document.getElementById('btn-cancelar-importacao'),
            
            // Área de log
            logArea: document.getElementById('import-log')
        };
        
        // Verifica se todos os elementos foram encontrados
        if (!verificarElementos()) {
            console.error('Erro ao inicializar o controller: elementos não encontrados');
            return;
        }
        
        // Adiciona event listeners
        adicionarEventListeners();
        
        console.log('ImportacaoController inicializado');
    }
    
    /**
     * Verifica se todos os elementos necessários estão presentes
     * @returns {boolean} Verdadeiro se todos os elementos foram encontrados
     */
    function verificarElementos() {
        return elements.btnImportar && elements.logArea;
    }
    
    /**
     * Adiciona os event listeners aos elementos da interface
     */
    function adicionarEventListeners() {
        elements.btnImportar.addEventListener('click', iniciarImportacao);
        elements.btnCancelar.addEventListener('click', cancelarImportacao);
    }
    
    /**
     * Inicia o processo de importação
     */
    function iniciarImportacao() {
        // Limpa o log
        limparLog();
        
        // Verifica se há arquivos selecionados
        if (!verificarArquivosSelecionados()) {
            adicionarLog('Selecione pelo menos um arquivo SPED para importação.', 'error');
            return;
        }
        
        adicionarLog('Iniciando importação de dados SPED...', 'info');
        
        // Processa cada arquivo selecionado
        const promessas = [];
        
        if (elements.spedFiscal.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedFiscal.files[0], 'fiscal'));
        }
        
        if (elements.spedContribuicoes.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedContribuicoes.files[0], 'contribuicoes'));
        }
        
        if (elements.spedEcf.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedEcf.files[0], 'ecf'));
        }
        
        if (elements.spedEcd.files.length > 0) {
            promessas.push(processarArquivoSped(elements.spedEcd.files[0], 'ecd'));
        }
        
        // Aguarda o processamento de todos os arquivos
        Promise.all(promessas)
            .then(resultados => {
                // Combina os resultados
                const dadosCombinados = combinarResultados(resultados);
                
                // Extrai dados para o simulador
                const dadosSimulador = SpedExtractor.extrairDadosParaSimulador(dadosCombinados);
                
                // Preenche os campos do simulador
                preencherCamposSimulador(dadosSimulador);
                
                adicionarLog('Importação concluída com sucesso!', 'success');
            })
            .catch(erro => {
                adicionarLog('Erro durante a importação: ' + erro.message, 'error');
                console.error('Erro na importação:', erro);
            });
    }
    
   /**
     * Processa um arquivo SPED
     * @param {File} arquivo - Arquivo a ser processado
     * @param {string} tipo - Tipo de arquivo SPED
     * @returns {Promise} Promessa com os dados extraídos
     */
    function processarArquivoSped(arquivo, tipo) {
        adicionarLog(`Processando arquivo ${arquivo.name}...`, 'info');

        return new Promise((resolve, reject) => {
            try {
                SpedParser.processarArquivo(arquivo, tipo)
                    .then(dados => {
                        // Adiciona metadados ao objeto de resultado
                        dados.metadados = {
                            nomeArquivo: arquivo.name,
                            tipoArquivo: tipo,
                            tamanhoBytes: arquivo.size,
                            dataProcessamento: new Date().toISOString()
                        };

                        // Log detalhado dos dados encontrados
                        logDadosExtraidos(dados, tipo);

                        adicionarLog(`Arquivo ${arquivo.name} processado com sucesso.`, 'success');
                        resolve(dados);
                    })
                    .catch(erro => {
                        adicionarLog(`Erro ao processar ${arquivo.name}: ${erro.message}`, 'error');
                        reject(erro);
                    });
            } catch (erro) {
                adicionarLog(`Erro ao processar ${arquivo.name}: ${erro.message}`, 'error');
                reject(erro);
            }
        });
    }
    
    /**
     * Adiciona logs detalhados sobre os dados extraídos
     * @param {Object} dados - Dados extraídos do arquivo SPED
     * @param {string} tipo - Tipo de arquivo SPED
     */
    function logDadosExtraidos(dados, tipo) {
        // Resume os principais dados encontrados para o log
        let mensagens = [];

        // Log detalhado dos valores extraídos para verificação
        const logDetalhado = {
            tipo: tipo,
            arquivo: dados.metadados?.nomeArquivo || 'N/A',
            timestamp: new Date().toISOString(),
            registros: {}
        };

        switch(tipo) {
            case 'fiscal':
                // Resumo de documentos
                const qtdDocumentos = (dados.documentos || []).length;
                const qtdItens = (dados.itens || []).length;
                mensagens.push(`Encontrados ${qtdDocumentos} documentos e ${qtdItens} itens.`);

                // Log detalhado dos documentos
                if (dados.documentos && dados.documentos.length > 0) {
                    const valorTotalDocumentos = dados.documentos.reduce((sum, doc) => sum + (doc.valorTotal || 0), 0);
                    logDetalhado.registros.documentos = {
                        quantidade: qtdDocumentos,
                        valorTotal: valorTotalDocumentos,
                        amostra: dados.documentos.slice(0, 3) // Primeiros 3 para verificação
                    };
                }

                // Resumo de impostos com valores detalhados
                if (dados.impostos && dados.impostos.icms) {
                    const apuracaoICMS = dados.impostos.icms[0] || {};
                    mensagens.push(`Encontrados ${dados.impostos.icms.length} registros de apuração de ICMS.`);

                    logDetalhado.registros.icms = {
                        quantidade: dados.impostos.icms.length,
                        valorTotalDebitos: apuracaoICMS.valorTotalDebitos || 0,
                        valorTotalCreditos: apuracaoICMS.valorTotalCreditos || 0,
                        valorSaldoApurado: apuracaoICMS.valorSaldoApurado || 0
                    };

                    mensagens.push(`ICMS - Débitos: R$ ${(apuracaoICMS.valorTotalDebitos || 0).toFixed(2)}, Créditos: R$ ${(apuracaoICMS.valorTotalCreditos || 0).toFixed(2)}`);
                }

                // Verificação de incentivos com valores
                if (dados.ajustes && dados.ajustes.icms) {
                    const ajustesPositivos = dados.ajustes.icms.filter(a => a.valorAjuste > 0);
                    const valorTotalIncentivos = ajustesPositivos.reduce((sum, a) => sum + (a.valorAjuste || 0), 0);

                    if (ajustesPositivos.length > 0) {
                        mensagens.push(`Encontrados ${ajustesPositivos.length} ajustes positivos, possíveis incentivos fiscais (Total: R$ ${valorTotalIncentivos.toFixed(2)}).`);
                        logDetalhado.registros.incentivos = {
                            quantidade: ajustesPositivos.length,
                            valorTotal: valorTotalIncentivos,
                            detalhes: ajustesPositivos.map(a => ({
                                codigo: a.codigoAjuste,
                                valor: a.valorAjuste,
                                descricao: a.descricaoComplementar
                            }))
                        };
                    }
                }
                break;

            case 'contribuicoes':
                // Resumo de créditos com valores detalhados
                if (dados.creditos) {
                    const qtdCreditosPIS = (dados.creditos.pis || []).length;
                    const qtdCreditosCOFINS = (dados.creditos.cofins || []).length;

                    const valorCreditosPIS = (dados.creditos.pis || []).reduce((sum, c) => sum + (c.valorCredito || 0), 0);
                    const valorCreditosCOFINS = (dados.creditos.cofins || []).reduce((sum, c) => sum + (c.valorCredito || 0), 0);

                    mensagens.push(`Encontrados ${qtdCreditosPIS} registros de créditos de PIS (Total: R$ ${valorCreditosPIS.toFixed(2)}) e ${qtdCreditosCOFINS} de COFINS (Total: R$ ${valorCreditosCOFINS.toFixed(2)}).`);

                    logDetalhado.registros.creditos = {
                        pis: {
                            quantidade: qtdCreditosPIS,
                            valorTotal: valorCreditosPIS,
                            amostra: (dados.creditos.pis || []).slice(0, 3)
                        },
                        cofins: {
                            quantidade: qtdCreditosCOFINS,
                            valorTotal: valorCreditosCOFINS,
                            amostra: (dados.creditos.cofins || []).slice(0, 3)
                        }
                    };
                }

                // Resumo de débitos com valores detalhados
                if (dados.debitos) {
                    const valorDebitosPIS = (dados.debitos.pis || []).reduce((sum, d) => sum + (d.valorTotalContribuicao || 0), 0);
                    const valorDebitosCOFINS = (dados.debitos.cofins || []).reduce((sum, d) => sum + (d.valorTotalContribuicao || 0), 0);

                    if (valorDebitosPIS > 0 || valorDebitosCOFINS > 0) {
                        mensagens.push(`Débitos - PIS: R$ ${valorDebitosPIS.toFixed(2)}, COFINS: R$ ${valorDebitosCOFINS.toFixed(2)}`);
                        logDetalhado.registros.debitos = {
                            pis: {
                                valorTotal: valorDebitosPIS,
                                quantidade: (dados.debitos.pis || []).length
                            },
                            cofins: {
                                valorTotal: valorDebitosCOFINS,
                                quantidade: (dados.debitos.cofins || []).length
                            }
                        };
                    }
                }

                // Regime com detalhamento
                if (dados.regimes && dados.regimes.pis_cofins) {
                    const regimeDesc = dados.regimes.pis_cofins.codigoIncidencia === '1' ? 
                        'Não-Cumulativo' : (dados.regimes.pis_cofins.codigoIncidencia === '2' ? 'Cumulativo' : 'Misto');
                    mensagens.push(`Regime de apuração PIS/COFINS: ${regimeDesc}.`);
                    logDetalhado.registros.regime = {
                        codigoIncidencia: dados.regimes.pis_cofins.codigoIncidencia,
                        descricao: regimeDesc
                    };
                }
                break;

            case 'ecf':
                // Resumo DRE com valores
                if (dados.dre) {
                    const receita = dados.dre.receita_liquida?.valor || 0;
                    const lucro = dados.dre.lucro_liquido?.valor || 0;
                    mensagens.push(`Encontrados dados da DRE - Receita Líquida: R$ ${receita.toFixed(2)}, Lucro Líquido: R$ ${lucro.toFixed(2)}.`);
                    logDetalhado.registros.dre = dados.dre;
                }

                // Incentivos fiscais com valores
                if (dados.incentivosFiscais && dados.incentivosFiscais.length > 0) {
                    const valorTotalIncentivos = dados.incentivosFiscais.reduce((sum, inc) => sum + (inc.valorIncentivo || 0), 0);
                    mensagens.push(`Encontrados ${dados.incentivosFiscais.length} registros de incentivos fiscais (Total: R$ ${valorTotalIncentivos.toFixed(2)}).`);
                    logDetalhado.registros.incentivosFiscais = {
                        quantidade: dados.incentivosFiscais.length,
                        valorTotal: valorTotalIncentivos,
                        detalhes: dados.incentivosFiscais
                    };
                }

                // Apuração de impostos com valores
                if (dados.calculoImposto) {
                    const irpj = dados.calculoImposto.irpj;
                    const csll = dados.calculoImposto.csll;
                    let detalhesImpostos = [];

                    if (irpj) {
                        detalhesImpostos.push(`IRPJ: Base R$ ${(irpj.baseCalculoIRPJ || 0).toFixed(2)}, Valor R$ ${(irpj.valorIRPJ || 0).toFixed(2)}`);
                    }
                    if (csll) {
                        detalhesImpostos.push(`CSLL: Base R$ ${(csll.baseCalculoCSLL || 0).toFixed(2)}, Valor R$ ${(csll.valorCSLL || 0).toFixed(2)}`);
                    }

                    if (detalhesImpostos.length > 0) {
                        mensagens.push(`Apuração de impostos: ${detalhesImpostos.join(', ')}.`);
                    }

                    logDetalhado.registros.calculoImposto = dados.calculoImposto;
                }
                break;

            case 'ecd':
                // Resumo do balanço com valores
                if (dados.balancoPatrimonial && dados.balancoPatrimonial.length > 0) {
                    const ativoTotal = dados.balancoPatrimonial
                        .filter(conta => conta.codigoConta.startsWith('1') && conta.naturezaSaldo === 'D')
                        .reduce((sum, conta) => sum + (conta.saldoFinal || 0), 0);

                    mensagens.push(`Encontrados ${dados.balancoPatrimonial.length} contas no Balanço Patrimonial (Ativo Total: R$ ${ativoTotal.toFixed(2)}).`);
                    logDetalhado.registros.balancoPatrimonial = {
                        quantidade: dados.balancoPatrimonial.length,
                        ativoTotal: ativoTotal
                    };
                }

                // Resumo da DRE com valores
                if (dados.demonstracaoResultado && dados.demonstracaoResultado.length > 0) {
                    const receita = dados.demonstracaoResultado
                        .filter(conta => conta.codigoConta.startsWith('3.1') && conta.naturezaSaldo === 'C')
                        .reduce((sum, conta) => sum + (conta.saldoFinal || 0), 0);

                    mensagens.push(`Encontrados ${dados.demonstracaoResultado.length} contas na DRE (Receita: R$ ${receita.toFixed(2)}).`);
                    logDetalhado.registros.demonstracaoResultado = {
                        quantidade: dados.demonstracaoResultado.length,
                        receita: receita
                    };
                }

                // Lançamentos contábeis
                if (dados.lancamentosContabeis && dados.lancamentosContabeis.length > 0) {
                    const valorTotalLancamentos = dados.lancamentosContabeis.reduce((sum, lanc) => sum + (lanc.valorLancamento || 0), 0);
                    mensagens.push(`Encontrados ${dados.lancamentosContabeis.length} lançamentos contábeis (Valor Total: R$ ${valorTotalLancamentos.toFixed(2)}).`);
                    logDetalhado.registros.lancamentosContabeis = {
                        quantidade: dados.lancamentosContabeis.length,
                        valorTotal: valorTotalLancamentos
                    };
                }
                break;
        }

        // Adiciona as mensagens ao log
        mensagens.forEach(mensagem => adicionarLog(mensagem, 'info'));

        // Log detalhado no console para verificação técnica
        console.group(`IMPORTACAO-CONTROLLER: Dados extraídos detalhados - ${tipo.toUpperCase()}`);
        console.log('Resumo completo:', logDetalhado);
        console.groupEnd();

        // Salvar log detalhado para exportação posterior
        if (!window.logsImportacao) window.logsImportacao = [];
        window.logsImportacao.push(logDetalhado);
    }
    
    /**
     * Combina os resultados de múltiplos arquivos SPED
     * @param {Array} resultados - Array de resultados por arquivo
     * @returns {Object} Dados combinados
     */
    function combinarResultados(resultados) {
        // Inicializa objeto combinado com estrutura expandida
        const combinado = {
            empresa: {},
            documentos: [],
            itens: [],
            itensAnaliticos: [],
            impostos: {},
            creditos: {},
            debitos: {}, // Adicionar para garantir estrutura correta
            regimes: {},
            ajustes: {},
            receitasNaoTributadas: {},
            balancoPatrimonial: [],
            demonstracaoResultado: [],
            lancamentosContabeis: [],
            partidasLancamento: [],
            calculoImposto: {},
            incentivosFiscais: [],
            participantes: [],
            inventario: [],
            discriminacaoReceita: [],
            metadados: {
                arquivosProcessados: []
            }
        };

        // Combina os resultados com validação estrutural
        resultados.forEach(resultado => {
            if (!resultado || typeof resultado !== 'object') return;

            // Registra o arquivo processado
            if (resultado.metadados) {
                combinado.metadados.arquivosProcessados.push(resultado.metadados);
            }

            // Dados da empresa - prioriza o que tem nome preenchido
            if (resultado.empresa && Object.keys(resultado.empresa).length > 0) {
                const nomeEmpresaAtual = resultado.empresa.nome || '';
                const nomeEmpresaExistente = combinado.empresa.nome || '';

                // Prioriza resultado com nome da empresa preenchido
                if (nomeEmpresaAtual && (!nomeEmpresaExistente || 
                     Object.keys(combinado.empresa).length < Object.keys(resultado.empresa).length)) {
                    combinado.empresa = {...resultado.empresa};
                }
            }

            // Arrays simples (concatena todos)
            const arrayProps = [
                'documentos', 'itens', 'itensAnaliticos', 'balancoPatrimonial', 
                'demonstracaoResultado', 'lancamentosContabeis', 'partidasLancamento',
                'incentivosFiscais', 'participantes', 'inventario', 'discriminacaoReceita'
            ];

            arrayProps.forEach(prop => {
                if (Array.isArray(resultado[prop])) {
                    combinado[prop] = combinado[prop].concat(resultado[prop] || []);
                }
            });

            // Objetos de arrays categorizados (mescla por categoria)
            const objArrayProps = ['impostos', 'creditos', 'receitasNaoTributadas', 'ajustes'];

            objArrayProps.forEach(prop => {
                if (resultado[prop] && typeof resultado[prop] === 'object') {
                    Object.entries(resultado[prop]).forEach(([categoria, valores]) => {
                        if (!combinado[prop][categoria]) {
                            combinado[prop][categoria] = [];
                        }
                        if (Array.isArray(valores)) {
                            combinado[prop][categoria] = combinado[prop][categoria].concat(valores);
                        }
                    });
                }
            });

            // Objetos simples (mescla com preferência para dados mais detalhados)
            const objProps = ['regimes', 'calculoImposto'];

            objProps.forEach(prop => {
                if (resultado[prop] && typeof resultado[prop] === 'object') {
                    if (!combinado[prop]) combinado[prop] = {};

                    Object.entries(resultado[prop]).forEach(([chave, valor]) => {
                        // Se já existir, verifica qual é mais completo
                        if (!combinado[prop][chave] || 
                            (typeof valor === 'object' && 
                             Object.keys(valor).length > Object.keys(combinado[prop][chave]).length)) {
                            combinado[prop][chave] = {...valor};
                        }
                    });
                }
            });

            // Valores calculados - propriedades numéricas no nível raiz do objeto
            const valorProps = [
                'receitaBruta', 'receitaLiquida', 'lucroBruto', 'resultadoOperacional',
                'lucroLiquido', 'saldoClientes', 'saldoEstoques', 'saldoFornecedores',
                'ativoCirculante', 'passivoCirculante', 'capitalGiro', 'aliquotaEfetivaIRPJ',
                'aliquotaEfetivaCSLL', 'percentualExportacao', 'valorTotalIncentivos'
            ];

            valorProps.forEach(prop => {
                if (typeof resultado[prop] === 'number' && (!combinado[prop] || combinado[prop] === 0)) {
                    combinado[prop] = resultado[prop];
                }
            });
        });

        // Processa relações cruzadas entre os dados após a combinação
        processarRelacoesCruzadas(combinado);

        return combinado;
    }
    
    /**
     * Processa relações cruzadas entre dados de diferentes arquivos
     * @param {Object} dados - Dados combinados
     */
    function processarRelacoesCruzadas(dados) {
        // Relaciona documentos com participantes
        if (dados.documentos.length > 0 && dados.participantes.length > 0) {
            const participantesPorCodigo = {};

            dados.participantes.forEach(participante => {
                if (participante.codigo) {
                    participantesPorCodigo[participante.codigo] = participante;
                }
            });

            dados.documentos.forEach(doc => {
                if (doc.codPart && participantesPorCodigo[doc.codPart]) {
                    doc.participante = participantesPorCodigo[doc.codPart];
                }
            });
        }

        // Relaciona itens com documentos
        if (dados.documentos.length > 0 && dados.itens.length > 0) {
            const itensPorDocumento = {};

            dados.itens.forEach(item => {
                if (item.documentoId) {
                    if (!itensPorDocumento[item.documentoId]) {
                        itensPorDocumento[item.documentoId] = [];
                    }
                    itensPorDocumento[item.documentoId].push(item);
                }
            });

            dados.documentos.forEach(doc => {
                if (doc.id && itensPorDocumento[doc.id]) {
                    doc.itens = itensPorDocumento[doc.id];
                }
            });
        }

        // Calcula valores agregados
        calcularValoresAgregados(dados);
    }
    
    /**
     * Calcula valores agregados a partir dos dados combinados
     * @param {Object} dados - Dados combinados
     */
    function calcularValoresAgregados(dados) {
        // Se não tiver dados contábeis da ECD, tenta calcular com base nos documentos fiscais
        if (!dados.receitaBruta && dados.documentos.length > 0) {
            // Calcular receita bruta com base nos documentos de saída
            const documentosSaida = dados.documentos.filter(doc => 
                doc.indOper === '1' && // Saída
                doc.situacao === '00'  // Documento regular
            );

            if (documentosSaida.length > 0) {
                // Agrupa por mês/ano
                const receitaPorMes = {};
                let dataInicial = null;
                let dataFinal = null;

                documentosSaida.forEach(doc => {
                    if (!doc.dataEmissao) return;

                    // Formata data para YYYY-MM
                    const dataEmissao = doc.dataEmissao.replace(/(\d{2})(\d{2})(\d{4})/, '$3-$2');
                    const valorDoc = doc.valorTotal || 0;

                    if (!receitaPorMes[dataEmissao]) {
                        receitaPorMes[dataEmissao] = 0;
                    }

                    receitaPorMes[dataEmissao] += valorDoc;

                    // Atualiza período de análise
                    const dataObj = new Date(doc.dataEmissao.replace(/(\d{2})(\d{2})(\d{4})/, '$2/$1/$3'));

                    if (!dataInicial || dataObj < dataInicial) {
                        dataInicial = dataObj;
                    }

                    if (!dataFinal || dataObj > dataFinal) {
                        dataFinal = dataObj;
                    }
                });

                // Calcula receita média mensal
                if (Object.keys(receitaPorMes).length > 0) {
                    const totalReceita = Object.values(receitaPorMes).reduce((sum, val) => sum + val, 0);
                    dados.receitaBruta = totalReceita * 12 / Object.keys(receitaPorMes).length;
                }
            }
        }

        // Se não tiver informações de ciclo financeiro, calcula com base nos dados disponíveis
        if (!dados.saldoClientes && dados.balancoPatrimonial && dados.balancoPatrimonial.length > 0) {
            // Busca contas de clientes no balanço
            const contasClientes = dados.balancoPatrimonial.filter(conta => 
                (conta.codigoConta.startsWith('1.1.2') || // Ativo Circulante > Créditos
                 conta.descricaoConta.toLowerCase().includes('client')) && 
                conta.naturezaSaldo === 'D' // Saldo devedor
            );

            if (contasClientes.length > 0) {
                dados.saldoClientes = contasClientes.reduce((sum, conta) => sum + conta.saldoFinal, 0);
            }
        }

        // Calcula valores para resultado operacional
        if (!dados.resultadoOperacional && dados.lucroBruto) {
            // Estimativa simples baseada em margem típica
            dados.resultadoOperacional = dados.lucroBruto * 0.7; // 70% do lucro bruto
        }
    }
    
    /**
     * Preenche os campos do simulador com os dados extraídos
     * @param {Object} dados - Dados formatados para o simulador
     */
    function preencherCamposSimulador(dados) {
        adicionarLog('Preenchendo campos do simulador...', 'info');

        try {
            // Validar estrutura dos dados
            if (!dados || typeof dados !== 'object') {
                throw new Error('Dados inválidos ou mal-formados');
            }

            // Dados da empresa
            if (dados.empresa && elements.importEmpresa.checked) {
                preencherDadosEmpresa(dados.empresa);
                adicionarLog('Dados da empresa preenchidos com sucesso.', 'success');
            }

            // Parâmetros fiscais
            if (dados.parametrosFiscais && elements.importImpostos.checked) {
                preencherParametrosFiscais(dados.parametrosFiscais);
                adicionarLog('Parâmetros fiscais preenchidos com sucesso.', 'success');
            }

            // Ciclo financeiro
            if (dados.cicloFinanceiro && elements.importCiclo.checked) {
                preencherCicloFinanceiro(dados.cicloFinanceiro);
                adicionarLog('Dados do ciclo financeiro preenchidos com sucesso.', 'success');
            }

            // IVA Dual
            if (dados.ivaConfig) {
                preencherDadosIVADual(dados.ivaConfig, dados.empresa.setor);
                adicionarLog('Configurações do IVA Dual preenchidas com sucesso.', 'success');
            }

            // Rolar para a aba de simulação após preencher
            setTimeout(() => {
                const abaPrincipal = document.querySelector('.tab-button[data-tab="simulacao"]');
                if (abaPrincipal) {
                    abaPrincipal.click();
                }

                // Verificar se deve realizar simulação automática
                const btnSimular = document.getElementById('btn-simular');
                if (btnSimular) {
                    adicionarLog('Preparação concluída. Você pode clicar em "Simular" para ver os resultados.', 'info');
                }
            }, 1000);

        } catch (erro) {
            adicionarLog('Erro ao preencher campos do simulador: ' + erro.message, 'error');
            console.error('Erro ao preencher campos:', erro);
        }
    }
    
    /**
     * Preenche os dados da empresa no formulário
     * @param {Object} dadosEmpresa - Dados da empresa
     */
    function preencherDadosEmpresa(dadosEmpresa) {
        // Nome da empresa
        const campoEmpresa = document.getElementById('empresa');
        if (campoEmpresa && dadosEmpresa.nome) {
            campoEmpresa.value = dadosEmpresa.nome;
        }

        // Faturamento mensal
        const campoFaturamento = document.getElementById('faturamento');
        if (campoFaturamento && dadosEmpresa.faturamento) {
            // Verifica se há uma função de formatação disponível
            if (typeof CurrencyFormatter !== 'undefined' && CurrencyFormatter.formatarMoeda) {
                campoFaturamento.value = CurrencyFormatter.formatarMoeda(dadosEmpresa.faturamento);
            } else {
                campoFaturamento.value = formatarMoeda(dadosEmpresa.faturamento);
            }

            // Dispara evento para recalcular valores dependentes
            campoFaturamento.dispatchEvent(new Event('input'));
        }

        // Margem operacional
        const campoMargem = document.getElementById('margem');
        if (campoMargem && dadosEmpresa.margem) {
            // Converte decimal para percentual
            campoMargem.value = (dadosEmpresa.margem * 100).toFixed(2);
        }

        // Tipo de empresa
        const campoTipoEmpresa = document.getElementById('tipo-empresa');
        if (campoTipoEmpresa && dadosEmpresa.tipoEmpresa) {
            campoTipoEmpresa.value = dadosEmpresa.tipoEmpresa;
            // Dispara evento para atualizar campos dependentes
            campoTipoEmpresa.dispatchEvent(new Event('change'));
        }

        // Regime tributário
        const campoRegime = document.getElementById('regime');
        if (campoRegime && dadosEmpresa.regime) {
            campoRegime.value = dadosEmpresa.regime;
            // Dispara evento para atualizar campos dependentes
            campoRegime.dispatchEvent(new Event('change'));
        }
    }

    /**
     * Função utilitária para formatação segura de moeda
     * @param {number} valor - Valor a ser formatado
     * @returns {string} Valor formatado como moeda brasileira
     */
    function formatarMoedaUtilitario(valor) {
        if (typeof valor !== 'number' || isNaN(valor)) {
            valor = 0;
        }

        try {
            // Primeiro, tentar usar o formatador global se disponível
            if (typeof window.CalculationCore !== 'undefined' && 
                typeof window.CalculationCore.formatarMoeda === 'function') {
                return window.CalculationCore.formatarMoeda(valor);
            }

            // Segundo, tentar usar DataManager
            if (typeof window.DataManager !== 'undefined' && 
                typeof window.DataManager.formatarMoeda === 'function') {
                return window.DataManager.formatarMoeda(valor);
            }

            // Terceiro, usar Intl nativo
            return new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(valor);

        } catch (erro) {
            console.warn('Erro na formatação de moeda, usando fallback:', erro);

            // Fallback final: formatação manual
            const valorAbsoluto = Math.abs(valor);
            const sinal = valor < 0 ? '-' : '';
            const parteInteira = Math.floor(valorAbsoluto);
            const parteDecimal = Math.round((valorAbsoluto - parteInteira) * 100);

            const inteiraFormatada = parteInteira.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            const decimalFormatada = parteDecimal.toString().padStart(2, '0');

            return `${sinal}R$ ${inteiraFormatada},${decimalFormatada}`;
        }
    }
    
    /**
     * Preenche os parâmetros fiscais no formulário, priorizando o painel detalhado
     * @param {Object} parametrosFiscais - Parâmetros fiscais extraídos do SPED
     */
    function preencherParametrosFiscais(parametrosFiscais) {
        try {
            // PRIORIDADE 1: Preencher painel "Composição Tributária Detalhada"
            if (parametrosFiscais.composicaoTributaria) {
                preencherPainelComposicaoTributaria(parametrosFiscais.composicaoTributaria);
                adicionarLog('Painel de Composição Tributária Detalhada preenchido com dados do SPED.', 'success');
            }

            // Tipo de operação
            const campoTipoOperacao = document.getElementById('tipo-operacao');
            if (campoTipoOperacao && parametrosFiscais.tipoOperacao) {
                campoTipoOperacao.value = parametrosFiscais.tipoOperacao;
                campoTipoOperacao.dispatchEvent(new Event('change'));
            }

            // Regime PIS/COFINS
            const campoPisCofinsRegime = document.getElementById('pis-cofins-regime');
            if (campoPisCofinsRegime && parametrosFiscais.regimePisCofins) {
                campoPisCofinsRegime.value = parametrosFiscais.regimePisCofins;
                campoPisCofinsRegime.dispatchEvent(new Event('change'));
            }

            // PRIORIDADE 2: Preencher campos complementares apenas se não houver dados do SPED
            const configImpostos = parametrosFiscais.configuracaoImpostos || {};

            // Base de cálculo PIS/COFINS (apenas se não há dados detalhados do SPED)
            const fontesDados = parametrosFiscais.composicaoTributaria?.fontesDados;
            const temDadosSpedPis = fontesDados?.pis === 'sped';

            if (!temDadosSpedPis && configImpostos.pisCofins) {
                const campoBaseCalcPisCofins = document.getElementById('pis-cofins-base-calc');
                if (campoBaseCalcPisCofins && configImpostos.pisCofins.baseCalculo) {
                    campoBaseCalcPisCofins.value = (configImpostos.pisCofins.baseCalculo * 100).toFixed(1);
                    campoBaseCalcPisCofins.dispatchEvent(new Event('input'));
                }

                const campoPercCreditoPisCofins = document.getElementById('pis-cofins-perc-credito');
                if (campoPercCreditoPisCofins && configImpostos.pisCofins.percAproveitamento) {
                    campoPercCreditoPisCofins.value = (configImpostos.pisCofins.percAproveitamento * 100).toFixed(1);
                    campoPercCreditoPisCofins.dispatchEvent(new Event('input'));
                }
            }

            // Configurações ICMS (apenas se não há dados detalhados do SPED)
            const temDadosSpedIcms = fontesDados?.icms === 'sped';

            if (!temDadosSpedIcms && configImpostos.icms) {
                const campoAliquotaIcms = document.getElementById('aliquota-icms');
                if (campoAliquotaIcms && configImpostos.icms.aliquotaEfetiva) {
                    campoAliquotaIcms.value = (configImpostos.icms.aliquotaEfetiva * 100).toFixed(1);
                    campoAliquotaIcms.dispatchEvent(new Event('input'));
                }

                // Incentivo ICMS
                const campoIncentivoIcms = document.getElementById('possui-incentivo-icms');
                const campoPercentualIncentivo = document.getElementById('incentivo-icms');

                if (campoIncentivoIcms && configImpostos.icms.possuiIncentivo !== undefined) {
                    campoIncentivoIcms.checked = configImpostos.icms.possuiIncentivo;
                    campoIncentivoIcms.dispatchEvent(new Event('change'));

                    if (configImpostos.icms.possuiIncentivo && campoPercentualIncentivo && 
                        configImpostos.icms.percentualReducao) {
                        campoPercentualIncentivo.value = (configImpostos.icms.percentualReducao * 100).toFixed(1);
                    }
                }
            }

            // Mostrar indicadores de origem dos dados
            if (fontesDados) {
                mostrarIndicadoresOrigemDados(fontesDados);
            }

            // Atualizar os cálculos dependentes se a função estiver disponível
            if (typeof calcularCreditosTributarios === 'function') {
                try {
                    calcularCreditosTributarios();
                } catch (erro) {
                    console.warn('Erro ao recalcular créditos tributários:', erro);
                }
            }

            adicionarLog('Parâmetros fiscais preenchidos com sucesso.', 'success');

        } catch (erro) {
            console.error('Erro ao preencher parâmetros fiscais:', erro);
            adicionarLog('Erro ao preencher parâmetros fiscais: ' + erro.message, 'error');
        }
    }

    /**
     * Preenche especificamente o painel de Composição Tributária Detalhada
     * @param {Object} composicaoTributaria - Dados da composição tributária do SPED
     */
    function preencherPainelComposicaoTributaria(composicaoTributaria) {
        /**
         * Formata valor monetário de forma segura, sem recursão
         * @param {number} valor - Valor a ser formatado
         * @returns {string} Valor formatado como moeda
         */
        const formatarMoedaSeguro = (valor) => {
            if (typeof valor !== 'number' || isNaN(valor)) {
                valor = 0;
            }

            // Tentar usar CurrencyFormatter se disponível
            if (typeof window.CurrencyFormatter !== 'undefined' && 
                typeof window.CurrencyFormatter.formatarValorMonetario === 'function') {
                try {
                    return window.CurrencyFormatter.formatarValorMonetario(valor);
                } catch (erro) {
                    console.warn('Erro ao usar CurrencyFormatter:', erro);
                }
            }

            // Fallback: formatação manual usando Intl
            try {
                return new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                }).format(valor);
            } catch (erro) {
                console.warn('Erro na formatação Intl:', erro);
                // Fallback final: formatação básica
                return `R$ ${valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
            }
        };

        // CORREÇÃO PRINCIPAL: Verificar e normalizar estrutura de créditos
        let creditos = {};
        let debitos = {};

        // Normalizar créditos de múltiplas fontes possíveis
        if (composicaoTributaria.creditos) {
            creditos = { ...composicaoTributaria.creditos };
        }

        // Verificar estruturas alternativas de créditos
        if (Object.values(creditos).every(val => val === 0 || val === undefined)) {
            // Tentar buscar em estruturas alternativas
            const fonteAlternativas = [
                'creditosPIS', 'creditosCOFINS', 'creditosICMS', 'creditosIPI',
                'credito_pis', 'credito_cofins', 'credito_icms', 'credito_ipi'
            ];

            fonteAlternativas.forEach(fonte => {
                if (composicaoTributaria[fonte] && composicaoTributaria[fonte] > 0) {
                    const imposto = fonte.replace(/creditos?_?/i, '').toLowerCase();
                    creditos[imposto] = composicaoTributaria[fonte];
                }
            });
        }

        // Normalizar débitos
        if (composicaoTributaria.debitos) {
            debitos = { ...composicaoTributaria.debitos };
        }

        // Log para diagnóstico
        console.log('IMPORTACAO-CONTROLLER: Dados recebidos para composição tributária:', {
            creditosOriginais: composicaoTributaria.creditos,
            creditosNormalizados: creditos,
            debitosOriginais: composicaoTributaria.debitos,
            debitosNormalizados: debitos
        });

        // Preencher débitos
        const elementoDebitoPis = document.getElementById('debito-pis');
        const elementoDebitoCofins = document.getElementById('debito-cofins');
        const elementoDebitoIcms = document.getElementById('debito-icms');
        const elementoDebitoIpi = document.getElementById('debito-ipi');
        const elementoDebitoIss = document.getElementById('debito-iss');

        if (elementoDebitoPis) elementoDebitoPis.value = formatarMoedaSeguro(debitos.pis || 0);
        if (elementoDebitoCofins) elementoDebitoCofins.value = formatarMoedaSeguro(debitos.cofins || 0);
        if (elementoDebitoIcms) elementoDebitoIcms.value = formatarMoedaSeguro(debitos.icms || 0);
        if (elementoDebitoIpi) elementoDebitoIpi.value = formatarMoedaSeguro(debitos.ipi || 0);
        if (elementoDebitoIss) elementoDebitoIss.value = formatarMoedaSeguro(debitos.iss || 0);

        // CORREÇÃO PRINCIPAL: Preencher créditos com validação robusta
        const elementoCreditoPis = document.getElementById('credito-pis');
        const elementoCreditoCofins = document.getElementById('credito-cofins');
        const elementoCreditoIcms = document.getElementById('credito-icms');
        const elementoCreditoIpi = document.getElementById('credito-ipi');
        const elementoCreditoIss = document.getElementById('credito-iss');

        // Valores de créditos com fallback
        const valorCreditoPis = creditos.pis || creditos.PIS || 0;
        const valorCreditoCofins = creditos.cofins || creditos.COFINS || 0;
        const valorCreditoIcms = creditos.icms || creditos.ICMS || 0;
        const valorCreditoIpi = creditos.ipi || creditos.IPI || 0;
        const valorCreditoIss = 0; // ISS não gera créditos

        if (elementoCreditoPis) {
            elementoCreditoPis.value = formatarMoedaSeguro(valorCreditoPis);
            console.log('IMPORTACAO-CONTROLLER: Preenchendo crédito PIS:', valorCreditoPis);
        }
        if (elementoCreditoCofins) {
            elementoCreditoCofins.value = formatarMoedaSeguro(valorCreditoCofins);
            console.log('IMPORTACAO-CONTROLLER: Preenchendo crédito COFINS:', valorCreditoCofins);
        }
        if (elementoCreditoIcms) {
            elementoCreditoIcms.value = formatarMoedaSeguro(valorCreditoIcms);
            console.log('IMPORTACAO-CONTROLLER: Preenchendo crédito ICMS:', valorCreditoIcms);
        }
        if (elementoCreditoIpi) {
            elementoCreditoIpi.value = formatarMoedaSeguro(valorCreditoIpi);
            console.log('IMPORTACAO-CONTROLLER: Preenchendo crédito IPI:', valorCreditoIpi);
        }
        if (elementoCreditoIss) {
            elementoCreditoIss.value = formatarMoedaSeguro(valorCreditoIss);
        }

        // Preencher alíquotas efetivas com validação
        const aliquotas = composicaoTributaria.aliquotasEfetivas || {};
        const formatarAliquota = (valor) => {
            if (typeof valor !== 'number' || isNaN(valor)) return '0.000';
            return valor.toFixed(3);
        };

        const elementoAliquotaPis = document.getElementById('aliquota-efetiva-pis');
        const elementoAliquotaCofins = document.getElementById('aliquota-efetiva-cofins');
        const elementoAliquotaIcms = document.getElementById('aliquota-efetiva-icms');
        const elementoAliquotaIpi = document.getElementById('aliquota-efetiva-ipi');
        const elementoAliquotaIss = document.getElementById('aliquota-efetiva-iss');

        if (elementoAliquotaPis) elementoAliquotaPis.value = formatarAliquota(aliquotas.pis || 0);
        if (elementoAliquotaCofins) elementoAliquotaCofins.value = formatarAliquota(aliquotas.cofins || 0);
        if (elementoAliquotaIcms) elementoAliquotaIcms.value = formatarAliquota(aliquotas.icms || 0);
        if (elementoAliquotaIpi) elementoAliquotaIpi.value = formatarAliquota(aliquotas.ipi || 0);
        if (elementoAliquotaIss) elementoAliquotaIss.value = formatarAliquota(aliquotas.iss || 0);

        // Calcular e preencher totais
        const totalDebitos = Object.values(debitos).reduce((sum, val) => sum + (typeof val === 'number' ? val : 0), 0);
        const totalCreditos = valorCreditoPis + valorCreditoCofins + valorCreditoIcms + valorCreditoIpi + valorCreditoIss;

        const elementoTotalDebitos = document.getElementById('total-debitos');
        const elementoTotalCreditos = document.getElementById('total-creditos');
        const elementoAliquotaTotal = document.getElementById('aliquota-efetiva-total');

        if (elementoTotalDebitos) elementoTotalDebitos.value = formatarMoedaSeguro(totalDebitos);
        if (elementoTotalCreditos) {
            elementoTotalCreditos.value = formatarMoedaSeguro(totalCreditos);
            console.log('IMPORTACAO-CONTROLLER: Total de créditos calculado:', totalCreditos);
        }
        if (elementoAliquotaTotal) elementoAliquotaTotal.value = formatarAliquota(aliquotas.total || 0);

        // Marcar campos como preenchidos pelo SPED
        const camposPreenchidos = [
            'debito-pis', 'debito-cofins', 'debito-icms', 'debito-ipi', 'debito-iss',
            'credito-pis', 'credito-cofins', 'credito-icms', 'credito-ipi', 'credito-iss',
            'aliquota-efetiva-pis', 'aliquota-efetiva-cofins', 'aliquota-efetiva-icms', 
            'aliquota-efetiva-ipi', 'aliquota-efetiva-iss', 'aliquota-efetiva-total',
            'total-debitos', 'total-creditos'
        ];

        marcarCamposSpedPreenchidos(camposPreenchidos);

        // Log de confirmação
        console.log('IMPORTACAO-CONTROLLER: Painel de Composição Tributária preenchido:', {
            totalDebitos: totalDebitos,
            totalCreditos: totalCreditos,
            creditosIndividuais: {
                pis: valorCreditoPis,
                cofins: valorCreditoCofins,
                icms: valorCreditoIcms,
                ipi: valorCreditoIpi,
                iss: valorCreditoIss
            },
            aliquotaTotal: aliquotas.total || 0
        });
    }

    /**
     * Marca visualmente os campos preenchidos pelo SPED
     * @param {Array} camposIds - IDs dos campos preenchidos
     */
    function marcarCamposSpedPreenchidos(camposIds) {
        camposIds.forEach(id => {
            const elemento = document.getElementById(id);
            if (elemento) {
                elemento.classList.add('sped-data');
                elemento.title = 'Dados importados do SPED';
                elemento.style.borderLeft = '3px solid #28a745';
            }
        });
    }

    /**
     * Mostra indicadores visuais da origem dos dados
     * @param {Object} fontesDados - Mapeamento da fonte dos dados por imposto
     */
    function mostrarIndicadoresOrigemDados(fontesDados) {
        if (!fontesDados) return;

        Object.entries(fontesDados).forEach(([imposto, fonte]) => {
            const indicador = document.createElement('span');
            indicador.className = `fonte-dados ${fonte}`;
            indicador.textContent = fonte === 'sped' ? 'SPED' : 'EST';
            indicador.title = fonte === 'sped' ? 'Dados extraídos do SPED' : 'Dados estimados';

            // Adicionar indicador próximo aos campos relevantes
            const campoDebito = document.getElementById(`debito-${imposto}`);
            if (campoDebito && !campoDebito.parentNode.querySelector('.fonte-dados')) {
                campoDebito.parentNode.appendChild(indicador.cloneNode(true));
            }
        });
    }

    /**
     * Preenche os dados do ciclo financeiro no formulário
     * @param {Object} cicloFinanceiro - Dados do ciclo financeiro
     */
    function preencherCicloFinanceiro(cicloFinanceiro) {
        // PMR - Prazo Médio de Recebimento
        const campoPmr = document.getElementById('pmr');
        if (campoPmr && cicloFinanceiro.pmr) {
            campoPmr.value = Math.round(cicloFinanceiro.pmr);
            campoPmr.dispatchEvent(new Event('input'));
        }

        // PMP - Prazo Médio de Pagamento
        const campoPmp = document.getElementById('pmp');
        if (campoPmp && cicloFinanceiro.pmp) {
            campoPmp.value = Math.round(cicloFinanceiro.pmp);
            campoPmp.dispatchEvent(new Event('input'));
        }

        // PME - Prazo Médio de Estoque
        const campoPme = document.getElementById('pme');
        if (campoPme && cicloFinanceiro.pme) {
            campoPme.value = Math.round(cicloFinanceiro.pme);
            campoPme.dispatchEvent(new Event('input'));
        }

        // Percentual de vendas à vista
        const campoPercVista = document.getElementById('perc-vista');
        if (campoPercVista && cicloFinanceiro.percVista) {
            // Converte decimal para percentual
            campoPercVista.value = (cicloFinanceiro.percVista * 100).toFixed(0);
            campoPercVista.dispatchEvent(new Event('input'));
        }
    }

    /**
     * Preenche as configurações do IVA Dual no formulário
     * @param {Object} ivaConfig - Configuração do IVA
     * @param {string} setorCodigo - Código do setor
     */
    function preencherDadosIVADual(ivaConfig, setorCodigo) {
        // Seleciona o setor apropriado
        const campoSetor = document.getElementById('setor');
        if (campoSetor && setorCodigo) {
            // Busca o setor na lista
            const options = Array.from(campoSetor.options);
            const setorOption = options.find(opt => opt.value === setorCodigo);

            if (setorOption) {
                campoSetor.value = setorCodigo;
                campoSetor.dispatchEvent(new Event('change'));
            } else {
                // Se não encontrou, loga a informação
                adicionarLog(`Setor "${setorCodigo}" não encontrado na lista. Usando configuração manual do IVA.`, 'warning');

                // Preenche os campos manualmente
                if (ivaConfig) {
                    // Alíquota CBS
                    const campoAliquotaCbs = document.getElementById('aliquota-cbs');
                    if (campoAliquotaCbs && ivaConfig.cbs) {
                        campoAliquotaCbs.value = (ivaConfig.cbs * 100).toFixed(1);
                    }

                    // Alíquota IBS
                    const campoAliquotaIbs = document.getElementById('aliquota-ibs');
                    if (campoAliquotaIbs && ivaConfig.ibs) {
                        campoAliquotaIbs.value = (ivaConfig.ibs * 100).toFixed(1);
                    }

                    // Redução Especial
                    const campoReducao = document.getElementById('reducao');
                    if (campoReducao && ivaConfig.reducaoEspecial) {
                        campoReducao.value = (ivaConfig.reducaoEspecial * 100).toFixed(1);
                    }

                    // Categoria IVA
                    const campoCategoriaIva = document.getElementById('categoria-iva');
                    if (campoCategoriaIva && ivaConfig.categoriaIva) {
                        campoCategoriaIva.value = ivaConfig.categoriaIva;
                    }

                    // Calcular alíquota total
                    const campoAliquota = document.getElementById('aliquota');
                    if (campoAliquota) {
                        const aliquotaTotal = (ivaConfig.cbs + ivaConfig.ibs) * 
                                             (1 - ivaConfig.reducaoEspecial);
                        campoAliquota.value = (aliquotaTotal * 100).toFixed(1);
                    }
                }
            }
        }
    }
    
    /**
     * Cancela o processo de importação
     */
    function cancelarImportacao() {
        // Limpa os campos de arquivo
        elements.spedFiscal.value = '';
        elements.spedContribuicoes.value = '';
        elements.spedEcf.value = '';
        elements.spedEcd.value = '';
        
        // Limpa o log
        limparLog();
        
        adicionarLog('Importação cancelada pelo usuário.', 'info');
    }
    
    /**
     * Verifica se algum arquivo foi selecionado
     * @returns {boolean} Verdadeiro se há pelo menos um arquivo selecionado
     */
    function verificarArquivosSelecionados() {
        return (
            elements.spedFiscal.files.length > 0 ||
            elements.spedContribuicoes.files.length > 0 ||
            elements.spedEcf.files.length > 0 ||
            elements.spedEcd.files.length > 0
        );
    }
    
    /**
     * Adiciona uma mensagem à área de log
     * @param {string} mensagem - Mensagem a ser adicionada
     * @param {string} tipo - Tipo de mensagem (info, success, warning, error)
     */
    function adicionarLog(mensagem, tipo = 'info') {
        const logItem = document.createElement('p');
        logItem.className = `log-${tipo}`;
        
        const timestamp = new Date().toLocaleTimeString();
        logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> ${mensagem}`;
        
        elements.logArea.appendChild(logItem);
        elements.logArea.scrollTop = elements.logArea.scrollHeight;
    }
    
    /**
     * Limpa a área de log
     */
    function limparLog() {
        elements.logArea.innerHTML = '';
    }
    
    /**
     * Formata um valor numérico como moeda
     * @param {number} valor - Valor a ser formatado
     * @returns {string} Valor formatado como moeda
     */
    function formatarMoeda(valor) {
        return new Intl.NumberFormat('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        }).format(valor);
    }
    
    // Inicializa o controller quando o DOM estiver carregado
    document.addEventListener('DOMContentLoaded', inicializar);
    
    // Interface pública
    return {
        inicializar,
        adicionarLog
    };
})();