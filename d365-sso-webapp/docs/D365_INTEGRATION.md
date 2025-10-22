# Intégration dans Dynamics 365 Customer Service

Ce guide détaille l'intégration de votre page web personnalisée avec authentification SSO dans Dynamics 365 Customer Service.

## 📋 Prérequis

- ✅ Application fonctionnelle localement
- ✅ Azure AD App Registration configurée
- ✅ Accès administrateur à Dynamics 365
- ✅ Serveur web HTTPS pour héberger l'application

## 🌐 Étape 1 : Déploiement de l'application

Avant d'intégrer dans D365, vous devez déployer votre application sur un serveur accessible.

### Option 1 : Hébergement web externe

**Services recommandés :**
- **Azure Static Web Apps** (recommandé)
- **Azure App Service**
- **Netlify**
- **Vercel**
- Votre propre serveur web

**Important :** Le serveur DOIT supporter HTTPS avec un certificat SSL valide.

### Option 2 : Web Resources dans D365

Vous pouvez également héberger les fichiers directement dans D365 comme Web Resources.

**Avantages :**
- Pas besoin de serveur externe
- Déjà dans le même domaine que D365

**Inconvénients :**
- Moins flexible pour les mises à jour
- Configuration plus complexe

## 🚀 Étape 2 : Configuration de l'URL de production

### 2.1. Mettre à jour Azure AD App Registration

1. Allez dans le **portail Azure** → **App registrations**
2. Sélectionnez votre application
3. Allez dans **Authentication**
4. Ajoutez votre URL de production dans les "Redirect URIs" :

```
https://votre-domaine.com
https://votre-org.crm.dynamics.com/WebResources/app_d365sso_index.html
```

5. Cliquez sur **Save**

### 2.2. Mettre à jour config.js

Modifiez `public/js/config.js` :

```javascript
const msalConfig = {
    auth: {
        clientId: "votre-client-id",
        authority: "https://login.microsoftonline.com/votre-tenant-id",
        redirectUri: "https://votre-domaine-production.com", // ⬅️ URL de production
        postLogoutRedirectUri: "https://votre-domaine-production.com"
    }
};
```

### 2.3. Déployer l'application

Déployez les fichiers sur votre serveur :

```bash
# Exemple avec Azure CLI
az webapp deployment source config-zip \
  --resource-group monResourceGroup \
  --name monAppService \
  --src ./d365-sso-webapp.zip
```

## 📱 Étape 3 : Intégration dans D365

Il existe plusieurs méthodes pour intégrer votre page dans D365.

### Méthode 1 : Dashboard Web Resource (Recommandé)

Cette méthode affiche votre page dans un dashboard.

#### 3.1. Créer une Web Resource HTML

1. Dans D365, allez dans **Paramètres** → **Personnalisations** → **Personnaliser le système**
2. Dans le panneau de gauche, développez **Composants** → **Ressources web**
3. Cliquez sur **Nouvelle**

Remplissez les champs :

| Champ | Valeur |
|-------|--------|
| **Nom** | `app_d365sso_index` |
| **Nom d'affichage** | `D365 SSO App` |
| **Type** | Page Web (HTML) |

4. Dans **Source**, créez un HTML simple qui pointe vers votre application :

```html
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body, html {
            margin: 0;
            padding: 0;
            height: 100%;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
            border: none;
        }
    </style>
</head>
<body>
    <iframe src="https://votre-domaine-production.com"
            allow="cross-origin-isolated"
            sandbox="allow-same-origin allow-scripts allow-popups allow-forms"></iframe>
</body>
</html>
```

5. Cliquez sur **Enregistrer** puis **Publier**

#### 3.2. Ajouter au Dashboard

1. Allez dans **Ventes** → **Tableaux de bord**
2. Créez un nouveau dashboard ou éditez un existant
3. Ajoutez un composant **Web Resource**
4. Sélectionnez `app_d365sso_index`
5. Configurez la taille et la position
6. Enregistrez et publiez

### Méthode 2 : Formulaire avec iframe

Cette méthode intègre votre page dans un formulaire d'entité.

#### 3.1. Créer une Web Resource

Même procédure que la Méthode 1, étape 3.1.

#### 3.2. Ajouter au formulaire

1. Ouvrez le formulaire d'une entité (ex: Contact, Compte, Case)
2. En mode édition, ajoutez un nouvel onglet ou section
3. Insérez un contrôle **Web Resource**
4. Sélectionnez votre Web Resource `app_d365sso_index`
5. Configurez les propriétés :

| Propriété | Valeur |
|-----------|--------|
| **Nom** | `WebResource_D365SSO` |
| **Étiquette** | `Application personnalisée` |
| **Hauteur (lignes)** | 20+ (selon vos besoins) |
| **Restriction entre origines multiples** | Désactivé |

6. Enregistrez et publiez le formulaire

### Méthode 3 : Application Canvas PowerApps

Vous pouvez également créer une application Canvas qui héberge votre page web.

#### 3.1. Créer une Canvas App

1. Allez sur https://make.powerapps.com
2. Créez une nouvelle **Application canevas**
3. Ajoutez un contrôle **HTML Text** ou **Iframe**

#### 3.2. Code de l'iframe

```html
"<iframe src='https://votre-domaine-production.com'
         width='100%' height='100%'
         style='border:none;'></iframe>"
```

#### 3.3. Intégrer dans D365

1. Publiez l'application Canvas
2. Ajoutez-la à un formulaire Model-Driven App via **PowerApps Component**

### Méthode 4 : Panneau latéral (Side Panel)

Pour D365 Customer Service, vous pouvez utiliser les panneaux latéraux.

#### 4.1. Configuration via App Profile

1. Allez dans **Customer Service admin center**
2. Sélectionnez **Productivity** → **Productivity pane**
3. Ajoutez un nouveau **custom control**
4. Configurez l'URL de votre application

## 🔧 Étape 4 : Configuration avancée

### 4.1. Passer des paramètres depuis D365

Vous pouvez passer des paramètres depuis D365 vers votre application via l'URL.

**Exemple dans une Web Resource :**

```html
<script type="text/javascript">
    // Récupérer le contexte D365
    var Xrm = window.parent.Xrm;
    var formContext = Xrm.Page;

    // Récupérer des valeurs
    var accountId = formContext.data.entity.getId();
    var accountName = formContext.getAttribute("name").getValue();

    // Construire l'URL avec paramètres
    var appUrl = "https://votre-domaine.com?entityId=" + accountId + "&entityName=" + encodeURIComponent(accountName);

    // Afficher l'iframe
    document.getElementById("appIframe").src = appUrl;
</script>

<iframe id="appIframe" style="width:100%;height:100%;border:none;"></iframe>
```

**Dans votre application, récupérez les paramètres :**

```javascript
// Dans d365-context.js, méthode extractUrlParameters()
const urlParams = new URLSearchParams(window.location.search);
const entityId = urlParams.get('entityId');
const entityName = urlParams.get('entityName');

console.log('Entity ID:', entityId);
console.log('Entity Name:', entityName);
```

### 4.2. Appeler l'API D365 depuis votre application

Une fois authentifié avec MSAL, vous pouvez appeler l'API Web de D365.

**Exemple : Récupérer un compte**

```javascript
// Obtenir le token avec les scopes D365
const token = await authManager.getAccessToken([
    "https://votre-org.crm.dynamics.com/.default"
]);

// Appeler l'API D365
const response = await fetch(
    "https://votre-org.crm.dynamics.com/api/data/v9.2/accounts(id-du-compte)",
    {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json",
            "Content-Type": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0"
        }
    }
);

const account = await response.json();
console.log(account);
```

### 4.3. Utiliser le contexte D365 (si disponible)

Si votre application est dans une Web Resource, vous pouvez accéder au contexte D365.

```javascript
// Dans votre application
if (d365ContextManager.isInD365) {
    // Récupérer des données via Xrm.WebApi
    const account = await d365ContextManager.callD365WebApi(
        "accounts",
        "id-du-compte",
        { select: "?$select=name,accountnumber,revenue" }
    );

    console.log("Compte:", account);

    // Afficher une notification
    d365ContextManager.showNotification(
        "Données chargées avec succès!",
        "SUCCESS"
    );
}
```

## 🔐 Étape 5 : Sécurité en production

### 5.1. Vérifications de sécurité

- ✅ **HTTPS obligatoire** avec certificat SSL valide
- ✅ **CORS configuré** correctement
- ✅ **Validation des tokens** côté backend
- ✅ **Pas de secrets dans le code frontend**
- ✅ **Content Security Policy** configuré

### 5.2. Configuration CORS (backend)

Si vous avez un backend API :

```javascript
// Exemple Node.js/Express
app.use(cors({
    origin: [
        'https://votre-org.crm.dynamics.com',
        'https://votre-domaine.com'
    ],
    credentials: true
}));
```

### 5.3. Validation des tokens (backend)

**Important :** Toujours valider les tokens côté backend.

```javascript
// Exemple avec passport-azure-ad (Node.js)
const bearerStrategy = new BearerStrategy(
    {
        identityMetadata: `https://login.microsoftonline.com/${tenantId}/v2.0/.well-known/openid-configuration`,
        clientID: clientId,
        validateIssuer: true,
        loggingLevel: 'info',
        passReqToCallback: false
    },
    (token, done) => {
        // Token validé
        return done(null, token, token);
    }
);
```

## 🧪 Étape 6 : Tests

### 6.1. Tests locaux (avant intégration)

1. Testez l'authentification SSO
2. Testez dans différents navigateurs
3. Testez les appels API
4. Testez la gestion des erreurs

### 6.2. Tests dans D365

1. **Test en tant qu'utilisateur standard**
   - Connectez-vous à D365 avec un compte utilisateur
   - Ouvrez la page/dashboard avec votre application
   - Vérifiez que le SSO fonctionne automatiquement

2. **Test des cookies tiers**
   - Certains navigateurs bloquent les cookies tiers par défaut
   - Testez dans Chrome, Edge, Firefox
   - Consultez [TROUBLESHOOTING.md](TROUBLESHOOTING.md#cookies-tiers)

3. **Test des permissions**
   - Vérifiez que les utilisateurs ont les bonnes permissions
   - Testez avec différents rôles D365

## 📊 Étape 7 : Monitoring et logs

### 7.1. Logs d'authentification

Configurez MSAL pour logger les événements :

```javascript
system: {
    loggerOptions: {
        loggerCallback: (level, message, containsPii) => {
            // Envoyez les logs à votre système de monitoring
            if (!containsPii) {
                console.log(`[MSAL] ${message}`);
                // sendToAppInsights(level, message);
            }
        },
        piiLoggingEnabled: false,
        logLevel: msal.LogLevel.Info
    }
}
```

### 7.2. Application Insights (Azure)

Intégrez Azure Application Insights pour monitorer votre application :

```html
<script src="https://js.monitor.azure.com/scripts/b/ai.2.min.js"></script>
<script>
    var appInsights = new Microsoft.ApplicationInsights.ApplicationInsights({
        config: {
            instrumentationKey: "votre-instrumentation-key"
        }
    });
    appInsights.loadAppInsights();
    appInsights.trackPageView();
</script>
```

## 🔄 Étape 8 : Maintenance

### Mises à jour de l'application

1. Testez les changements localement
2. Déployez sur un environnement de staging
3. Testez dans D365 staging
4. Déployez en production
5. Vérifiez les logs et monitoring

### Renouvellement du certificat SSL

- Configurez le renouvellement automatique (Let's Encrypt)
- Mettez à jour les certificats avant expiration
- Testez après renouvellement

## 📚 Exemples de cas d'usage

### Cas 1 : Dashboard de métriques personnalisé

Affichez des métriques d'un système externe dans un dashboard D365.

### Cas 2 : Intégration d'outils externes

Intégrez des outils comme Jira, ServiceNow, etc. avec SSO unifié.

### Cas 3 : Formulaires personnalisés

Créez des formulaires complexes qui interagissent avec D365.

### Cas 4 : Visualisations avancées

Affichez des graphiques et visualisations de données avec Chart.js, D3.js, etc.

## 🐛 Problèmes courants

### L'iframe ne charge pas dans D365

**Causes possibles :**
- X-Frame-Options bloque l'iframe
- CSP (Content Security Policy) trop restrictif
- Cookies tiers bloqués

**Solutions :**
- Vérifiez les headers de votre serveur
- Configurez correctement X-Frame-Options
- Consultez [TROUBLESHOOTING.md](TROUBLESHOOTING.md#iframe-issues)

### Le SSO ne fonctionne pas dans D365

**Causes possibles :**
- Cookies tiers bloqués par le navigateur
- Configuration MSAL incorrecte
- Redirect URI mal configuré

**Solutions :**
- Vérifiez `storeAuthStateInCookie: true`
- Autorisez les cookies tiers pour `login.microsoftonline.com`
- Consultez [TROUBLESHOOTING.md](TROUBLESHOOTING.md#sso-issues)

## 🔗 Ressources

### Documentation Dynamics 365

- [Web Resources](https://docs.microsoft.com/en-us/powerapps/developer/model-driven-apps/web-resources)
- [Client API Reference](https://docs.microsoft.com/en-us/powerapps/developer/model-driven-apps/clientapi/reference)
- [Web API](https://docs.microsoft.com/en-us/powerapps/developer/data-platform/webapi/overview)

### Outils

- **XrmToolBox** : Outil de gestion D365
- **Dataverse REST Builder** : Construire des requêtes API
- **FetchXML Builder** : Créer des requêtes de données

## ✅ Checklist de déploiement

Avant de déployer en production :

- [ ] Application testée localement
- [ ] Azure AD configuré avec URL de production
- [ ] Certificat SSL valide installé
- [ ] CORS configuré correctement
- [ ] Tests d'authentification SSO réussis
- [ ] Tests dans différents navigateurs
- [ ] Web Resource créée dans D365
- [ ] Intégration dans D365 testée
- [ ] Permissions utilisateurs vérifiées
- [ ] Monitoring configuré
- [ ] Documentation utilisateur créée
- [ ] Plan de rollback préparé

---

**Prochaine étape :** Consultez [TROUBLESHOOTING.md](TROUBLESHOOTING.md) pour résoudre les problèmes courants
