/**
 * Serveur de développement pour l'application D365 SSO
 *
 * Ce serveur utilise Express pour servir les fichiers statiques
 * et génère automatiquement des certificats SSL pour HTTPS (requis pour MSAL)
 */

const express = require('express');
const path = require('path');
const https = require('https');
const http = require('http');
const fs = require('fs');
const { exec } = require('child_process');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const USE_HTTPS = process.env.USE_HTTPS !== 'false'; // Par défaut HTTPS

// CORS - Important pour les requêtes depuis D365
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// Headers de sécurité
app.use((req, res, next) => {
    // Permettre l'intégration dans un iframe (nécessaire pour D365)
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");

    // Headers de sécurité supplémentaires
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');

    next();
});

// Servir les fichiers statiques depuis le dossier public
app.use(express.static(path.join(__dirname, 'public')));

// Route principale
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route de santé
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Gestionnaire d'erreurs 404
app.use((req, res) => {
    res.status(404).send('Page non trouvée');
});

/**
 * Génère un certificat SSL auto-signé pour le développement
 */
function generateSSLCertificate(callback) {
    const certPath = path.join(__dirname, 'server.crt');
    const keyPath = path.join(__dirname, 'server.key');

    // Vérifier si les certificats existent déjà
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        console.log('✓ Certificats SSL trouvés');
        callback(null, {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        });
        return;
    }

    console.log('Génération de certificats SSL auto-signés...');

    // Commande pour générer un certificat auto-signé
    const command = `openssl req -x509 -newkey rsa:2048 -keyout server.key -out server.crt -days 365 -nodes -subj "/CN=${HOST}"`;

    exec(command, (error) => {
        if (error) {
            console.error('❌ Erreur lors de la génération des certificats SSL:', error.message);
            console.log('');
            console.log('Pour générer manuellement les certificats, exécutez:');
            console.log(command);
            console.log('');
            console.log('Ou installez OpenSSL: https://www.openssl.org/');
            console.log('');
            console.log('Le serveur va démarrer en HTTP (non recommandé pour MSAL)');
            callback(error);
            return;
        }

        console.log('✓ Certificats SSL générés avec succès');
        callback(null, {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath)
        });
    });
}

/**
 * Démarre le serveur
 */
function startServer() {
    if (USE_HTTPS) {
        // Essayer de générer/charger les certificats SSL
        generateSSLCertificate((error, credentials) => {
            if (error || !credentials) {
                // Fallback vers HTTP si les certificats ne peuvent pas être générés
                console.log('');
                console.log('⚠️  Démarrage en HTTP...');
                startHttpServer();
                return;
            }

            // Démarrer le serveur HTTPS
            const httpsServer = https.createServer(credentials, app);
            httpsServer.listen(PORT, HOST, () => {
                console.log('');
                console.log('╔══════════════════════════════════════════════════════════════╗');
                console.log('║  🚀 Serveur HTTPS démarré avec succès!                       ║');
                console.log('╚══════════════════════════════════════════════════════════════╝');
                console.log('');
                console.log(`  URL locale:          https://${HOST}:${PORT}`);
                console.log(`  URL réseau:          https://${getNetworkAddress()}:${PORT}`);
                console.log('');
                console.log('  Statut:              En ligne');
                console.log('  Protocole:           HTTPS (SSL/TLS)');
                console.log('  Certificat:          Auto-signé (développement)');
                console.log('');
                console.log('╔══════════════════════════════════════════════════════════════╗');
                console.log('║  ⚠️  IMPORTANT - Certificat auto-signé                        ║');
                console.log('╚══════════════════════════════════════════════════════════════╝');
                console.log('');
                console.log('  Votre navigateur affichera un avertissement de sécurité.');
                console.log('  C\'est normal pour un certificat auto-signé en développement.');
                console.log('');
                console.log('  Pour continuer:');
                console.log('  1. Cliquez sur "Avancé" ou "Paramètres avancés"');
                console.log('  2. Cliquez sur "Continuer vers le site" ou "Accepter le risque"');
                console.log('');
                console.log('╔══════════════════════════════════════════════════════════════╗');
                console.log('║  📝 Configuration MSAL                                        ║');
                console.log('╚══════════════════════════════════════════════════════════════╝');
                console.log('');
                console.log('  Avant d\'utiliser l\'application:');
                console.log('');
                console.log('  1. Copiez public/js/config.example.js en public/js/config.js');
                console.log('  2. Configurez votre Azure AD App Registration');
                console.log('  3. Ajoutez cette URI de redirection dans Azure AD:');
                console.log(`     https://${HOST}:${PORT}`);
                console.log('');
                console.log('  Consultez docs/AZURE_SETUP.md pour plus de détails');
                console.log('');
                console.log('══════════════════════════════════════════════════════════════');
                console.log('');
                console.log('  Appuyez sur CTRL+C pour arrêter le serveur');
                console.log('');
            });

            httpsServer.on('error', (error) => {
                if (error.code === 'EADDRINUSE') {
                    console.error(`❌ Le port ${PORT} est déjà utilisé`);
                    process.exit(1);
                } else {
                    console.error('❌ Erreur du serveur:', error);
                    process.exit(1);
                }
            });
        });
    } else {
        startHttpServer();
    }
}

/**
 * Démarre le serveur HTTP (fallback)
 */
function startHttpServer() {
    const httpServer = http.createServer(app);
    httpServer.listen(PORT, HOST, () => {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  🚀 Serveur HTTP démarré                                     ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log(`  URL locale:          http://${HOST}:${PORT}`);
        console.log(`  URL réseau:          http://${getNetworkAddress()}:${PORT}`);
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════════╗');
        console.log('║  ⚠️  AVERTISSEMENT - Mode HTTP                                ║');
        console.log('╚══════════════════════════════════════════════════════════════╝');
        console.log('');
        console.log('  MSAL.js nécessite HTTPS pour fonctionner correctement.');
        console.log('  L\'authentification peut ne pas fonctionner en HTTP.');
        console.log('');
        console.log('  Pour utiliser HTTPS:');
        console.log('  1. Installez OpenSSL');
        console.log('  2. Redémarrez le serveur');
        console.log('  3. Les certificats seront générés automatiquement');
        console.log('');
        console.log('══════════════════════════════════════════════════════════════');
        console.log('');
    });

    httpServer.on('error', (error) => {
        if (error.code === 'EADDRINUSE') {
            console.error(`❌ Le port ${PORT} est déjà utilisé`);
            process.exit(1);
        } else {
            console.error('❌ Erreur du serveur:', error);
            process.exit(1);
        }
    });
}

/**
 * Obtient l'adresse IP du réseau local
 */
function getNetworkAddress() {
    const { networkInterfaces } = require('os');
    const nets = networkInterfaces();

    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            // Ignore les adresses non IPv4 et internes
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }

    return HOST;
}

// Démarrer le serveur
startServer();

// Gestion de l'arrêt gracieux
process.on('SIGTERM', () => {
    console.log('\nArrêt du serveur...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\n\nArrêt du serveur...');
    process.exit(0);
});
