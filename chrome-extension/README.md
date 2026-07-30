# Refs do Avá — extensão Chrome

Empacota o fluxo do bookmarklet (`?add=<url>`) num ícone de verdade na barra do
Chrome. Não guarda login nem chama a API direto — só abre o site com a URL da
aba atual pré-preenchida; a autenticação continua sendo feita pelo próprio
site, como já era com o bookmarklet.

## Instalar (modo desenvolvedor)

1. Abra `chrome://extensions`.
2. Ative "Modo do desenvolvedor" (canto superior direito).
3. Clique em "Carregar sem compactação" e selecione esta pasta
   (`chrome-extension/`).
4. Fixe o ícone na barra de ferramentas (ícone de peça de quebra-cabeça →
   alfinete ao lado de "Refs do Avá").

## Usar

- Clique no ícone da extensão em qualquer aba → abre `refs.avaaraujo.com`
  numa nova aba com aquela URL pronta pra salvar.
- Botão direito na página (ou num link) → "Adicionar aos Refs do Avá" faz o
  mesmo, útil pra salvar um link sem sair da página atual.
