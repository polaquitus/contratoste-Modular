import { sbFetch } from '../supabase.js';
import { toast, showLoader, hideLoader } from '../ui.js';

// Constantes de configuración
const SB_FUNC_URL = 'https://upxsqroxbvzwudcaklvn.supabase.co/functions/v1/gemini-proxy';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVweHNxcm94YnZ6d3VkY2FrbHZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTg4NjYsImV4cCI6MjA5MTIzNDg2Nn0.EgXWuLg3ip66PnuCvK01XFj3QDMZDu7PDG21BwkzkNo';

/**
 * Obtiene la extensión de un nombre de archivo
 */
export function getFileExt(name = '') {
  return String(name).toLowerCase().split('.').pop();
}

/**
 * Determina el MIME type apropiado para un archivo
 */
export function getMimeTypeFromFile(file) {
  const ext = getFileExt(file.name);
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return file.type || 'application/octet-stream';
}

/**
 * Convierte un archivo a Base64 (sin el prefijo data:...)
 */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const result = String(e.target.result || '');
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Convierte un archivo a ArrayBuffer
 */
export function fileToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Extrae texto de un archivo DOCX usando mammoth
 */
export async function extractDocxText(file) {
  if (typeof mammoth === 'undefined') return '';
  try {
    const arrayBuffer = await fileToArrayBuffer(file);
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result && result.value ? result.value.trim() : '';
  } catch (e) {
    console.warn('Error extrayendo texto de DOCX:', e);
    return '';
  }
}

/**
 * Extrae texto legible de un archivo DOC binario (método de respaldo)
 */
export async function extractDocBinaryText(file) {
  try {
    const arrayBuffer = await fileToArrayBuffer(file);
    const bytes = new Uint8Array(arrayBuffer);
    let ascii = '';
    for (let i = 0; i < bytes.length; i++) {
      const c = bytes[i];
      ascii += ((c >= 32 && c <= 126) || c === 10 || c === 13 || c === 9) ? String.fromCharCode(c) : ' ';
    }
    return ascii.replace(/\s+/g, ' ').trim();
  } catch (e) {
    return '';
  }
}

/**
 * Construye el payload para enviar a Gemini, con respaldo de texto si es Word
 */
export async function buildGeminiFilePayload(file) {
  const ext = getFileExt(file.name);
  const mimeType = getMimeTypeFromFile(file);
  const data = await fileToBase64(file);
  const payload = { ext, mimeType, data, fileName: file.name };
  
  if (ext === 'docx') {
    payload.fallbackText = await extractDocxText(file);
  } else if (ext === 'doc') {
    payload.fallbackText = await extractDocBinaryText(file);
  }
  return payload;
}

/**
 * Llama a la Edge Function de Supabase que actúa como proxy de Gemini
 */
export async function callGeminiForEnm(parts) {
  let lastErr = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(SB_FUNC_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SB_KEY}`
        },
        body: JSON.stringify({ parts })
      });
      if (response.status === 503 || response.status === 502) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      return response;
    } catch (e) {
      lastErr = e;
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw lastErr || new Error('Error conectando con proxy Gemini');
}

/**
 * Extrae un objeto JSON válido del texto devuelto por Gemini
 */
export function extractJsonFromGeminiText(text) {
  if (!text) throw new Error('Gemini devolvió respuesta vacía');
  let raw = String(text).trim()
    .replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Gemini no devolvió JSON válido');
  let clean = match[0]
    .replace(/,\s*}/g, '}')
    .replace(/,\s*]/g, ']')
    .replace(/([{,]\s*)(\w+)\s*:/g, '$1"$2":')
    .replace(/\n/g, ' ')
    .trim();
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Intento de recuperación básica
    const tipo = raw.match(/"tipo"\s*:\s*"([^"]+)"/)?.[1] || 'OTRO';
    const num = parseInt(raw.match(/"num"\s*:\s*(\d+)/)?.[1] || '0');
    const fecha = raw.match(/"fecha"\s*:\s*"([^"]+)"/)?.[1] || '';
    const descripcion = raw.match(/"descripcion"\s*:\s*"([^"]+)"/)?.[1] || 'Ver documento';
    const fechaFinNueva = raw.match(/"fechaFinNueva"\s*:\s*"([^"]+)"/)?.[1] || null;
    const fechasV = [...raw.matchAll(/"(\d{4}-\d{2}-\d{2})"/g)].map(m => m[1]);
    return {
      tipo, num, fecha, descripcion, fechaFinNueva,
      fechasVigencia: fechasV.length ? fechasV : null,
      montoAjuste: null, pctAjuste: null, listasDePrecios: []
    };
  }
}

/**
 * Analiza una enmienda con Gemini (usado en importación de PDF/DOCX)
 */
export async function analyzeEnmWithGemini(filePayload, contrato, fileName = '') {
  const prompt = `Sos un asistente experto en contratos de petróleo y gas argentinos. Analizá esta enmienda contractual y devolvé ÚNICAMENTE un objeto JSON válido sin markdown, sin explicaciones.

Contexto del contrato:
- Número: ${contrato.num}
- Contratista: ${contrato.cont}
- Fecha inicio: ${contrato.fechaIni}
- Fecha fin actual: ${contrato.fechaFin}
- Archivo: ${fileName}

Devolvé SOLO este JSON (sin bloques de código, sin texto extra):
{
  "tipo": "EXTENSION" | "ACTUALIZACION_TARIFAS" | "SCOPE" | "CLAUSULAS" | "OTRO",
  "num": número entero de enmienda,
  "fecha": "YYYY-MM-DD",
  "descripcion": "descripción completa de qué modifica esta enmienda en 2-3 oraciones",
  "fechasVigencia": ["YYYY-MM-DD", "YYYY-MM-DD"],
  "fechaFinNueva": "YYYY-MM-DD" o null,
  "montoAjuste": número o null,
  "pctAjuste": número o null,
  "listasDePrecios": [
    {
      "periodo": "YYYY-MM",
      "items": [
        {"item": "código o número", "descripcion": "descripción del ítem", "unidad": "unidad", "precio": número}
      ]
    }
  ]
}`;

  let response = await callGeminiForEnm([{ text: prompt }, { inline_data: { mime_type: filePayload.mimeType, data: filePayload.data } }]);
  
  // Fallback a texto si falla la carga del binario
  if ((!response || !response.ok) && filePayload.fallbackText) {
    console.log('Gemini PDF failed, trying text fallback...');
    response = await callGeminiForEnm([{ text: prompt }, { text: `Contenido del documento:\n\n${filePayload.fallbackText.slice(0, 120000)}` }]);
  }
  
  if (!response || !response.ok) {
    const errText = response ? await response.text().catch(() => '') : '';
    if (response && response.status === 429) throw new Error('Límite de requests alcanzado. Esperá 1 minuto.');
    if (response && response.status === 400) throw new Error('Archivo inválido o muy grande (máx 20MB).');
    throw new Error(`Gemini error ${response ? response.status : 'N/A'}: ${errText.slice(0, 150)}`);
  }
  
  const data = await response.json();
  console.log('Gemini raw:', JSON.stringify(data?.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 500)));
  const finishReason = data?.candidates?.[0]?.finishReason;
  if (finishReason === 'MAX_TOKENS') throw new Error('PDF demasiado grande. Usá el archivo Word (.docx) en su lugar.');
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const txt = parts.map(p => p.text || '').join('\n').trim();
  console.log('Gemini text:', txt.slice(0, 300));
  return extractJsonFromGeminiText(txt);
}

/**
 * Analiza listas de precios en documentos Word/Excel con Gemini
 */
export async function analyzePriceListsWithGemini(filePayload, contrato, fileName = '') {
  const prompt = `Sos un asistente experto en contratos de petróleo y gas argentinos. Extraé únicamente las LISTAS DE PRECIOS o tarifarios base presentes en el documento.

Contexto del contrato:
- Número: ${contrato.num}
- Contratista: ${contrato.cont}
- Archivo: ${fileName}

Devolvé SOLO JSON válido con este esquema exacto:
{
  "listasDePrecios": [
    {
      "periodo": "YYYY-MM" o null,
      "nombre": "nombre corto de la lista" o null,
      "items": [
        {"item": "código o número", "descripcion": "descripción del ítem", "unidad": "unidad", "precio": número o texto numérico}
      ]
    }
  ]
}`;

  let response = await callGeminiForEnm([{ text: prompt }, { inline_data: { mime_type: filePayload.mimeType, data: filePayload.data } }]);
  if ((!response || !response.ok) && filePayload.fallbackText) {
    response = await callGeminiForEnm([{ text: prompt }, { text: `Contenido del documento:\n\n${filePayload.fallbackText.slice(0, 120000)}` }]);
  }
  if (!response || !response.ok) {
    const errText = response ? await response.text().catch(() => '') : '';
    if (response && response.status === 429) throw new Error('Límite de requests alcanzado. Esperá 1 minuto.');
    if (response && response.status === 400) throw new Error('Archivo inválido o demasiado grande para analizar.');
    throw new Error(`IA no disponible ${response ? response.status : 'N/A'}: ${errText.slice(0, 180)}`);
  }
  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const txt = parts.map(p => p.text || '').join('\n').trim();
  return extractJsonFromGeminiText(txt);
}