async function creerUtilisateur() {
    const username = document.getElementById('createUsername').value;
    const password = document.getElementById('createPassword').value;
    const profileId = document.getElementById('createProfile').value;


    // Vérification explicite des champs
    if (!username.trim()) {
        alert('Le champ Nom d\'utilisateur est vide.');
        return;
    }
    if (!password.trim()) {
        alert('Le champ Mot de passe est vide.');
        return;
    }
    if (!profileId || profileId === '') {
        alert('Le ProfilID n\'est pas sélectionné.');
        return;
    }

    try {
        const response = await fetch('http://192.168.200.228:8085/creerUtilisateur', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                password,
                profileId // Envoie du ProfilID au backend
            }),
        });

        if (response.ok) {
            alert('Utilisateur créé avec succès!');
            document.getElementById('creationUtilisateurForm').reset(); // Réinitialise le formulaire
            chargerUtilisateurs(); // Recharger la liste des utilisateurs
        } else {
            const errorMessage = await response.json();
            console.error('Erreur lors de la création de l\'utilisateur:', errorMessage.message);
            alert('Erreur lors de la création de l\'utilisateur: ' + errorMessage.message);
        }
    } catch (error) {
        console.error('Erreur lors de la création de l\'utilisateur:', error);
        alert('Erreur lors de la création de l\'utilisateur.');
    }
}

// Fonction pour charger la liste des utilisateurs
async function chargerUtilisateurs() {
    try {
        const response = await fetch('http://192.168.200.228:8085/users', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        const utilisateurs = await response.json();
        const tableBody = document.getElementById('tableUtilisateursBody');
        tableBody.innerHTML = ''; // Vider la table

        utilisateurs.forEach(utilisateur => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${utilisateur.NomUtilisateur}</td>
                <td>${utilisateur.NomProfil}</td>
                <td>
                    <button class="btn btn-primary" onclick="chargerUtilisateurPourModification(${utilisateur.UtilisateurID})">Modifier</button>
                    <button class="btn btn-danger" onclick="supprimerUtilisateur(${utilisateur.UtilisateurID})">Supprimer</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des utilisateurs :', error);
    }
}

// Fonction pour charger un utilisateur pour la modification
async function chargerUtilisateurPourModification(utilisateurId) {
    try {
        const response = await fetch(`http://192.168.200.228:8085/users/${utilisateurId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });

        const utilisateur = await response.json();

        document.getElementById('modifyUtilisateurId').value = utilisateur.UtilisateurID;
        document.getElementById('modifyUsername').value = utilisateur.NomUtilisateur;

        // Charger les profils dans le select du formulaire de modification
        await chargerProfilsDansSelect(utilisateur.ProfilID, 'modifyProfile');
    } catch (error) {
        console.error('Erreur lors du chargement de l\'utilisateur :', error);
    }
}


// Fonction pour charger la liste des profils dans le formulaire de modification des utilisateurs
async function chargerProfilsDansSelect(selectedProfileId = null, selectId) {
    try {
        const response = await fetch('http://192.168.200.228:8085/profiles', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        const profils = await response.json();

        const selectElement = document.getElementById(selectId);
        if (!selectElement) {
            console.error(`L'élément #${selectId} n'existe pas dans le DOM.`);
            return;
        }

        selectElement.innerHTML = ''; // Nettoie les options existantes

        profils.forEach(profil => {
            const option = document.createElement('option');
            option.value = profil.ProfilID;
            option.textContent = profil.NomProfil;
            if (profil.ProfilID === selectedProfileId) {
                option.selected = true; // Sélectionne le profil actuel
            }
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des profils :', error);
    }
}




// Fonction pour modifier un utilisateur
async function modifierUtilisateur() {
    const utilisateurId = document.getElementById('modifyUtilisateurId').value;
    const password = document.getElementById('modifyPassword').value;
    const profileId = document.getElementById('modifyProfile').value;

    try {
        const response = await fetch(`http://192.168.200.228:8085/updateUser/${utilisateurId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password, profileId })
        });

        if (response.ok) {
            alert('Utilisateur modifié avec succès.');
            chargerUtilisateurs(); // Recharger la liste des utilisateurs
        } else {
            alert('Erreur lors de la modification de l\'utilisateur.');
        }
    } catch (error) {
        console.error('Erreur lors de la modification de l\'utilisateur :', error);
    }
}

// Fonction pour supprimer un utilisateur
async function supprimerUtilisateur(utilisateurID) {
    const confirmation = confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?");
    if (!confirmation) return;

    try {
        const response = await fetch(`http://192.168.200.228:8085/deleteUser/${utilisateurID}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });

        if (response.ok) {
            alert('Utilisateur supprimé avec succès.');
            chargerUtilisateurs(); // Recharger la liste des utilisateurs après suppression
        } else {
            alert('Erreur lors de la suppression de l\'utilisateur.');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur :', error);
    }
}

// Fonction pour charger la liste des profils
async function chargerProfils() {
    const tableBody = document.getElementById('tableProfilsBody');
    tableBody.innerHTML = ''; // Vider la table

    try {
        const response = await fetch('http://192.168.200.228:8085/profiles', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        const profils = await response.json();

        profils.forEach(profil => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${profil.NomProfil}</td>
                <td>${profil.OngletsAccessibles}</td>
                <td>${profil.AutoDeconnexionTemps !== null ? profil.AutoDeconnexionTemps : 'Illimité'}</td>
                <td>
                    <button class="btn btn-primary" onclick="chargerProfilPourModification(${profil.ProfilID})">Modifier</button>
                    <button class="btn btn-danger" onclick="supprimerProfil(${profil.ProfilID})">Supprimer</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des profils :', error);
    }
}

// Fonction pour charger les profils dans le formulaire de création d'utilisateur
async function chargerProfilsDansUtilisateurs() {
    const profileSelect = document.getElementById('createProfile');
    
    if (!profileSelect) {
        console.error("L'élément #newProfile n'existe pas dans le DOM.");
        return; // Arrêter si l'élément n'existe pas
    }
    
    profileSelect.innerHTML = ''; // Vider le select
    
    try {
        const response = await fetch('http://192.168.200.228:8085/profiles', {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });
        const profils = await response.json();

        profils.forEach(profil => {
            const option = document.createElement('option');
            option.value = profil.ProfilID;
            option.textContent = profil.NomProfil;
            profileSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des profils :', error);
    }
}

// Fonction complète pour créer un profil
async function creerProfil() {
    // Récupérer les valeurs des éléments du formulaire
    const nomProfil = document.getElementById('nomProfil');
    const checkboxes = document.querySelectorAll('#ongletsAccessiblesCheckboxes input[type="checkbox"]:checked');
    const autoDeconnexionTemps = document.getElementById('autoDeconnexionTemps').value;

    // Vérification que le nom du profil est renseigné
    if (!nomProfil || !nomProfil.value) {
        alert('Veuillez entrer un nom de profil.');
        return;
    }

    // Vérification que des onglets ont été sélectionnés
    if (!checkboxes.length) {
        alert('Veuillez sélectionner au moins un onglet accessible.');
        return;
    }

    // Récupérer les onglets sélectionnés
    const ongletsAccessibles = Array.from(checkboxes).map(checkbox => checkbox.value).join(',');

    // Créer l'objet à envoyer
    const profilData = {
        nomProfil: nomProfil.value,
        ongletsAccessibles: ongletsAccessibles,
        autoDeconnexionTemps: autoDeconnexionTemps || null
    };

    try {
        // Requête POST vers le backend pour créer un profil
        const response = await fetch('http://192.168.200.228:8085/profiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`
            },
            body: JSON.stringify(profilData) // Convertir l'objet en JSON
        });

        // Vérifier si la réponse est correcte
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la création du profil.');
        }

        // Afficher un message de succès
        alert('Profil créé avec succès.');

        // Réinitialiser le formulaire après la création réussie
        document.getElementById('creationProfilForm').reset();

        // (Optionnel) Appeler une fonction pour rafraîchir la liste des profils après la création
        chargerProfils(); 

    } catch (error) {
        console.error('Erreur lors de la création du profil :', error);
        alert('Erreur lors de la création du profil : ' + error.message);
    }
}

// Fonction pour supprimer un profil
async function supprimerProfil(profilID) {
    const confirmation = confirm("Êtes-vous sûr de vouloir supprimer ce profil ?");
    if (!confirmation) return;

    try {
        const response = await fetch(`http://192.168.200.228:8085/deleteProfile/${profilID}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });

        if (response.ok) {
            alert('Profil supprimé avec succès.');
            chargerProfils(); // Recharger la liste des profils après suppression
        } else {
            alert('Erreur lors de la suppression du profil.');
        }
    } catch (error) {
        console.error('Erreur lors de la suppression du profil :', error);
    }
}

async function modifierProfil() {
    try {
        // Récupération de l'ID du profil à modifier
        const profilId = document.getElementById('profilId').value;
        const nomProfil = document.getElementById('nomProfilMod').value;

        // Récupération des onglets cochés
        const checkboxes = document.querySelectorAll('#ongletsAccessiblesCheckboxesMod input[type="checkbox"]:checked');
        
        // Récupération de la valeur du timeout
        const autoDeconnexionTemps = document.getElementById('autoDeconnexionTempsMod').value;

        // Vérifications des champs requis
        if (!profilId) {
            alert('L\'ID du profil est manquant.');
            return;
        }

        if (!nomProfil) {
            alert('Le nom du profil est requis.');
            return;
        }

        if (!checkboxes.length) {
            alert('Veuillez sélectionner au moins un onglet.');
            return;
        }

        // Récupération des valeurs des cases cochées (onglets accessibles)
        const ongletsAccessibles = Array.from(checkboxes).map(checkbox => checkbox.value).join(',');

        // Requête PUT pour modifier le profil sur le serveur, l'ID du profil doit être dans l'URL
        const response = await fetch(`http://192.168.200.228:8085/profiles/${profilId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` // Jeton JWT pour authentification
            },
            body: JSON.stringify({
                nomProfil: nomProfil,
                ongletsAccessibles: ongletsAccessibles,
                autoDeconnexionTemps: autoDeconnexionTemps || null // Envoyer le timeout ou null si vide
            })
        });

        // Vérifier si la requête a réussi
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Erreur lors de la modification du profil.');
        }

        // Si la modification est réussie
        alert('Profil modifié avec succès.');
        
        // Réinitialisation du formulaire après la modification
        document.getElementById('modificationProfilForm').reset();

        // Rafraîchir la liste des profils
        chargerProfils();

    } catch (error) {
        console.error('Erreur lors de la modification du profil :', error);
        alert('Erreur lors de la modification du profil : ' + error.message);
    }
}

async function chargerProfilPourModification(profilId) {
    try {
        const response = await fetch(`http://192.168.200.228:8085/profiles/${profilId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            alert('Erreur lors de la récupération des détails du profil.');
            return;
        }

        const profil = await response.json();

        // Remplissez les champs du formulaire avec les données du profil récupéré
        document.getElementById('profilId').value = profil.ProfilID;
        document.getElementById('nomProfilMod').value = profil.NomProfil;

        // Remplissez les cases à cocher pour les onglets accessibles
        const ongletsAccessibles = profil.OngletsAccessibles.split(',');
        document.querySelectorAll('#ongletsAccessiblesCheckboxesMod input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = ongletsAccessibles.includes(checkbox.value);
        });

        // Définir le délai de déconnexion automatique
        document.getElementById('autoDeconnexionTempsMod').value = profil.AutoDeconnexionTemps || '';

        // Affichez le formulaire de modification (si nécessaire)
        document.getElementById('modificationProfilForm').style.display = 'block';
    } catch (error) {
        console.error('Erreur lors du chargement du profil :', error);
        alert('Une erreur est survenue lors du chargement du profil.');
    }
}


// Fonction pour charger un profil pour modification
async function chargerUtilisateurPourModification(utilisateurId) {
    try {
        const response = await fetch(`http://192.168.200.228:8085/users/${utilisateurId}`, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}` }
        });

        const utilisateur = await response.json();

        // Vérifiez que les éléments existent avant de définir leurs valeurs
        const modifyUtilisateurId = document.getElementById('modifyUtilisateurId');
        const modifyUsername = document.getElementById('modifyUsername');

        if (!modifyUtilisateurId || !modifyUsername) {
            console.error('Les champs de modification utilisateur ne sont pas trouvés dans le DOM.');
            return;
        }

        modifyUtilisateurId.value = utilisateur.UtilisateurID;
        modifyUsername.value = utilisateur.NomUtilisateur;

        // Charger les profils dans le select du formulaire de modification
        await chargerProfilsDansSelect(utilisateur.ProfilID, 'modifyProfile');
    } catch (error) {
        console.error('Erreur lors du chargement de l\'utilisateur :', error);
    }
}
