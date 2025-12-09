// Fonction d'initialisation de la page
async function initialiserPage() {
    const token = sessionStorage.getItem('accessToken');
    
    if (!token) {
        console.warn('Token d\'authentification manquant. Redirection vers la page de connexion.');
        window.location.href = 'http://192.168.201.36:8085/login'; // Rediriger vers la page de login si l'utilisateur n'est pas connecté
        return;
    }


    try {
        // Vérifier la connexion
        updateConnectionStatus();
        setInterval(updateConnectionStatus, 5000); // Rafraîchir l'état de la connexion toutes les 5 secondes
    } catch (error) {
        console.error('Erreur lors de la mise à jour du statut de connexion :', error);
    }

    try {
        // Charger le fil de l'eau
        filDeLEau();
        setInterval(filDeLEau, 1500); // Rafraîchir le fil de l'eau toutes les 10 secondes
    } catch (error) {
        console.error('Erreur lors du chargement du fil de l\'eau :', error);
    }
}

// Chargement de la page avec vérification de session
window.onload = function() {
    if (!sessionStorage.getItem('loggedIn')) {
        $('#loginModal').modal('show');
    } else {
       initialiserPage();
        showTab('eventLogTable');
    }
};

$(document).ready(function() {
    // Gestion des onglets
    $('.nav-link').on('click', function(e) {
        e.preventDefault();
        $('.nav-link').removeClass('active');
        $(this).addClass('active');
        $('.content-section').hide(); // Cacher toutes les sections
        const href = $(this).attr('href').substring(1);
        $('#' + href).show(); // Montrer la section cliquée
    });
});

// Ajouter un écouteur d'événements sur le formulaire pour soumettre avec la touche Entrer
document.getElementById('loginForm').addEventListener('keydown', function(event) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Empêcher le comportement par défaut (soumettre le formulaire)
        login(); // Appeler la fonction de connexion
    }
});

function showTab(tabId) {
    $('.content-section').hide(); // Cacher toutes les sections
    const tabElement = $('#' + tabId);

    if (tabElement.length > 0) {
        console.log("Affichage de l'onglet : " + tabId);
        tabElement.css('display', 'block');
    } else {
        console.warn("L'onglet avec l'ID : " + tabId + " n'a pas été trouvé.");
    }

    if (tabId === 'ongletGestionProfils') {
        chargerProfils(); // Charger les profils dans l'onglet de gestion des profils
    } else if (tabId === 'ongletGestionUtilisateurs') {
        chargerUtilisateurs(); // Charger la liste des utilisateurs
        setTimeout(() => {
            chargerProfilsDansUtilisateurs(); // Charger les profils après un délai
        }, 1000);
    }else if (tabId === 'ongletGestionCodesPins') {
        chargerSocietes();    
    } else if (tabId === 'onglet-generateur-de-rapport') {
        chargerRapports(); // Fonction pour charger les rapports si nécessaire
    } else if (tabId === 'onglet-generateur-de-rapport') {
        console.log('Chargement du contenu pour Générateur de Rapport');
        chargerRapports();   
    }
}

async function updateConnectionStatus() {
    const token = sessionStorage.getItem('accessToken');
    
    if (!token) {
        console.error('Token d\'authentification manquant.');
        alert('Vous avez été déconnecté. Veuillez vous reconnecter.');
        location.reload(); // Recharger la page après déconnexion
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/verifierConnexion', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            document.getElementById('connexionStatusSwitch').checked = true;
        } else {
            document.getElementById('connexionStatusSwitch').checked = false;
            console.warn('Problème de connexion au serveur.');
        }
    } catch (error) {
        console.error('Erreur lors de la vérification du statut de connexion :', error);
        document.getElementById('connexionStatusSwitch').checked = false;
    }
}