const fs = require('fs');
const path = require('path');
const { addDocument, addInMemoryDocument } = require('../helper-node/services/ragEngine');

const KB_DIR = path.join(__dirname, '..', 'kb-documents');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'README.md'), 
`# Wibsite Knowledge Base

Esta carpeta contiene documentos de conocimiento del negocio que el agente IA usara
para responder preguntas de clientes.

## Formato
- Archivos .txt, .md
- Cada archivo es un documento independiente
- Los documentos se indexan en Weaviate al ejecutar scripts/load-kb-documents.js

## Documentos sugeridos
- faq.txt          — Preguntas frecuentes y respuestas
- productos.txt    — Catalogo de productos/servicios
- politicas.txt    — Politicas de la empresa (devoluciones, garantia, etc.)
- precios.txt      — Informacion de precios y paquetes
- horarios.txt     — Horarios de atencion
- contacto.txt     — Informacion de contacto
`);
  }
}

function chunkText(text, chunkSize = 500, overlap = 50) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.substring(start, end));
    start += (chunkSize - overlap);
  }
  return chunks;
}

async function main() {
  console.log('=== Load Knowledge Base Documents ===\n');

  ensureDir(KB_DIR);

  const files = fs.readdirSync(KB_DIR).filter(f => f.endsWith('.txt') || f.endsWith('.md'));
  if (files.length === 0) {
    console.log('No documents found in kb-documents/.');
    console.log(`A README.md de ejemplo fue creado en ${KB_DIR}/`);
    console.log('\nAgrega archivos .txt o .md con contenido del negocio y vuelve a ejecutar este script.');
    return;
  }

  let totalChunks = 0;
  for (const file of files) {
    const filePath = path.join(KB_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const chunks = chunkText(content);

    console.log(`Loading: ${file} (${content.length} chars -> ${chunks.length} chunks)`);

    for (let i = 0; i < chunks.length; i++) {
      try {
        await addDocument({
          title: `${file} [part ${i + 1}/${chunks.length}]`,
          content: chunks[i],
          metadata: { source: file, chunk: i + 1, totalChunks: chunks.length }
        });
        totalChunks++;
      } catch (e) {
        addInMemoryDocument({
          title: `${file} [part ${i + 1}]`,
          content: chunks[i],
          metadata: { source: file, chunk: i + 1 }
        });
        totalChunks++;
      }
    }
  }

  console.log(`\nTotal: ${files.length} documentos cargados (${totalChunks} chunks)`);
  console.log('El agente IA ahora puede consultar estos documentos via RAG.');
}

main();
