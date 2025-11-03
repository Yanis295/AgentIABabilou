/**
 * Intégration Copilot avec authentification via Azure Function OBO
 * ARCHITECTURE 2 APP REGISTRATIONS
 */

class CopilotAuthenticated {
    constructor() {
        this.isInitialized = false;
        this.conversationId = null;
        
        this.config = {
            environmentId: '308d8cf6-baa8-eba2-8a15-8afc891fddf9',
            botId: 'cr288_chatbotAgentIaBabilou',
            apiEndpoint: 'https://308d8cf6baa8eba28a158afc891fdd.f9.environment.api.powerplatform.com',
            apiVersion: '2022-03-01-preview',
            oboEndpoint: '/api/get-powerplatform-token'
        };
    }

    async initialize() {
        try {
            console.log("🤖 === INITIALISATION COPILOT (OBO - 2 APPS) ===");
            console.log("   App #1 (Frontend):", msalConfig.auth.clientId);
            console.log("   App #2 (Backend):", backendApiConfig.backendClientId);

            if (!window.WebChat) {
                throw new Error("Bot Framework Web Chat SDK n'est pas chargé");
            }

            if (!authManager.isSignedIn()) {
                throw new Error("Utilisateur non connecté");
            }

            console.log("✅ Web Chat SDK chargé");
            console.log("✅ Utilisateur connecté");

            const accessToken = await this.getAccessTokenViaOBO();
            if (!accessToken) {
                throw new Error("Impossible d'obtenir le token Power Platform");
            }

            console.log("✅ Token Power Platform obtenu via OBO");

            await this.createConversation(accessToken);
            console.log("✅ Conversation créée:", this.conversationId);

            await this.initializeWebChat(accessToken);

            this.isInitialized = true;
            console.log("✅ === COPILOT INITIALISÉ AVEC SUCCÈS ===");

        } catch (error) {
            console.error("❌ === ERREUR INITIALISATION COPILOT ===");
            console.error(error);
            this.showError(error.message);
        }
    }

    async getAccessTokenViaOBO() {
        try {
            console.log("🔑 === RÉCUPÉRATION TOKEN VIA OBO (2 APPS) ===");
            console.log("📍 Endpoint OBO:", this.config.oboEndpoint);
            
            console.log("⏳ Récupération du token pour le backend (App #2)...");
            console.log("   Scope demandé:", backendApiConfig.scopes[0]);
            
            // ⚠️ CRITIQUE : Demander un token pour App #2 (Backend)
            const userToken = await authManager.getAccessToken(
                backendApiConfig.scopes,  // ⬅️ Scope pour App #2
                true // forceRefresh
            );
            
            if (!userToken) {
                throw new Error("Impossible d'obtenir le token backend");
            }
            
            console.log("✅ Token backend obtenu");
            console.log(`   Preview: ${userToken.substring(0, 50)}...`);
            
            // Décoder et vérifier l'audience
            const decoded = this.decodeJWT(userToken);
            if (decoded) {
                console.log("🔍 === VÉRIFICATION TOKEN ===");
                console.log("   Audience (aud):", decoded.payload.aud);
                console.log("   Scopes (scp):", decoded.payload.scp);
                console.log("   Version (ver):", decoded.payload.ver);
                console.log("   Issuer (iss):", decoded.payload.iss);
                
                // Vérifier que l'audience est correcte
                const expectedAud = `api://${backendApiConfig.backendClientId}`;
                if (decoded.payload.aud === expectedAud) {
                    console.log("✅ Audience CORRECTE !");
                    console.log("   Attendu:", expectedAud);
                    console.log("   Reçu:", decoded.payload.aud);
                } else {
                    console.warn("⚠️  AUDIENCE INCORRECTE !");
                    console.warn("   Attendu:", expectedAud);
                    console.warn("   Reçu:", decoded.payload.aud);
                    console.warn("   Vérifiez que backendApiConfig.backendClientId est correct");
                }
            }
            
            console.log("⏳ Appel à l'Azure Function OBO...");
            
            const response = await fetch(this.config.oboEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                }
            });

            console.log("📡 Réponse reçue:", response.status, response.statusText);

            if (!response.ok) {
                let errorMessage;
                
                try {
                    const errorData = await response.json();
                    console.error("❌ Erreur API (JSON):", errorData);
                    errorMessage = errorData.error || errorData.message || `Erreur HTTP ${response.status}`;
                    
                    // Aide au dépannage
                    if (response.status === 500) {
                        console.error("");
                        console.error("💡 Erreur 500 - Vérifications :");
                        console.error("   1. Variables d'environnement Azure Static Web App");
                        console.error("      - AZURE_CLIENT_ID = d0e218fc-521d-443c-b1b3-0c5036834111");
                        console.error("      - AZURE_CLIENT_SECRET = [Votre secret]");
                        console.error("      - AZURE_TENANT_ID = ee7b4ccb-8e30-435c-9368-1fce958df645");
                        console.error("   2. Client Secret valide et non expiré");
                        console.error("   3. Permissions Power Platform accordées à App #2");
                        console.error("   4. Admin consent accordé");
                    }
                } catch (jsonError) {
                    const errorText = await response.text();
                    console.error("❌ Erreur API (Texte brut):", errorText);
                    errorMessage = errorText || `Erreur HTTP ${response.status}`;
                }
                
                throw new Error(errorMessage);
            }

            const data = await response.json();
            
            if (!data.success || !data.token) {
                throw new Error("Réponse OBO invalide");
            }

            console.log("✅ Token Power Platform reçu !");
            if (data.scopes) console.log("   Scopes:", data.scopes);
            if (data.expiresOn) console.log("   Expire:", new Date(data.expiresOn).toLocaleString());
            console.log(`   Preview: ${data.token.substring(0, 50)}...`);
            
            console.log("✅ === FIN RÉCUPÉRATION TOKEN OBO - SUCCÈS ===");
            
            return data.token;

        } catch (error) {
            console.error("❌ === ERREUR RÉCUPÉRATION TOKEN OBO ===");
            console.error("Type:", error.constructor.name);
            console.error("Message:", error.message);
            
            if (error.stack) {
                console.error("Stack:", error.stack);
            }
            
            throw new Error(`Impossible d'obtenir le token: ${error.message}`);
        }
    }

    /**
     * Décoder un JWT (sans vérifier la signature)
     */
    decodeJWT(token) {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;
            
            // Remplacer les caractères URL-safe
            const base64Url = parts[1];
            const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
            
            const payload = JSON.parse(atob(base64));
            
            const headerBase64 = parts[0].replace(/-/g, '+').replace(/_/g, '/');
            const header = JSON.parse(atob(headerBase64));
            
            return { header, payload };
        } catch (error) {
            console.error("Erreur décodage JWT:", error);
            return null;
        }
    }

    async createConversation(accessToken) {
        try {
            const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations`;
            const params = new URLSearchParams({
                'api-version': this.config.apiVersion
            });

            console.log("📞 Création de la conversation...");
            console.log("   URL:", `${conversationUrl}?${params}`);

            const response = await fetch(`${conversationUrl}?${params}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    locale: 'fr-FR'
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error("❌ Erreur API:", response.status, errorText);
                throw new Error(`Erreur HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            this.conversationId = data.conversationId;

            console.log("✅ Conversation créée avec succès");
            console.log("   Conversation ID:", this.conversationId);

        } catch (error) {
            console.error("❌ Erreur lors de la création de la conversation:", error);
            throw error;
        }
    }

    async initializeWebChat(accessToken) {
        try {
            console.log("🎨 Initialisation du Web Chat...");
            
            const directLine = this.createPowerPlatformAdapter(accessToken);
            const account = authManager.getAccount();

            const styleOptions = {
                accent: '#0078d4',
                backgroundColor: 'White',
                botAvatarInitials: 'AB',
                botAvatarBackgroundColor: '#0078d4',
                userAvatarInitials: this.getInitials(account.name),
                userAvatarBackgroundColor: '#764ba2',
                bubbleBackground: '#f3f2f1',
                bubbleBorderRadius: 8,
                bubbleFromUserBackground: '#0078d4',
                bubbleFromUserBorderRadius: 8,
                bubbleFromUserTextColor: 'White',
                hideUploadButton: true,
                primaryFont: 'Segoe UI, sans-serif',
                sendBoxBackground: 'White',
                sendBoxButtonColor: '#0078d4',
                sendBoxTextColor: '#000000'
            };

            window.WebChat.renderWebChat(
                {
                    directLine: directLine,
                    userID: account.localAccountId,
                    username: account.name,
                    locale: 'fr-FR',
                    styleOptions: styleOptions
                },
                document.getElementById('copilot-webchat')
            );

            console.log("✅ Web Chat initialisé");

        } catch (error) {
            console.error("❌ Erreur lors de l'initialisation du Web Chat:", error);
            throw error;
        }
    }

    createPowerPlatformAdapter(accessToken) {
        const conversationUrl = `${this.config.apiEndpoint}/copilotstudio/dataverse-backed/authenticated/bots/${this.config.botId}/conversations/${this.conversationId}`;
        
        console.log("🔌 Création de l'adaptateur Direct Line");
        console.log("   URL:", conversationUrl);
        
        return window.WebChat.createDirectLine({
            domain: conversationUrl,
            token: accessToken,
            webSocket: false
        });
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    showError(message) {
        const container = document.getElementById('copilot-webchat');
        if (container) {
            container.innerHTML = `
                <div style="padding: 2rem; text-align: center;">
                    <div style="color: #a4262c; margin-bottom: 1rem;">
                        <h4 style="margin: 0 0 0.5rem 0;">❌ Erreur de chargement du Copilot</h4>
                        <p style="margin: 0; font-size: 0.9rem;">${message}</p>
                    </div>
                    <div style="background: #f3f2f1; padding: 1rem; border-radius: 4px; font-size: 0.85rem; color: #605e5c;">
                        <p style="margin: 0;"><strong>Vérifications :</strong></p>
                        <ul style="text-align: left; margin: 0.5rem 0 0 0; padding-left: 1.5rem;">
                            <li>App #1 a la permission vers App #2</li>
                            <li>Admin consent accordé</li>
                            <li>Variables d'environnement Azure Static Web App configurées</li>
                            <li>Client Secret valide (App #2)</li>
                            <li>Permissions Power Platform accordées à App #2</li>
                            <li>Cache navigateur effacé (Ctrl+Shift+Del)</li>
                            <li>Vérifiez la console (F12) pour les détails</li>
                        </ul>
                    </div>
                    <button onclick="sessionStorage.clear(); localStorage.clear(); location.reload();" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #0078d4; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Effacer le cache et recharger
                    </button>
                </div>
            `;
        }
    }
}

// Instance globale
const copilotAuthenticated = new CopilotAuthenticated();
