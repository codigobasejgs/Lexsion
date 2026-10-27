# Guia de importação (CSV)

Tela: Importações (`/app/importacoes`), perfil Administrador. Artigo: “Importar planilha CSV”.

1. Na planilha, exporte a aba de clientes como **CSV UTF-8**. Não envie a pasta de trabalho com macros: senhas, macros e telas de licença nunca são migradas (nenhum VBA é executado).
2. Envie o arquivo (ou “Usar exemplo fictício”). Separador `;` ou `,` detectado.
3. Mapeie as colunas (sugestão automática por nome) ou marque “Ignorar coluna”.
4. “Validar” mostra por linha: criar, atualizar, ignorar (cabeçalho repetido, linha vazia, documento repetido) ou rejeitar (sem documento nem telefone válido).
5. Datas: `dd/mm/aaaa` ou número de série do Excel (ex.: 21916 = 01/01/1960); anos artificiais (1900) são sinalizados.
6. Texto iniciado por `=`, `+`, `-` ou `@` é tratado como texto; na exportação é neutralizado com apóstrofo.
7. “Confirmar importação” cria um lote; o lote pode ser revertido (“Reverter lote”).

Modelo: “Baixar CSV fictício de exemplo” na própria tela. Nunca use dados reais de clientes nesta demo.
