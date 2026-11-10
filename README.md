# Pulsio — sondages en direct

Application web sans compte pour les animateurs et les participants. Le serveur est nécessaire pour partager une session entre téléphones et recevoir les réponses en direct.

## Démarrer

1. Installer Node.js (version 18 ou plus récente).
2. Dans ce dossier, lancer `npm install` une fois.
3. Lancer `npm start`.
4. Ouvrir `http://localhost:3000` sur l’ordinateur de l’animateur.

Pour rejoindre depuis des téléphones sur le même réseau Wi-Fi, ouvrez l’application sur l’ordinateur avec son adresse réseau locale, par exemple `http://192.168.1.20:3000`, puis créez le sondage. Le QR code utilisera cette adresse. Le pare-feu de l’ordinateur doit autoriser Node.js sur le réseau privé.

Pour des participants hors de ce réseau, le serveur doit être hébergé sur une adresse publique avec HTTPS et WebSocket activé. Le code court saisi manuellement et le QR code ouvrent la même session. Après les questions, la page de présentation affiche la question en cours, les réponses reçues, le bouton de passage ou le compte à rebours. À la fin, l’animateur peut consulter le tableau complet et le télécharger au format CSV.

## Données

Les sessions et votes sont écrits dans `sessions.json`. Le serveur les recharge après redémarrage. Les navigateurs gardent un identifiant anonyme local pour éviter un second vote depuis le même navigateur et appareil. Effacer les données du navigateur ou utiliser un autre navigateur/appareil crée une nouvelle identité.

Le serveur est sans comptes ni authentification. Toute personne ayant le code de session peut participer. Hébergez-le sur un réseau de confiance et ne partagez le code qu’avec les participants.
