let lastPreviewTexto = null;

document.getElementById("process-btn").addEventListener("click", async () => {
  if (!lastPreviewTexto) {
    alert('Faça a pré-visualização antes de confirmar.');
    return;
  }
  processarExtrato(lastPreviewTexto);
  lastPreviewTexto = null;
});

function setProcessBtnEnabled(enabled) {
  const btn = document.getElementById('process-btn');
  if (btn) btn.disabled = !enabled;
}

async function readFileToText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async function() {
      try {
        const typedArray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedArray).promise;
        let textoCompleto = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageLines = getLinesFromContent(content);
          textoCompleto += pageLines.join('\n') + '\n';
        }
        resolve(textoCompleto);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function showPreview(texto) {
  const preview = document.getElementById('preview-modal');
  const body = document.getElementById('preview-body');
  if (!preview || !body) return;

  const linhas = texto.split('\n').filter(l => l.trim() !== '');
  const pix = [];
  const cartao = [];
  const boleto = [];
  const outros = [];
  linhas.forEach(linhaRaw => {
    const linha = removeLastNDigits(linhaRaw, 3);
    const lower = linha.toLowerCase();
    if (lower.includes('pix')) pix.push(linha);
    else if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('credito') || lower.includes('crédito')) cartao.push(linha);
    else if (lower.includes('boleto')) boleto.push(linha);
    else outros.push(linha);
  });

  function fg(titulo, dados) {
    if (dados.length === 0) return '';
    return `<h4>${titulo}</h4>` + dados.map(d => `<p>${d}</p>`).join('');
  }

  body.innerHTML = fg('PIX', pix) + fg('Cartão', cartao) + fg('Boleto', boleto) + fg('Outros', outros);
  preview.style.display = 'flex';
  setProcessBtnVisible(true);
  setProcessBtnEnabled(true);
}

function hidePreview() {
  const preview = document.getElementById('preview-modal');
  if (preview) preview.style.display = 'none';
  setProcessBtnVisible(false);
  setProcessBtnEnabled(false);
}

function setProcessBtnVisible(visible) {
  const btn = document.getElementById('process-btn');
  if (!btn) return;
  btn.style.display = visible ? 'inline-block' : 'none';
}
// Remove até N dígitos finais contíguos de uma linha (máx N)
function removeLastNDigits(str, n = 3) {
  let removed = 0;
  let i = str.length - 1;
  while (i >= 0 && removed < n) {
    if (/\d/.test(str[i])) {
      i--;
      removed++;
    } else {
      break;
    }
  }
  return str.slice(0, i + 1).replace(/\s+$/, '');
}
// Handler do botão de pré-visualizar
const previewBtn = document.getElementById('preview-btn');
if (previewBtn) {
  previewBtn.addEventListener('click', async () => {
    const fileInput = document.getElementById('file-input');
    if (!fileInput.files.length) {
      alert('Por favor, selecione um arquivo PDF para pré-visualizar.');
      return;
    }
    const file = fileInput.files[0];
    try {
      const texto = await readFileToText(file);
      lastPreviewTexto = texto;
      showPreview(texto);
      setProcessBtnEnabled(true);
    } catch (err) {
      console.error(err);
      alert('Erro ao ler o PDF.');
    }
  });
}

// Botões do modal
const confirmBtn = document.getElementById('confirm-btn');
const cancelBtn = document.getElementById('cancel-btn');
if (confirmBtn) {
  confirmBtn.addEventListener('click', () => {
    if (lastPreviewTexto) processarExtrato(lastPreviewTexto);
    lastPreviewTexto = null;
    hidePreview();
    setProcessBtnEnabled(false);
  });
}
if (cancelBtn) {
  cancelBtn.addEventListener('click', () => {
    hidePreview();
    lastPreviewTexto = null;
    setProcessBtnEnabled(false);
  });
}
// Agrupa os fragmentos de texto retornados pelo pdf.js em linhas, usando
// a coordenada Y (transform[5]). Retorna um array de strings (linhas).
function getLinesFromContent(content) {
  const items = content.items.map(item => {
    const t = item.transform || [0,0,0,0,0,0];
    return { str: item.str, x: t[4], y: t[5] };
  });

  const linesMap = new Map();
  items.forEach(it => {
    const yKey = Math.round(it.y);
    if (!linesMap.has(yKey)) linesMap.set(yKey, []);
    linesMap.get(yKey).push(it);
  });

  const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
  const lines = sortedYs.map(y => {
    const parts = linesMap.get(y).sort((a, b) => a.x - b.x).map(p => p.str);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  });

  console.log('getLinesFromContent -> linhas agrupadas:', lines.length);
  return lines;
}

function processarExtrato(texto) {
  const linhas = texto.split('\n');
  console.log('processarExtrato -> linhas recebidas:', linhas.length);

  const pix = [];
  const cartao = [];
  const boleto = [];
  const outros = [];

  linhas.forEach(linha => {
    if (linha.trim() === '') return;
    const linha = removeLastNDigits(linha, 3);
    if (linha.trim() === '') return;
    const lower = linha.toLowerCase();
    if (lower.includes('pix')) {
      pix.push(linha);
    } else if (lower.includes('cartão') || lower.includes('cartao') || lower.includes('credito') || lower.includes('crédito')) {
      cartao.push(linha);
    } else if (lower.includes('boleto')) {
      boleto.push(linha);
    } else {
      outros.push(linha);
    }
  });

  function formatarGrupo(titulo, dados) {
    if (dados.length === 0) return '';
    return `<h3>${titulo}</h3>` + dados.map(l => `<p>${l}</p>`).join('');
  }

  document.getElementById('pix').innerHTML = formatarGrupo('PIX', pix);
  document.getElementById('cartao').innerHTML = formatarGrupo('Cartão', cartao);
  document.getElementById('boleto').innerHTML = formatarGrupo('Boleto', boleto);
  document.getElementById('outros').innerHTML = formatarGrupo('Outros', outros);
}