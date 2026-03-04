/**
 * copilot-authenticated.js
 * 
 * Interface de chat connectée à l'agent Azure AI Foundry (Agent-Test)
 * via la Function /api/chat.
 * 
 * Remplace l'ancienne iframe Copilot Studio.
 * Réutilise authManager (MSAL) et backendApiConfig déjà présents dans config.js.
 */

class CopilotAuthenticated {
    constructor() {
        this.isInitialized      = false;
        this.previousResponseId = null;  // Continuité de conversation
        this.isWaiting          = false;
        this.userName           = '';
        this.userEmail          = '';
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Initialisation
    // ─────────────────────────────────────────────────────────────────────────

    async initialize() {
        try {
            if (!authManager.isSignedIn()) {
                throw new Error('Utilisateur non connecté');
            }

            const account   = authManager.getAccount();
            this.userEmail  = account.username;
            this.userName   = account.name || account.username.split('@')[0];

            console.log('🤖 Initialisation chat Foundry pour', this.userEmail);

            this.renderChatUI();

            this.isInitialized = true;
            console.log('✅ Chat Foundry prêt');

        } catch (error) {
            console.error('❌ Erreur initialisation chat Foundry :', error);
            this._showFatalError(error.message);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Rendu de l'interface
    // ─────────────────────────────────────────────────────────────────────────

    renderChatUI() {
        const container = document.getElementById('copilot-webchat');
        if (!container) return;

        container.style.cssText = 'height:600px; min-height:600px; position:relative;';

        container.innerHTML = `
            <div id="foundry-chat-wrapper" style="
                display        : flex;
                flex-direction : column;
                height         : 100%;
                font-family    : 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                background     : #ffffff;
                border-radius  : 8px;
                overflow       : hidden;
                box-shadow     : 0 2px 8px rgba(0,0,0,0.12);
            ">
                <!-- ── HEADER ── -->
                <div id="chat-header" style="
                    background  : linear-gradient(135deg, #0078d4 0%, #106ebe 100%);
                    color       : #ffffff;
                    padding     : 0.85rem 1rem;
                    display     : flex;
                    align-items : center;
                    gap         : 0.75rem;
                    flex-shrink : 0;
                ">
                    <div style="
                        width           : 38px;
                        height          : 38px;
                        background      : rgba(255,255,255,0.18);
                        border-radius   : 50%;
                        display         : flex;
                        align-items     : center;
                        justify-content : center;
                        font-size       : 1.3rem;
                        flex-shrink     : 0;
                    ">🤖</div>

                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:600; font-size:1rem;">Assistant Babilou</div>
                        <div style="font-size:0.78rem; opacity:0.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                            Connecté : ${this._escapeHtml(this.userName)}
                        </div>
                    </div>

                    <!-- Bouton nouvelle conversation -->
                    <button
                        onclick="copilotAuthenticated.resetConversation()"
                        title="Démarrer une nouvelle conversation"
                        style="
                            background    : rgba(255,255,255,0.15);
                            border        : 1px solid rgba(255,255,255,0.3);
                            color         : #ffffff;
                            padding       : 0.35rem 0.75rem;
                            border-radius : 20px;
                            cursor        : pointer;
                            font-size     : 0.8rem;
                            white-space   : nowrap;
                            transition    : background 0.2s;
                        "
                        onmouseover="this.style.background='rgba(255,255,255,0.25)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.15)'"
                    >🔄 Nouveau</button>
                </div>

                <!-- ── MESSAGES ── -->
                <div id="chat-messages" style="
                    flex        : 1;
                    overflow-y  : auto;
                    padding     : 1rem;
                    background  : #f5f5f5;
                    display     : flex;
                    flex-direction : column;
                    gap         : 0.6rem;
                    scroll-behavior : smooth;
                ">
                    <!-- Message de bienvenue -->
                    <div style="
                        text-align  : center;
                        color       : #666;
                        font-size   : 0.82rem;
                        padding     : 0.5rem 1rem;
                        background  : #efefef;
                        border-radius : 12px;
                        align-self  : center;
                        max-width   : 85%;
                    ">
                        👋 Bonjour <strong>${this._escapeHtml(this.userName)}</strong> !<br>
                        Comment puis-je vous aider aujourd'hui ?
                    </div>
                </div>

                <!-- ── INDICATEUR DE FRAPPE ── -->
                <div id="chat-typing" style="
                    display     : none;
                    padding     : 0.4rem 1rem;
                    font-size   : 0.82rem;
                    color       : #666;
                    font-style  : italic;
                    background  : #f5f5f5;
                    border-top  : 1px solid #e8e8e8;
                    flex-shrink : 0;
                ">✍️ L'assistant rédige une réponse…</div>

                <!-- ── ZONE DE SAISIE ── -->
                <div id="chat-input-area" style="
                    display       : flex;
                    gap           : 0.5rem;
                    padding       : 0.75rem;
                    background    : #ffffff;
                    border-top    : 1px solid #e0e0e0;
                    flex-shrink   : 0;
                    align-items   : flex-end;
                ">
                    <textarea
                        id="chat-input"
                        placeholder="Posez votre question… (Entrée pour envoyer, Maj+Entrée pour sauter une ligne)"
                        rows="1"
                        style="
                            flex          : 1;
                            padding       : 0.6rem 0.9rem;
                            border        : 1.5px solid #ccc;
                            border-radius : 20px;
                            resize        : none;
                            font-family   : inherit;
                            font-size     : 0.92rem;
                            line-height   : 1.4;
                            max-height    : 120px;
                            overflow-y    : auto;
                            outline       : none;
                            transition    : border-color 0.2s;
                        "
                        onfocus="this.style.borderColor='#0078d4'"
                        onblur="this.style.borderColor='#ccc'"
                        onkeydown="
                            if (event.key === 'Enter' && !event.shiftKey) {
                                event.preventDefault();
                                copilotAuthenticated.sendFromInput();
                            }
                            // Auto-resize
                            setTimeout(() => {
                                this.style.height = 'auto';
                                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
                            }, 0);
                        "
                    ></textarea>

                    <button
                        id="chat-send-btn"
                        onclick="copilotAuthenticated.sendFromInput()"
                        title="Envoyer"
                        style="
                            background      : #0078d4;
                            color           : #ffffff;
                            border          : none;
                            border-radius   : 50%;
                            width           : 40px;
                            height          : 40px;
                            cursor          : pointer;
                            font-size       : 1rem;
                            flex-shrink     : 0;
                            display         : flex;
                            align-items     : center;
                            justify-content : center;
                            transition      : background 0.2s, transform 0.1s;
                        "
                        onmouseover="this.style.background='#106ebe'"
                        onmouseout="this.style.background='#0078d4'"
                        onmousedown="this.style.transform='scale(0.93)'"
                        onmouseup="this.style.transform='scale(1)'"
                    >➤</button>
                </div>
            </div>
        `;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Envoi d'un message
    // ─────────────────────────────────────────────────────────────────────────

    async sendFromInput() {
        const input = document.getElementById('chat-input');
        if (!input) return;

        const message = input.value.trim();
        if (!message || this.isWaiting) return;

        // Réinitialiser la textarea
        input.value = '';
        input.style.height = 'auto';

        await this.sendMessage(message);
    }

    async sendMessage(message) {
        if (this.isWaiting) return;
        this.isWaiting = true;

        // Afficher le message utilisateur immédiatement
        this._appendMessage('user', message);

        // Afficher l'indicateur de frappe
        const typingEl  = document.getElementById('chat-typing');
        const sendBtn   = document.getElementById('chat-send-btn');
        const inputEl   = document.getElementById('chat-input');

        if (typingEl)  typingEl.style.display  = 'block';
        if (sendBtn)   sendBtn.disabled = true;
        if (inputEl)   inputEl.disabled = true;

        try {
            // Récupérer le token backend (scope App Registration #2)
            const token = await authManager.getAccessToken(backendApiConfig.scopes);

            if (!token) {
                throw new Error('Impossible d\'obtenir le token d\'authentification.');
            }

            const response = await fetch('/api/chat', {
                method : 'POST',
                headers: {
                    'Content-Type' : 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message           : message,
                    previousResponseId: this.previousResponseId
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `Erreur HTTP ${response.status}`);
            }

            // Mémoriser l'ID pour la prochaine requête (continuité)
            if (data.responseId) {
                this.previousResponseId = data.responseId;
            }

            this._appendMessage('assistant', data.response);

        } catch (error) {
            console.error('❌ Erreur envoi message :', error);
            this._appendMessage('error', `Erreur : ${error.message}`);
        } finally {
            this.isWaiting = false;
            if (typingEl)  typingEl.style.display  = 'none';
            if (sendBtn)   sendBtn.disabled = false;
            if (inputEl) {
                inputEl.disabled = false;
                inputEl.focus();
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Réinitialiser la conversation
    // ─────────────────────────────────────────────────────────────────────────

    resetConversation() {
        this.previousResponseId = null;

        const messages = document.getElementById('chat-messages');
        if (messages) {
            messages.innerHTML = `
                <div style="
                    text-align    : center;
                    color         : #666;
                    font-size     : 0.82rem;
                    padding       : 0.5rem 1rem;
                    background    : #efefef;
                    border-radius : 12px;
                    align-self    : center;
                    max-width     : 85%;
                ">
                    🔄 Nouvelle conversation démarrée.<br>Comment puis-je vous aider ?
                </div>
            `;
        }

        const input = document.getElementById('chat-input');
        if (input) input.focus();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers privés
    // ─────────────────────────────────────────────────────────────────────────

    _appendMessage(role, text) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const isUser      = role === 'user';
        const isError     = role === 'error';
        const isAssistant = role === 'assistant';

        // Bulle
        const bubble = document.createElement('div');

        let bgColor, textColor, borderRadius, margin, borderStyle;

        if (isUser) {
            bgColor      = '#0078d4';
            textColor    = '#ffffff';
            borderRadius = '18px 18px 4px 18px';
            margin       = '0 0 0 20%';
            borderStyle  = 'none';
        } else if (isError) {
            bgColor      = '#fde7e9';
            textColor    = '#a4262c';
            borderRadius = '18px 18px 18px 4px';
            margin       = '0 20% 0 0';
            borderStyle  = '1px solid #f1b8bc';
        } else {
            bgColor      = '#ffffff';
            textColor    = '#323130';
            borderRadius = '18px 18px 18px 4px';
            margin       = '0 20% 0 0';
            borderStyle  = '1px solid #e0e0e0';
        }

        bubble.style.cssText = `
            background    : ${bgColor};
            color         : ${textColor};
            border-radius : ${borderRadius};
            margin        : ${margin};
            border        : ${borderStyle};
            padding       : 0.65rem 1rem;
            font-size     : 0.92rem;
            line-height   : 1.55;
            word-wrap     : break-word;
            white-space   : pre-wrap;
            box-shadow    : 0 1px 3px rgba(0,0,0,0.08);
            max-width     : 100%;
        `;

        // Convertir les sauts de ligne markdown basiques
        bubble.textContent = text;

        container.appendChild(bubble);

        // Scroll automatique vers le bas
        container.scrollTop = container.scrollHeight;
    }

    _escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    _showFatalError(message) {
        const container = document.getElementById('copilot-webchat');
        if (!container) return;
        container.innerHTML = `
            <div style="
                padding         : 2rem;
                text-align      : center;
                color           : #a4262c;
                background      : #fde7e9;
                border-radius   : 8px;
                border          : 1px solid #f1b8bc;
                font-family     : 'Segoe UI', sans-serif;
            ">
                <div style="font-size:2rem; margin-bottom:0.75rem;">⚠️</div>
                <h4 style="margin:0 0 0.5rem 0;">Impossible de charger l'assistant</h4>
                <p style="margin:0 0 1rem 0; font-size:0.9rem;">${this._escapeHtml(message)}</p>
                <button
                    onclick="location.reload()"
                    style="
                        padding       : 0.5rem 1.5rem;
                        background    : #0078d4;
                        color         : white;
                        border        : none;
                        border-radius : 6px;
                        cursor        : pointer;
                        font-size     : 0.9rem;
                    "
                >Recharger la page</button>
            </div>
        `;
    }
}

// Instance globale (utilisée par app.js et les onclick inline)
const copilotAuthenticated = new CopilotAuthenticated();