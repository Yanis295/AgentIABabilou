# Déploiement sur Azure Static Web Apps

Ce guide explique comment déployer l'application D365 SSO sur Azure Static Web Apps.

## Qu'est-ce qu'Azure Static Web Apps ?

Azure Static Web Apps est un service qui construit et déploie automatiquement des applications web complètes sur Azure à partir d'un dépôt GitHub. Il offre :

- **Déploiement automatique** via GitHub Actions
- **CDN global** pour des performances optimales
- **Certificats SSL** gratuits et automatiques
- **API serverless** avec Azure Functions
- **Authentification intégrée** avec les fournisseurs sociaux
- **Environnements de staging** pour les pull requests

## Prérequis

1. Un compte Azure actif
2. Un dépôt GitHub avec ce code
3. Azure CLI installé (optionnel)

## Étape 1 : Créer une Static Web App dans Azure

### Via le portail Azure

1. Connectez-vous au [portail Azure](https://portal.azure.com)

2. Cliquez sur "Créer une ressource"

3. Recherchez "Static Web Apps" et cliquez sur "Créer"

4. Remplissez les informations :
   - **Abonnement** : Sélectionnez votre abonnement
   - **Groupe de ressources** : Créez-en un nouveau ou utilisez un existant
   - **Nom** : `d365-sso-webapp` (ou un nom unique)
   - **Plan** : Gratuit (pour commencer)
   - **Région** : Choisissez la plus proche de vos utilisateurs
   - **Source** : GitHub
   - **Organisation** : Votre compte GitHub
   - **Dépôt** : Sélectionnez ce dépôt
   - **Branche** : main (ou master)

5. Configuration de build :
   - **Build Presets** : Custom
   - **App location** : `/d365-sso-webapp/public`
   - **Api location** : `/d365-sso-webapp/api`
   - **Output location** : `` (laisser vide)

6. Cliquez sur "Review + create" puis "Create"

### Via Azure CLI

```bash
# Se connecter à Azure
az login

# Créer un groupe de ressources
az group create \
  --name d365-sso-rg \
  --location westeurope

# Créer la Static Web App
az staticwebapp create \
  --name d365-sso-webapp \
  --resource-group d365-sso-rg \
  --source https://github.com/VOTRE_ORG/VOTRE_REPO \
  --location westeurope \
  --branch main \
  --app-location "/d365-sso-webapp/public" \
  --api-location "/d365-sso-webapp/api" \
  --output-location "" \
  --login-with-github
```

## Étape 2 : Configurer les secrets GitHub

Azure aura automatiquement ajouté un secret GitHub appelé `AZURE_STATIC_WEB_APPS_API_TOKEN` lors de la création.

Pour vérifier :

1. Allez dans votre dépôt GitHub
2. Settings → Secrets and variables → Actions
3. Vérifiez la présence de `AZURE_STATIC_WEB_APPS_API_TOKEN`

## Étape 3 : Configurer l'authentification Azure AD

### Mettre à jour l'App Registration

1. Dans le [portail Azure](https://portal.azure.com), allez dans "Azure Active Directory"

2. Cliquez sur "App registrations" et sélectionnez votre application

3. Dans "Authentication", ajoutez l'URI de redirection :
   - Type : Single-page application (SPA)
   - URI : `https://VOTRE_APP.azurestaticapps.net`

4. Notez les informations nécessaires :
   - **Client ID** (Application ID)
   - **Tenant ID** (Directory ID)

### Configurer les variables d'environnement

Dans le portail Azure Static Web Apps :

1. Allez dans votre Static Web App
2. Cliquez sur "Configuration"
3. Ajoutez les variables d'application :

```
Nom : Valeur
---------------------
Les variables d'environnement pour Azure Functions peuvent être configurées ici si nécessaire
```

## Étape 4 : Mettre à jour la configuration frontend

1. Copiez le fichier de configuration :
```bash
cp d365-sso-webapp/public/js/config.example.js d365-sso-webapp/public/js/config.js
```

2. Éditez `config.js` avec vos informations :

```javascript
const msalConfig = {
    auth: {
        clientId: 'VOTRE_CLIENT_ID',
        authority: 'https://login.microsoftonline.com/VOTRE_TENANT_ID',
        redirectUri: 'https://VOTRE_APP.azurestaticapps.net'
    }
};
```

3. Committez et poussez les changements :
```bash
git add d365-sso-webapp/public/js/config.js
git commit -m "Configure Azure AD authentication"
git push
```

## Étape 5 : Déploiement automatique

Le workflow GitHub Actions se déclenchera automatiquement :

1. À chaque push sur la branche `main`/`master`
2. À chaque pull request

Pour suivre le déploiement :

1. Allez dans l'onglet "Actions" de votre dépôt GitHub
2. Cliquez sur le workflow en cours
3. Attendez que le déploiement soit terminé (badge vert)

## Étape 6 : Vérifier le déploiement

1. Ouvrez votre application : `https://VOTRE_APP.azurestaticapps.net`

2. Testez le health check : `https://VOTRE_APP.azurestaticapps.net/api/health`

3. Testez l'authentification en cliquant sur "Sign In"

## Configuration avancée

### Custom Domain

Pour utiliser votre propre domaine :

1. Dans le portail Azure, allez dans votre Static Web App
2. Cliquez sur "Custom domains"
3. Suivez les instructions pour ajouter un domaine personnalisé

### Environnements de staging

Chaque pull request crée automatiquement un environnement de staging avec une URL unique :
- `https://VOTRE_APP-PR_NUMBER.azurestaticapps.net`

### API Functions personnalisées

Pour ajouter de nouvelles fonctions API :

1. Créez un nouveau dossier dans `api/` :
```bash
mkdir api/ma-fonction
```

2. Créez `function.json` :
```json
{
  "bindings": [
    {
      "authLevel": "anonymous",
      "type": "httpTrigger",
      "direction": "in",
      "name": "req",
      "methods": ["get", "post"],
      "route": "ma-fonction"
    },
    {
      "type": "http",
      "direction": "out",
      "name": "res"
    }
  ]
}
```

3. Créez `index.js` :
```javascript
module.exports = async function (context, req) {
    context.res = {
        status: 200,
        body: { message: "Hello from Azure Functions!" }
    };
};
```

### Configuration de sécurité

Le fichier `staticwebapp.config.json` permet de configurer :

- **Routes** : Contrôle d'accès par route
- **Headers** : Headers de sécurité personnalisés
- **Redirections** : Redirections et rewrites
- **Authentification** : Fournisseurs d'authentification

Exemple de configuration avancée :

```json
{
  "routes": [
    {
      "route": "/admin/*",
      "allowedRoles": ["administrator"]
    },
    {
      "route": "/api/*",
      "allowedRoles": ["authenticated"]
    }
  ],
  "responseOverrides": {
    "401": {
      "rewrite": "/login.html",
      "statusCode": 302
    }
  }
}
```

## Surveillance et logs

### Application Insights

1. Dans le portail Azure, créez une ressource Application Insights

2. Dans votre Static Web App, allez dans "Application Insights"

3. Connectez votre Application Insights pour obtenir :
   - Métriques de performance
   - Logs d'application
   - Alertes personnalisées

### Logs des fonctions

Les logs des Azure Functions sont disponibles dans :
- Portail Azure → Votre Static Web App → Functions → Monitor
- Application Insights (si configuré)

## Dépannage

### Le déploiement échoue

1. Vérifiez les logs dans GitHub Actions
2. Assurez-vous que les chemins dans le workflow sont corrects
3. Vérifiez que le secret `AZURE_STATIC_WEB_APPS_API_TOKEN` est présent

### L'authentification ne fonctionne pas

1. Vérifiez que l'URI de redirection est correcte dans Azure AD
2. Assurez-vous que `config.js` contient les bonnes informations
3. Vérifiez la console du navigateur pour les erreurs MSAL

### L'API ne répond pas

1. Vérifiez que le dossier `api` est au bon endroit
2. Consultez les logs des fonctions dans le portail Azure
3. Testez localement avec Azure Functions Core Tools

## Coûts

Azure Static Web Apps offre :

- **Plan gratuit** :
  - 100 GB de bande passante/mois
  - 2 domaines personnalisés
  - Staging illimité

- **Plan Standard** :
  - Bande passante illimitée
  - Domaines personnalisés illimités
  - SLA de 99.95%

Consultez la [page de tarification](https://azure.microsoft.com/pricing/details/app-service/static/) pour plus de détails.

## Ressources

- [Documentation Azure Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure Functions JavaScript](https://docs.microsoft.com/azure/azure-functions/functions-reference-node)
- [Configuration de Static Web Apps](https://docs.microsoft.com/azure/static-web-apps/configuration)
- [Authentification et autorisation](https://docs.microsoft.com/azure/static-web-apps/authentication-authorization)
