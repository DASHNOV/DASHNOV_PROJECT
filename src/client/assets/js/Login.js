// Fonction pour afficher les onglets autorisés après la connexion
function afficherOngletsAutorises(ongletsAccessibles) {
    if (!ongletsAccessibles || typeof ongletsAccessibles !== 'string') {
        console.error('Onglets accessibles invalides.');
        return;
    }

    // Fonction pour normaliser les noms d'onglets
    const normalizeString = (str) => {
        return str
            .normalize("NFD") // Supprime les accents
            .replace(/[\u0300-\u036f]/g, "") // Supprime les diacritiques
            .replace(/[^a-zA-Z0-9\s-]/g, "") // Supprime les caractères spéciaux
            .replace(/\s+/g, '-') // Remplace les espaces par des tirets
            .toLowerCase(); // Transforme en minuscules
    };

    // Convertir les onglets accessibles en tableau
    const ongletsArray = ongletsAccessibles.split(',');

    // Cacher tous les onglets par défaut
    document.querySelectorAll('.nav-link').forEach(onglet => {
        onglet.style.display = 'none';
    });

    console.log('Onglets accessibles reçus :', ongletsAccessibles);

    ongletsArray.forEach(onglet => {
        const ongletId = `onglet-${normalizeString(onglet.trim())}`;
        console.log('Vérification de l\'onglet :', ongletId);
    
        const ongletElement = document.getElementById(ongletId);
        if (ongletElement) {
            ongletElement.style.display = 'block';
        } else {
            console.warn(`Onglet ${ongletId} non trouvé dans le DOM.`);
        }
    });
}



async function login() {
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch('http://192.168.201.36:8085/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });

        if (!response.ok) {
            if (response.status === 401) {
                alert('Nom d\'utilisateur ou mot de passe incorrect.');
            }
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const data = await response.json();

        // Vérifier que accessibleTabs existe dans la réponse
        if (data.accessibleTabs) {
            afficherOngletsAutorises(data.accessibleTabs);
        } else {
            console.error('Aucun onglet accessible reçu.');
        }

        // Stocker le jeton JWT dans sessionStorage
        sessionStorage.setItem('accessToken', data.accessToken);

        // Recharger les listes nécessaires après la connexion
        await chargerGroupesAcces('groupeAccesSociete');
        await chargerGroupesAscenseurs('groupeAscenseur');
        await chargerMenuDeroulantSocietes();
        await chargerSocietes();
        //await filDeLEau();
        await chargerGroupesAcces('groupeAccesDetenteur');
        await chargerListeControleurs();
        await initialiserPage()

        // Masquer le modal de connexion
        $('#loginModal').modal('hide');

    } catch (error) {
        console.error('Erreur lors de la connexion :', error);
    }
}


// Fonction pour déconnecter l'utilisateur
async function logout() {
    try {
        // Arrêter la surveillance de l'inactivité lors de la déconnexion
        clearTimeout(inactivityTimeout);

        const response = await fetch('http://192.168.201.36:8085/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });

        if (response.ok) {
            sessionStorage.clear(); // Supprimer toutes les données stockées
            location.reload(); // Recharger la page après déconnexion
        } else {
            alert('Erreur lors de la déconnexion.');
        }
    } catch (error) {
        console.error('Erreur lors de la déconnexion :', error);
    }
}

let inactivityTimeout; // Stocker le timeout d'inactivité

function initInactivityTimer() {
    const autoLogoutTime = sessionStorage.getItem('autoLogoutTime'); // Timeout en minutes

    // Vérifier que le timeout est bien défini et est un nombre supérieur à 0
    if (!autoLogoutTime || isNaN(autoLogoutTime) || autoLogoutTime <= 0) {
        console.warn('Timeout de déconnexion non défini ou invalide. Inactivité non surveillée.');
        return; // Ne pas démarrer le timer si le timeout est invalide
    }

    const autoLogoutTimeMs = autoLogoutTime * 60 * 1000; // Convertir en millisecondes

    // Réinitialiser le timeout d'inactivité à chaque interaction de l'utilisateur
    document.addEventListener('mousemove', resetInactivityTimer);
    document.addEventListener('keydown', resetInactivityTimer);
    document.addEventListener('click', resetInactivityTimer);
    document.addEventListener('scroll', resetInactivityTimer);

    // Démarrer le timer d'inactivité
    resetInactivityTimer();

    function resetInactivityTimer() {
        clearTimeout(inactivityTimeout); // Réinitialiser le timeout à chaque interaction
        inactivityTimeout = setTimeout(deconnecterUtilisateur, autoLogoutTimeMs); // Déclencher la déconnexion après le délai
    }
}

function deconnecterUtilisateur() {
    // Supprimer le token et rediriger vers la page de connexion
    clearTimeout(inactivityTimeout); // Arrêter le timer d'inactivité
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('autoLogoutTime');
    alert('Vous avez été déconnecté en raison de l\'inactivité.');
    sessionStorage.clear(); // Supprimer toutes les données stockées
    location.reload(); // Recharger la page après déconnexion
}
