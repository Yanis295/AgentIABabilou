/**
 * Gestionnaire du contexte Dynamics 365
 *
 * Ce module détecte et gère le contexte D365 lorsque la page est intégrée
 * dans un iframe de Dynamics 365 Customer Service
 */

class D365ContextManager {
    constructor() {
        this.isInD365 = false;
        this.isInIframe = false;
        this.xrmContext = null;
        this.orgUrl = null;
        this.userId = null;
        this.orgName = null;
        this.userRoles = [];
        this.isInitialized = false;
        this.contextCallbacks = {
            onContextLoaded: [],
            onError: []
        };
    }

    /**
     * Initialise et détecte le contexte D365
     */
    async initialize() {
        try {
            console.log("Détection du contexte Dynamics 365...");

            // Vérifier si on est dans un iframe
            this.isInIframe = this.checkIfInIframe();
            console.log("Dans un iframe:", this.isInIframe);

            // Vérifier si Xrm est disponible (contexte D365)
            await this.checkXrmContext();

            // Extraire les paramètres de l'URL
            this.extractUrlParameters();

            this.isInitialized = true;
            console.log("Contexte D365 initialisé:", {
                isInD365: this.isInD365,
                isInIframe: this.isInIframe,
                orgUrl: this.orgUrl
            });

            this.triggerContextLoadedCallbacks();
            return true;
        } catch (error) {
            console.error("Erreur lors de l'initialisation du contexte D365:", error);
            this.triggerErrorCallbacks(error);
            return false;
        }
    }

    /**
     * Vérifie si la page est dans un iframe
     */
    checkIfInIframe() {
        try {
            return window.self !== window.top;
        } catch (e) {
            // Si on ne peut pas accéder à window.top (CORS), on est probablement dans un iframe
            return true;
        }
    }

    /**
     * Vérifie et récupère le contexte Xrm de D365
     */
    async checkXrmContext() {
        // Vérifier si Xrm est disponible dans la fenêtre actuelle
        if (typeof window.Xrm !== 'undefined') {
            console.log("Xrm détecté dans la fenêtre actuelle");
            this.isInD365 = true;
            await this.loadXrmContext(window.Xrm);
            return true;
        }

        // Vérifier si on est dans un iframe et si parent.Xrm est disponible
        if (this.isInIframe) {
            try {
                if (typeof window.parent.Xrm !== 'undefined') {
                    console.log("Xrm détecté dans la fenêtre parent");
                    this.isInD365 = true;
                    await this.loadXrmContext(window.parent.Xrm);
                    return true;
                }
            } catch (e) {
                console.log("Impossible d'accéder à parent.Xrm (CORS):", e.message);
            }
        }

        // Essayer de charger Xrm via getGlobalContext (ancienne méthode)
        try {
            if (typeof GetGlobalContext !== 'undefined') {
                const context = GetGlobalContext();
                console.log("Contexte global D365 trouvé");
                this.isInD365 = true;
                this.xrmContext = context;
                await this.extractContextInfo(context);
                return true;
            }
        } catch (e) {
            console.log("GetGlobalContext non disponible:", e.message);
        }

        console.log("Xrm non détecté - pas dans un contexte D365");
        return false;
    }

    /**
     * Charge le contexte Xrm
     */
    async loadXrmContext(xrm) {
        try {
            this.xrmContext = xrm.Page ? xrm.Page.context : xrm.Utility.getGlobalContext();
            await this.extractContextInfo(this.xrmContext);
        } catch (error) {
            console.error("Erreur lors du chargement du contexte Xrm:", error);
            throw error;
        }
    }

    /**
     * Extrait les informations du contexte D365
     */
    async extractContextInfo(context) {
        try {
            // URL de l'organisation
            if (context.getClientUrl) {
                this.orgUrl = context.getClientUrl();
                console.log("URL de l'organisation:", this.orgUrl);
            }

            // ID de l'utilisateur
            if (context.getUserId) {
                this.userId = context.getUserId();
                console.log("ID utilisateur:", this.userId);
            }

            // Nom de l'organisation
            if (context.getOrgUniqueName) {
                this.orgName = context.getOrgUniqueName();
                console.log("Nom de l'organisation:", this.orgName);
            }

            // Rôles de l'utilisateur
            if (context.getUserRoles) {
                this.userRoles = context.getUserRoles();
                console.log("Rôles utilisateur:", this.userRoles);
            }

            return true;
        } catch (error) {
            console.error("Erreur lors de l'extraction des informations du contexte:", error);
            return false;
        }
    }

    /**
     * Extrait les paramètres de l'URL
     */
    extractUrlParameters() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const params = {};

            // Paramètres communs de D365
            const d365Params = ['data', 'typename', 'id', 'orgname', 'userlcid', 'orglcid'];

            d365Params.forEach(param => {
                if (urlParams.has(param)) {
                    params[param] = urlParams.get(param);
                }
            });

            if (Object.keys(params).length > 0) {
                console.log("Paramètres D365 détectés:", params);

                // Si on a l'orgname dans l'URL mais pas encore chargé
                if (params.orgname && !this.orgName) {
                    this.orgName = params.orgname;
                }

                return params;
            }

            return null;
        } catch (error) {
            console.error("Erreur lors de l'extraction des paramètres URL:", error);
            return null;
        }
    }

    /**
     * Récupère les informations de l'enregistrement actuel (si applicable)
     */
    getCurrentRecord() {
        try {
            if (!this.isInD365 || !this.xrmContext) {
                return null;
            }

            // Essayer d'accéder aux données via Xrm.Page (formulaires)
            if (typeof window.Xrm !== 'undefined' && window.Xrm.Page && window.Xrm.Page.data) {
                const entity = window.Xrm.Page.data.entity;
                return {
                    id: entity.getId(),
                    entityName: entity.getEntityName(),
                    isDirty: entity.getIsDirty()
                };
            }

            return null;
        } catch (error) {
            console.error("Erreur lors de la récupération de l'enregistrement actuel:", error);
            return null;
        }
    }

    /**
     * Appelle l'API Web de D365
     */
    async callD365WebApi(entitySetName, entityId = null, options = {}) {
        try {
            if (!this.isInD365 || !this.xrmContext) {
                throw new Error("Pas dans un contexte D365");
            }

            // Vérifier si Xrm.WebApi est disponible
            if (typeof window.Xrm === 'undefined' || !window.Xrm.WebApi) {
                throw new Error("Xrm.WebApi non disponible");
            }

            const webApi = window.Xrm.WebApi;

            // Récupérer une entité
            if (entityId) {
                console.log(`Récupération de ${entitySetName}(${entityId})`);
                const entity = await webApi.retrieveRecord(
                    entitySetName,
                    entityId,
                    options.select
                );
                return entity;
            }

            // Récupérer plusieurs entités
            console.log(`Récupération de ${entitySetName}`);
            const result = await webApi.retrieveMultipleRecords(
                entitySetName,
                options.query
            );
            return result;
        } catch (error) {
            console.error("Erreur lors de l'appel à l'API Web D365:", error);
            throw error;
        }
    }

    /**
     * Ouvre un formulaire D365
     */
    openForm(entityName, entityId = null, options = {}) {
        try {
            if (!this.isInD365) {
                console.warn("Pas dans un contexte D365, impossible d'ouvrir le formulaire");
                return;
            }

            if (typeof window.Xrm === 'undefined' || !window.Xrm.Navigation) {
                console.error("Xrm.Navigation non disponible");
                return;
            }

            const entityFormOptions = {
                entityName: entityName,
                entityId: entityId,
                ...options
            };

            window.Xrm.Navigation.openForm(entityFormOptions);
        } catch (error) {
            console.error("Erreur lors de l'ouverture du formulaire:", error);
            this.triggerErrorCallbacks(error);
        }
    }

    /**
     * Affiche une notification dans D365
     */
    showNotification(message, level = 'INFO', timeout = 5000) {
        try {
            if (!this.isInD365) {
                console.log(`[Notification] ${message}`);
                return;
            }

            if (typeof window.Xrm === 'undefined' || !window.Xrm.App) {
                console.log(`[Notification] ${message}`);
                return;
            }

            // Niveaux: SUCCESS, ERROR, WARNING, INFO
            window.Xrm.App.addGlobalNotification({
                type: 2, // Toast notification
                level: level === 'ERROR' ? 4 : level === 'WARNING' ? 3 : level === 'SUCCESS' ? 1 : 2,
                message: message,
                showCloseButton: true,
                timeout: timeout
            });
        } catch (error) {
            console.error("Erreur lors de l'affichage de la notification:", error);
            console.log(`[Notification] ${message}`);
        }
    }

    /**
     * Obtient les informations complètes du contexte
     */
    getContextInfo() {
        return {
            isInD365: this.isInD365,
            isInIframe: this.isInIframe,
            orgUrl: this.orgUrl,
            userId: this.userId,
            orgName: this.orgName,
            userRoles: this.userRoles,
            hasXrmContext: this.xrmContext !== null
        };
    }

    // ========== Gestion des callbacks ==========

    /**
     * Enregistre un callback pour l'événement de chargement du contexte
     */
    onContextLoaded(callback) {
        this.contextCallbacks.onContextLoaded.push(callback);
    }

    /**
     * Enregistre un callback pour les erreurs
     */
    onError(callback) {
        this.contextCallbacks.onError.push(callback);
    }

    /**
     * Déclenche les callbacks de chargement du contexte
     */
    triggerContextLoadedCallbacks() {
        this.contextCallbacks.onContextLoaded.forEach(callback => {
            try {
                callback(this.getContextInfo());
            } catch (error) {
                console.error("Erreur dans le callback onContextLoaded:", error);
            }
        });
    }

    /**
     * Déclenche les callbacks d'erreur
     */
    triggerErrorCallbacks(error) {
        this.contextCallbacks.onError.forEach(callback => {
            try {
                callback(error);
            } catch (callbackError) {
                console.error("Erreur dans le callback onError:", callbackError);
            }
        });
    }
}

// Instance globale du gestionnaire de contexte D365
const d365ContextManager = new D365ContextManager();
