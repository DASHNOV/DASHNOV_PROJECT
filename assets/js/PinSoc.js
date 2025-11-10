// Ajouter une nouvelle société avec code PIN
async function ajouterSociete() {
    const nomSociete = document.getElementById('nomSociete').value;
    const groupeAcces = document.getElementById('groupeAccesSociete').value;
    const groupeAscenseur = document.getElementById('groupeAscenseur').value;

    if (!nomSociete || !groupeAcces || !groupeAscenseur) {
        alert("Veuillez entrer un nom de société, sélectionner un groupe d'accès et un groupe d'accès ascenseur.");
        return;
    }

    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        alert("Votre session a expiré. Veuillez vous reconnecter.");
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/creerSocieteAvecCodePin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ nomSociete, groupeAcces, groupeAscenseur }),
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            await chargerSocietes();
            chargerMenuDeroulantSocietes();
        } else {
            alert(`Erreur : ${result.error}`);
        }
    } catch (error) {
        console.error('Erreur lors de la création de la société :', error);
    }
}

// Charger les sociétés dans le menu déroulant
async function chargerMenuDeroulantSocietes() {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        console.warn("Token d'authentification manquant.");
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/societes/noms', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const societes = await response.json();
        const select = document.getElementById('selectSociete');
        select.innerHTML = '<option value="">Toutes les sociétés</option>';
        societes.forEach((societe) => {
            const option = document.createElement('option');
            option.value = societe.nom;
            option.textContent = societe.nom;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement du menu déroulant des sociétés :', error);
    }
}

// Charger les sociétés avec une colonne "Semaine (Dates)"
async function chargerSocietes(nomSociete = '') {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        console.warn("Token d'authentification manquant.");
        return;
    }

    try {
        const response = await fetch(`http://192.168.201.36:8085/societes?nom=${encodeURIComponent(nomSociete)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const societes = await response.json();
        const tableBody = document.getElementById('tableCodesPins');
        tableBody.innerHTML = '';

        societes.forEach((societe) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${societe.nom || ''}</td>
                <td>${societe.Semaine || ''}</td>
                <td>${societe.SemaineDates || ''}</td>
                <td>${societe.Annee || ''}</td>
                <td>${societe.codePin || ''}</td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des sociétés :', error);
    }
}

// Charger les groupes d'accès
async function chargerGroupesAcces(selectElementId) {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        console.warn("Token d'authentification manquant.");
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/listeGroupesAcces', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const groupesAcces = await response.json();
        const selectElement = document.getElementById(selectElementId);

        if (!selectElement) {
            console.error(`Élément select introuvable : ${selectElementId}`);
            return;
        }

        selectElement.innerHTML = '<option value="">-- Sélectionnez un groupe --</option>';
        groupesAcces.forEach((groupe) => {
            const option = document.createElement('option');
            option.value = groupe;
            option.textContent = groupe;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des groupes d\'accès :', error);
    }
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
            option.value = groupe.authlift;
            option.textContent = groupe.name;
            selectElement.appendChild(option);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des groupes d\'accès ascenseurs :', error);
    }
}

// Filtrer les codes PIN par société
async function filtrerSocietes() {
    const nomSociete = document.getElementById('selectSociete').value;
    await chargerSocietes(nomSociete);
}

// Téléchargement du tableau filtré
async function telechargerTableau() {
    const nomSociete = document.getElementById('selectSociete').value;
    const token = sessionStorage.getItem('accessToken');

    try {
        const response = await fetch(`http://192.168.201.36:8085/telechargerTableau?nom=${encodeURIComponent(nomSociete)}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error(`Erreur HTTP : ${response.status}`);
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Codes_PIN_${nomSociete || 'Toutes_Societes'}.xls`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Erreur lors du téléchargement du tableau :', error);
    }
}

async function supprimerSociete() {
    const selectElement = document.getElementById('selectSociete');
    const nomSociete = selectElement.value;

    if (!nomSociete) {
        alert("Veuillez sélectionner une société à supprimer dans la liste déroulante.");
        return;
    }

    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        alert("Votre session a expiré. Veuillez vous reconnecter.");
        return;
    }

    if (!confirm(`Êtes-vous sûr de vouloir supprimer la société "${nomSociete}" ?`)) {
        return;
    }

    try {
        const response = await fetch(`http://192.168.201.36:8085/supprimerSociete`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ nomSociete }),
        });

        const result = await response.json();

        if (response.ok) {
            alert(result.message);
            await chargerSocietes(); // Recharger les sociétés après suppression
            chargerMenuDeroulantSocietes(); // Actualiser le menu déroulant des sociétés
        } else {
            alert(`Erreur : ${result.error}`);
        }
    } catch (error) {
        console.error('Erreur lors de la suppression de la société :', error);
    }
}

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    const selectIdSociete = 'groupeAccesSociete';
    const token = sessionStorage.getItem('accessToken');

    if (!token) {
        console.warn("Token d'authentification manquant à l'initialisation.");
        return;
    }

    if (document.getElementById(selectIdSociete)) {
        chargerGroupesAcces(selectIdSociete);
    }
    chargerGroupesAscenseurs('groupeAscenseur');
    chargerMenuDeroulantSocietes();
    chargerSocietes();
});
