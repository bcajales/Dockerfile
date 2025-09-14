import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Esta es la lógica de scraping que enviaremos a Browserless para que la ejecute.
const scrapingLogic = `
  async ({ page, url }) => {
    await page.goto(url, { waitUntil: 'networkidle' });

    const data = await page.evaluate(() => {
      const allAttachments = [];
      const processedUrls = new Set();
      const initialUrl = location.href;

      // 1. Scrapear tabla principal
      document.querySelectorAll('table[id*="grvAnexos"] tbody tr').forEach(row => {
        const nombreAnexo = row.querySelector('td:nth-child(1)')?.textContent?.trim();
        const inputDescarga = row.querySelector('input[type="image"]');
        if (nombreAnexo && inputDescarga) {
          const onclickAttr = inputDescarga.getAttribute('onclick');
          const match = onclickAttr?.match(/fn_descargar_anexo_v2\\s*\\(\\s*['"]?(\\d+)['"]?/);
          if (match && match[1]) {
            const idDoc = match[1];
            const idLicitacion = new URL(initialUrl).searchParams.get('idlicitacion');
            const linkDescarga = \`https://www.mercadopublico.cl/Procurement/Modules/RFB/DownloadDoc.aspx?idlic=\${idLicitacion}&idDoc=\${idDoc}\`;
            if (!processedUrls.has(linkDescarga)) {
              allAttachments.push({ nombre: nombreAnexo, url_descarga: linkDescarga });
              processedUrls.add(linkDescarga);
            }
          }
        }
      });
      
      // 2. Buscar link a página dedicada
      const dedicatedPageLink = document.querySelector("a[href*='ViewAttachment.aspx']")?.href;
      
      return { allAttachments, dedicatedPageLink };
    });

    // 3. Si hay página dedicada, ir y scrapear también
    if (data.dedicatedPageLink) {
        await page.goto(data.dedicatedPageLink, { waitUntil: 'networkidle' });
        const dedicatedAttachments = await page.evaluate(() => {
            const attachments = [];
            const initialUrl = location.href;
            document.querySelectorAll('table[id*="grdArchivos"] tbody tr').forEach(row => {
                const nombreAnexo = row.querySelector('td:nth-child(1)')?.textContent?.trim();
                const linkElement = row.querySelector('td:nth-child(3) a');
                if (nombreAnexo && linkElement) {
                    const linkDescarga = new URL(linkElement.href, initialUrl).href;
                    attachments.push({ nombre: nombreAnexo, url_descarga: linkDescarga });
                }
            });
            return attachments;
        });
        // Combinar resultados
        data.allAttachments.push(...dedicatedAttachments);
    }
    
    return data.allAttachments;
  }
`;

async function scrapeWithBrowserlessAPI(url: string, apiKey: string): Promise<any[]> {
    const apiEndpoint = `https://chrome.browserless.io/function?token=${apiKey}`;
    
    console.log(`[BROWSERLESS-API] Enviando trabajo para: ${url}`);
    
    const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: scrapingLogic,
            context: { url: url } // Pasamos la URL a nuestro script remoto
        })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Browserless API falló con status ${response.status}: ${errorText}`);
    }

    return await response.json();
}

async function handler(req: Request): Promise<Response> {
    const apiKey = Deno.env.get("BROWSERLESS_API_KEY");
    if (!apiKey) {
        return new Response(JSON.stringify({ error: "La variable de entorno BROWSERLESS_API_KEY no está definida." }), { status: 500 });
    }

    if (req.method !== 'POST') {
        return new Response("Método no permitido", { status: 405 });
    }

    try {
        const { url } = await req.json();
        if (!url) {
            return new Response(JSON.stringify({ error: 'La URL es requerida' }), { status: 400 });
        }
        const data = await scrapeWithBrowserlessAPI(url, apiKey);
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

const port = Deno.env.get("PORT") ? Number(Deno.env.get("PORT")) : 8000;
console.log(`Servidor de scraping simple listo para recibir peticiones en el puerto ${port}.`);
serve(handler, { port, hostname: "0.0.0.0" });
