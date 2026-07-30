// empacota o fluxo do bookmarklet (ver Library.tsx, ?add=<url>) num ícone de
// extensão de verdade: abre o site com a URL da aba atual pré-preenchida no
// AddModal. Não guarda sessão nem chama a API direto — a autenticação
// continua sendo feita pelo próprio site, igual o bookmarklet já fazia.
const BASE_URL = "https://refs.avaaraujo.com";

function openAddTab(url) {
  // sem "activeTab" no manifest, tab.url/info.pageUrl vêm undefined e isso
  // falha em silêncio (o ícone "não faz nada") — o log ajuda a diagnosticar
  // se isso voltar a acontecer
  if (!url) {
    console.error("Refs do Avá: sem URL da aba pra abrir.");
    return;
  }
  chrome.tabs.create({ url: `${BASE_URL}/?add=${encodeURIComponent(url)}` });
}

chrome.action.onClicked.addListener((tab) => {
  openAddTab(tab.url);
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "add-to-refs",
    title: "Adicionar aos Refs do Avá",
    contexts: ["page", "link"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== "add-to-refs") return;
  openAddTab(info.linkUrl || info.pageUrl || tab?.url);
});
