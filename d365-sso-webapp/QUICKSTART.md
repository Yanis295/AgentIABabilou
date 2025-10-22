# 🚀 Démarrage Rapide

Guide pour démarrer l'application en 5 minutes.

## ⚡ Installation rapide

### 1. Installer les dépendances

```bash
npm install
```

### 2. Configurer MSAL

```bash
# Copier le fichier de configuration
cp public/js/config.example.js public/js/config.js
```

Éditez `public/js/config.js` et remplacez :
- `VOTRE_CLIENT_ID_ICI` → Votre Application (client) ID depuis Azure AD
- `VOTRE_TENANT_ID_ICI` → Votre Directory (tenant) ID depuis Azure AD

**Vous n'avez pas encore d'Azure AD App ?**
👉 Suivez le guide : [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md)

### 3. Démarrer le serveur

```bash
npm start
```

Le serveur démarre sur `https://localhost:3000`

### 4. Accepter le certificat SSL

Lors de votre première visite :
1. Votre navigateur affichera un avertissement de sécurité
2. Cliquez sur "Avancé" → "Continuer vers le site"
3. C'est normal pour un certificat auto-signé en développement

### 5. Tester l'authentification

1. L'application s'ouvre sur `https://localhost:3000`
2. Cliquez sur "Se connecter" si nécessaire
3. Authentifiez-vous avec votre compte Microsoft
4. Vos informations utilisateur devraient s'afficher

## ✅ Tout fonctionne ?

**Parfait !** Prochaines étapes :

1. 📖 Lisez le [README.md](README.md) complet
2. 🔧 Configurez Azure AD : [docs/AZURE_SETUP.md](docs/AZURE_SETUP.md)
3. 🔗 Intégrez dans D365 : [docs/D365_INTEGRATION.md](docs/D365_INTEGRATION.md)

## ❌ Problèmes ?

Consultez le guide de dépannage : [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

## 📂 Structure du projet

```
d365-sso-webapp/
├── public/
│   ├── index.html              # Page principale
│   ├── css/styles.css          # Styles
│   └── js/
│       ├── config.example.js   # Template de config
│       ├── config.js           # Votre config (à créer)
│       ├── auth.js             # Authentification MSAL
│       ├── d365-context.js     # Contexte D365
│       └── app.js              # Application
├── docs/                       # Documentation complète
├── server.js                   # Serveur de développement
└── package.json               # Dépendances
```

## 🔑 Identifiants Azure AD nécessaires

Pour configurer l'application, vous avez besoin de :

1. **Application (client) ID**
   - Trouvé dans : Azure Portal → App registrations → Overview
   - Format : `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`

2. **Directory (tenant) ID**
   - Trouvé dans : Azure Portal → App registrations → Overview
   - Format : `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy`

3. **Redirect URI configuré**
   - Doit être : `https://localhost:3000`
   - Type : Single-page application (SPA)

## 📝 Commandes utiles

```bash
# Démarrer le serveur
npm start

# Installer les dépendances
npm install

# Afficher la version de Node.js
node --version

# Nettoyer node_modules et réinstaller
rm -rf node_modules package-lock.json && npm install
```

## 🌐 URLs importantes

- **Application locale** : https://localhost:3000
- **Azure Portal** : https://portal.azure.com
- **Microsoft Graph Explorer** : https://developer.microsoft.com/graph/graph-explorer
- **JWT Decoder** : https://jwt.ms

## 💡 Conseils

### Développement

- Utilisez toujours **HTTPS** (requis pour MSAL)
- Activez **les logs MSAL** pour le debug
- Testez dans **plusieurs navigateurs**
- Gardez la **console ouverte** (F12) pour voir les logs

### Production

- Utilisez un **certificat SSL valide**
- **Ne commitez jamais** `config.js` (contient des secrets)
- Configurez les **CORS** correctement
- Activez le **monitoring** (Application Insights)

## 🔒 Sécurité

**Important :**
- `config.js` est ignoré par git
- Ne partagez jamais vos Client ID publiquement
- En production, validez les tokens côté backend
- Utilisez des variables d'environnement pour les secrets

## 🎯 Objectifs du projet

Cette application permet de :

✅ Authentifier les utilisateurs via Microsoft SSO
✅ Détecter le contexte Dynamics 365
✅ Appeler des APIs avec authentification
✅ S'intégrer dans un iframe D365
✅ Gérer les erreurs et le debug

## 📚 Documentation complète

- **[README.md](README.md)** : Vue d'ensemble complète
- **[AZURE_SETUP.md](docs/AZURE_SETUP.md)** : Configuration Azure AD détaillée
- **[D365_INTEGRATION.md](docs/D365_INTEGRATION.md)** : Intégration dans D365
- **[TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)** : Résolution de problèmes

---

**Besoin d'aide ?** Ouvrez une issue sur GitHub ou consultez la documentation complète.

Bon développement ! 🎉
