// Fonction pour vérifier si un numéro existe déjà dans la base de données
async function verifierNumeroExiste(numero) {
    try {
        const response = await fetch('http://192.168.200.228:8085/verifierNumeroExiste', {
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
        const response = await fetch('http://192.168.200.228:8085/detenteurs', {
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
        `;
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
    document.getElementById('groupeAccesDetenteur').value = cleanAccessGroup(detenteur.groupeAcces || '');
}

// Fonction pour effacer le formulaire
function effacerFormulaire() {
    document.getElementById('numero').value = '';
    document.getElementById('nom').value = '';
    document.getElementById('prenom').value = '';
    document.getElementById('type').value = '';
    document.getElementById('badge').value = '';
    document.getElementById('technologie').value = '';
    document.getElementById('groupeAccesDetenteur').value = '';
}

// Fonction pour créer un détenteur via XML
async function creerDetenteur() {
    const numero = document.getElementById('numero').value;
    const nom = document.getElementById('nom').value;
    const prenom = document.getElementById('prenom').value;
    const type = document.getElementById('type').value;
    const badge = document.getElementById('badge').value;
    const technologie = document.getElementById('technologie').value;
    const groupeAcces = document.getElementById('groupeAccesDetenteur').value;

    const erreurNumeroMessage = document.getElementById('erreurNumeroMessage');
    erreurNumeroMessage.style.display = 'none';

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

        const response = await fetch('http://192.168.200.228:8085/creerDetenteur', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ numero, nom, prenom, type, badge, technologie, groupeAcces }),
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

    const nom = document.getElementById('nom').value;
    const prenom = document.getElementById('prenom').value;
    const type = document.getElementById('type').value;
    const badge = document.getElementById('badge').value;
    const technologie = document.getElementById('technologie').value;
    const groupeAcces = document.getElementById('groupeAccesDetenteur').value;

    try {
        const response = await fetch(`http://192.168.200.228:8085/detenteurs/${numero}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`
            },
            body: JSON.stringify({ nom, prenom, type, badge, technologie, groupeAcces })
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
        setTimeout(() => chargerListeDetenteurs(), 2500);
    }
}

async function supprimerDetenteur() {
    const numero = document.getElementById('numero').value;

    if (!numero) {
        alert('Aucun détenteur sélectionné pour suppression.');
        return;
    }

    try {
        const response = await fetch('http://192.168.200.228:8085/detenteurs/supprimer', {
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

// Initialisation au chargement
document.addEventListener('DOMContentLoaded', async () => {
    const selectIdDetenteur = 'groupeAccesDetenteur';
    if (document.getElementById(selectIdDetenteur)) await chargerGroupesAcces(selectIdDetenteur);

    document.getElementById('onglet-gestion-des-detenteurs').addEventListener('click', async () => {
        await chargerListeDetenteurs();
    });

    // Charger immédiatement la liste des détenteurs
    await chargerListeDetenteurs();
});