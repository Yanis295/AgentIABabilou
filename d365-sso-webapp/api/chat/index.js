/**
 * Azure Function - /api/chat
 * 
 * Relie l'interface web à l'agent Azure AI Foundry (Agent-Test)
 * via la Responses API avec agent_reference.
 * 
 * Flux :
 *   Frontend (MSAL token) → cette Function → Foundry Responses API → réponse texte
 * 
 * Variables d'environnement requises (à configurer dans Azure Static Web App) :
 *   FOUNDRY_PROJECT_ENDPOINT  = https://test-facture.services.ai.azure.com/api/projects/test
 *   FOUNDRY_AGENT_NAME        = Agent-Test
 *   FOUNDRY_AGENT_VERSION     = 2
 *   FOUNDRY_MODEL_NAME        = gpt-4.1
 */

const { DefaultAzureCredential } = require('@azure/identity');

// ─── Cache du token Foundry ─────────────────────────────────────────────────
let _cachedToken   = null;
let _tokenExpiry   = null;

async function getFoundryToken() {
    const now = Date.now();
    // Renouveler si absent ou expire dans moins de 5 minutes
    if (_cachedToken && _tokenExpiry && now < _tokenExpiry - 300_000) {
        return _cachedToken;
    }
    const credential = new DefaultAzureCredential();
    const tokenResponse = await credential.getToken('https://ai.azure.com/.default');
    _cachedToken  = tokenResponse.token;
    _tokenExpiry  = tokenResponse.expiresOnTimestamp;
    return _cachedToken;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Extrait l'email utilisateur du token MSAL passé en Authorization header.
 * Ne bloque pas si le token est absent ou malformé.
 */
function extractUserEmail(authHeader) {
    try {
        if (!authHeader || !authHeader.startsWith('Bearer ')) return 'Utilisateur inconnu';
        const base64Payload = authHeader.split('.')[1];
        const payload = JSON.parse(Buffer.from(base64Payload, 'base64').toString('utf-8'));
        return payload.preferred_username || payload.email || payload.upn || 'Utilisateur';
    } catch {
        return 'Utilisateur inconnu';
    }
}

/**
 * Extrait le texte de la réponse Foundry, quel que soit le format retourné.
 */
function extractOutputText(data) {
    // Format direct (output_text)
    if (data.output_text) return data.output_text;

    // Format tableau output[]
    if (Array.isArray(data.output)) {
        const texts = data.output
            .filter(o => o.type === 'message')
            .flatMap(o => (Array.isArray(o.content) ? o.content : []))
            .filter(c => c.type === 'output_text' || c.type === 'text')
            .map(c => c.text || c.value || '');
        if (texts.length) return texts.join('\n');
    }

    // Fallback : choices (format OpenAI Chat Completions)
    if (Array.isArray(data.choices) && data.choices.length) {
        return data.choices[0]?.message?.content || '';
    }

    return "Je n'ai pas pu générer de réponse. Veuillez réessayer.";
}

// ─── Handler principal ───────────────────────────────────────────────────────
module.exports = async function (context, req) {

    const CORS_HEADERS = {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type'                : 'application/json'
    };

    // Répondre au preflight CORS
    if (req.method === 'OPTIONS') {
        context.res = { status: 200, headers: CORS_HEADERS, body: '' };
        return;
    }

    // ── 1. Validation du body ────────────────────────────────────────────────
    const { message, previousResponseId } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
        context.res = {
            status : 400,
            headers: CORS_HEADERS,
            body   : { success: false, error: 'Le champ "message" est requis et ne peut pas être vide.' }
        };
        return;
    }

    // ── 2. Infos utilisateur (logs seulement, pas bloquant) ─────────────────
    const userEmail = extractUserEmail(req.headers['authorization']);
    context.log(`💬 [${userEmail}] → "${message.substring(0, 80)}${message.length > 80 ? '…' : ''}"`);
    if (previousResponseId) {
        context.log(`🔗 Suite de conversation (previous_response_id: ${previousResponseId})`);
    }

    // ── 3. Vérification des variables d'environnement ────────────────────────
    const ENDPOINT     = process.env.FOUNDRY_PROJECT_ENDPOINT;
    const AGENT_NAME   = process.env.FOUNDRY_AGENT_NAME    || 'Agent-Test';
    const AGENT_VER    = process.env.FOUNDRY_AGENT_VERSION  || '2';
    const MODEL_NAME   = process.env.FOUNDRY_MODEL_NAME     || 'gpt-4.1';

    if (!ENDPOINT) {
        context.log.error('❌ Variable FOUNDRY_PROJECT_ENDPOINT manquante !');
        context.res = {
            status : 500,
            headers: CORS_HEADERS,
            body   : { success: false, error: 'Configuration serveur incomplète (FOUNDRY_PROJECT_ENDPOINT manquant).' }
        };
        return;
    }

    // ── 4. Construction du body Responses API ────────────────────────────────
    const requestBody = {
        model : MODEL_NAME,
        input : [{ role: 'user', content: message.trim() }],
        extra_body: {
            agent: {
                name   : AGENT_NAME,
                version: AGENT_VER,
                type   : 'agent_reference'
            }
        }
    };

    // Continuité de conversation
    if (previousResponseId && typeof previousResponseId === 'string') {
        requestBody.previous_response_id = previousResponseId;
    }

    // ── 5. Appel Foundry ─────────────────────────────────────────────────────
    let foundryResponse;
    try {
        const token = await getFoundryToken();
        const url   = `${ENDPOINT}/openai/v1/responses`;

        context.log(`📡 POST ${url}  agent=${AGENT_NAME} v${AGENT_VER}`);

        const httpResponse = await fetch(url, {
            method : 'POST',
            headers: {
                'Content-Type' : 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(requestBody)
        });

        // Lire la réponse brute
        const rawText = await httpResponse.text();

        if (!httpResponse.ok) {
            context.log.error(`❌ Foundry HTTP ${httpResponse.status}: ${rawText}`);
            throw new Error(`Foundry API a répondu avec le code ${httpResponse.status}`);
        }

        foundryResponse = JSON.parse(rawText);

    } catch (err) {
        context.log.error('❌ Erreur lors de l\'appel Foundry :', err.message);
        context.res = {
            status : 502,
            headers: CORS_HEADERS,
            body   : {
                success: false,
                error  : 'Impossible de joindre l\'agent. Veuillez réessayer dans quelques secondes.',
                detail : err.message
            }
        };
        return;
    }

    // ── 6. Extraction et retour ──────────────────────────────────────────────
    const responseText = extractOutputText(foundryResponse);
    const responseId   = foundryResponse.id || null;

    context.log(`✅ Réponse OK  response_id=${responseId}  longueur=${responseText.length} chars`);

    context.res = {
        status : 200,
        headers: CORS_HEADERS,
        body   : {
            success           : true,
            response          : responseText,
            responseId        : responseId   // Renvoyé au frontend pour la continuité
        }
    };
};