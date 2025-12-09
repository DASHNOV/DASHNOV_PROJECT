function formatDate(dateString) {
    if (!dateString) return ''; // Si aucune date n'est fournie, retourner une chaîne vide.

    // Convertir en objet Date
    const date = new Date(dateString);

    // Extraire les composants de la date et de l'heure
    const day = ('0' + date.getDate()).slice(-2); // Ajouter un zéro si nécessaire
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // Ajouter un zéro si nécessaire
    const year = date.getFullYear();
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);

    // Retourner la date au format `DD/MM/YYYY HH:MM`
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}


function getFormValues() {
    const numero = document.getElementById('numero').value;
    const nom = document.getElementById('nom').value;
    const prenom = document.getElementById('prenom').value;
    const type = document.getElementById('type').value;
    const badge = document.getElementById('badge').value;
    const technologie = document.getElementById('technologie').value;
    const groupeAcces = document.getElementById('groupeAccesDetenteur').value;
    const societe = document.getElementById('societe').value;
    const dateDebutCRDHLD = document.getElementById('dateDebutCRDHLD').value;
    const dateFinCRDHLD = document.getElementById('dateFinCRDHLD').value;
    const groupeAscenseurCRDHLD = document.getElementById('groupeAscenseurCRDHLD').value;
    const codePin = document.getElementById('codePin').value;
    const departement = document.getElementById('departement').value;
    const valide = document.getElementById('valide').checked;

    const dateDebutFormatted = formatDate(dateDebutCRDHLD);
    const dateFinFormatted = formatDate(dateFinCRDHLD);

    return {
        numero,
        nom,
        prenom,
        type,
        badge,
        technologie,
        groupeAcces,
        societe,
        dateDebutCRDHLD: dateDebutFormatted,
        dateFinCRDHLD: dateFinFormatted,
        groupeAscenseurCRDHLD,
        codePin,
        departement,
        valide
    };
}



// Fonction pour vérifier si un numéro existe déjà dans la base de données
async function verifierNumeroExiste(numero) {
    try {
        const response = await fetch('http://192.168.201.36:8085/verifierNumeroExiste', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ numero }),
        });

        if (!response.ok) {
            console.error('Erreur lors de la vérification du numéro existant.');
            return false;
        }

        const data = await response.json();
        return data.existe;
    } catch (error) {
        console.error('Erreur lors de la vérification du numéro existant :', error);
        return false;
    }
}

// Fonction pour charger la liste des détenteurs
async function chargerListeDetenteurs() {
    try {
        const response = await fetch('http://192.168.201.36:8085/detenteurs', {
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`
            }
        });

        if (!response.ok) {
            throw new Error('Erreur lors de la récupération des détenteurs.');
        }

        const detenteurs = await response.json();

        // Filtrer pour masquer les détenteurs de type "Effacé"
        const detenteursFiltres = detenteurs.filter(d => d.type !== 'Effacé');

        chargerTableDetenteurs(detenteursFiltres);
    } catch (error) {
        console.error('Erreur lors du chargement des détenteurs :', error);
    }
}

// Fonction pour afficher les détenteurs dans le tableau
function chargerTableDetenteurs(detenteurs) {
    const tableBody = document.getElementById('tableBodyDetenteurs');

    if (!tableBody) {
        console.error("Élément avec l'ID 'tableBodyDetenteurs' introuvable dans le DOM.");
        return;
    }

    tableBody.innerHTML = ''; // Réinitialiser le tableau

    detenteurs.forEach(detenteur => {
        const ligne = document.createElement('tr');
        ligne.dataset.numero = detenteur.numero; // Utiliser le champ 'numero' correctement

        ligne.innerHTML = `
            <td>${detenteur.nom || ""}</td>
            <td>${detenteur.prenom || ""}</td>
            <td>${detenteur.type || ""}</td>
            <td>${detenteur.badge || ""}</td>
            <td>${detenteur.technologie || ""}</td>
            <td>${detenteur.numero || ""}</td>
            <td>${cleanAccessGroup(detenteur.groupeAcces) || ""}</td>
            <td>${detenteur.societe || ""}</td>
            <td>${detenteur.dateDebutCRDHLD ? new Date(detenteur.dateDebutCRDHLD).toLocaleDateString() : ""}</td>
            <td>${detenteur.dateFinCRDHLD ? new Date(detenteur.dateFinCRDHLD).toLocaleDateString() : ""}</td>
            <td>${detenteur.groupeAscenseurCRDHLD || ""}</td>
            <td>${detenteur.codePin || ""}</td>
            <td>${detenteur.departement || ""}</td>
            <td>${detenteur.valide ? "Oui" : "Non"}</td>
        `;

        // Ajouter un événement au clic pour charger les données dans le formulaire
        ligne.addEventListener('click', () => chargerDetenteurDansFormulaire(detenteur));
        tableBody.appendChild(ligne);
    });
}


// Fonction pour charger les informations d'un détenteur dans le formulaire
function chargerDetenteurDansFormulaire(detenteur) {
    document.getElementById('numero').value = detenteur.numero || '';
    document.getElementById('nom').value = detenteur.nom || '';
    document.getElementById('prenom').value = detenteur.prenom || '';
    document.getElementById('type').value = getTypeValue(detenteur.type || '');
    document.getElementById('badge').value = detenteur.badge || '';
    document.getElementById('technologie').value = detenteur.technologie || '';
    document.getElementById('societe').value = detenteur.societe || '';
    document.getElementById('dateDebutCRDHLD').value = detenteur.dateDebutCRDHLD ? new Date(detenteur.dateDebutCRDHLD).toISOString().split('T')[0] : ''; // Formater en YYYY-MM-DD
    document.getElementById('dateFinCRDHLD').value = detenteur.dateFinCRDHLD ? new Date(detenteur.dateFinCRDHLD).toISOString().split('T')[0] : ''; // Formater en YYYY-MM-DD
    document.getElementById('codePin').value = detenteur.codePin || '';
    document.getElementById('departement').value = detenteur.departement || '';
    document.getElementById('groupeAscenseurCRDHLD').value = detenteur.groupeAscenseur || '';
    document.getElementById('groupeAccesDetenteur').value = cleanAccessGroup(detenteur.groupeAcces || '');
    document.getElementById('valide').checked = detenteur.valide || false; // Coche ou décoche en fonction de la valeur
}

// Fonction pour effacer le formulaire
function effacerFormulaire() {
    document.getElementById('numero').value = '';
    document.getElementById('nom').value = '';
    document.getElementById('prenom').value = '';
    document.getElementById('type').value = '';
    document.getElementById('badge').value = '';
    document.getElementById('technologie').value = '';
    document.getElementById('societe').value = '';
    document.getElementById('dateDebutCRDHLD').value = '';
    document.getElementById('dateFinCRDHLD').value = '';
    document.getElementById('codePin').value = '';
    document.getElementById('departement').value = '';
    document.getElementById('groupeAscenseurCRDHLD').value = '';
    document.getElementById('groupeAccesDetenteur').value = '';
    document.getElementById('valide').checked = false; // Décoche le champ validé
}


// Fonction pour créer un détenteur via XML
async function creerDetenteur() {
    const data = getFormValues();

    const erreurNumeroMessage = document.getElementById('erreurNumeroMessage');
    erreurNumeroMessage.style.display = 'none';

     // Vérifiez les champs obligatoires dans l'objet `data`
     const { numero, nom, prenom, type, badge, technologie, groupeAcces } = data;

    if (!numero || !nom || !prenom || !type || !badge || !technologie || !groupeAcces) {
        alert('Veuillez remplir tous les champs du formulaire.');
        return;
    }

    try {
        const numeroExiste = await verifierNumeroExiste(numero);

        if (numeroExiste) {
            erreurNumeroMessage.textContent = 'Ce numéro existe déjà. La création du détenteur est bloquée.';
            erreurNumeroMessage.style.display = 'block';
            return;
        }

        const response = await fetch('http://192.168.201.36:8085/creerDetenteur', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Détenteur créé avec succès!');
        } else {
            throw new Error('Erreur lors de la création du détenteur.');
        }
    } catch (error) {
        console.error('Erreur lors de la création du détenteur :', error);
        alert('Une erreur s\'est produite lors de la création du détenteur.');
    } finally {
        setTimeout(() => chargerListeDetenteurs(), 2500);
    }
}

// Fonction pour modifier un détenteur
async function modifierDetenteur() {
    const numero = document.getElementById('numero').value;
    if (!numero) {
        alert('Aucun détenteur sélectionné pour modification.');
        return;
    }
    const data = getFormValues();

    try {
        const response = await fetch(`http://192.168.201.36:8085/detenteurs/${numero}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`
            },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            alert('Détenteur modifié avec succès!');
        } else {
            throw new Error('Erreur lors de la mise à jour du détenteur.');
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour du détenteur :', error);
        alert('Une erreur s\'est produite lors de la mise à jour du détenteur.');
    } finally {
        setTimeout(() => chargerListeDetenteurs(), 3500);
        setTimeout(() => effacerFormulaire(), 2500);
    }
}

async function supprimerDetenteur() {
    const numero = document.getElementById('numero').value;

    if (!numero) {
        alert('Aucun détenteur sélectionné pour suppression.');
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/detenteurs/supprimer', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ numero }),
        });

        if (!response.ok) {
            const data = await response.json();
            alert(data.error || 'Erreur lors de la suppression du détenteur.');
            return;
        }

        alert('Détenteur supprimé avec succès!');
        // Attendez un moment avant de recharger la liste
        setTimeout(() => chargerListeDetenteurs(), 2500);
        effacerFormulaire()
    } catch (error) {
        console.error('Erreur lors de la suppression du détenteur :', error);
        alert('Une erreur s\'est produite lors de la suppression.');
    }
}


// Fonction pour correspondre les types
function getTypeValue(type) {
    switch (type) {
        case 'Visiteur': return '0';
        case 'Employé': return '1';
        case 'Garde': return '2';
        case 'Effacé': return '3';
        default:
            console.warn(`Type inconnu : ${type}`);
            return '';
    }
}

// Nettoyer le groupe d'accès
function cleanAccessGroup(group) {
    return group ? group.replace(/;$/, '') : '';
}

// Charger les groupes d'accès ascenseurs
async function chargerGroupesAscenseurs(selectElementId) {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        console.warn("Token d'authentification manquant.");
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/listeGroupesAscenseurs', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const groupesAscenseurs = await response.json();
        const selectElement = document.getElementById(selectElementId);

        if (!selectElement) {
            console.error(`Élément select introuvable : ${selectElementId}`);
            return;
        }

        selectElement.innerHTML = '<option value="">-- Sélectionnez un groupe --</option>';
        groupesAscenseurs.forEach((groupe) => {
            const option = document.createElement('option');
            option.value = groupe.value; // CORRIGÉ
            option.textContent = groupe.label; // CORRIGÉ
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des groupes d\'accès ascenseurs :', error);
    }
}

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {;
    const selectIdDetenteur = 'groupeAccesDetenteur';
    if (document.getElementById(selectIdDetenteur)) await chargerGroupesAcces(selectIdDetenteur);

    document.getElementById('onglet-gestion-des-detenteurs').addEventListener('click', async () => {
        await chargerListeDetenteurs();
    });
    
    // Charger les groupes ascenseurs dès le début
    chargerGroupesAscenseurs('groupeAscenseurCRDHLD');

    // Charger immédiatement la liste des détenteurs
    await chargerListeDetenteurs();
});