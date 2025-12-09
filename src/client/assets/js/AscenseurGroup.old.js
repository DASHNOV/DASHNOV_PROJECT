// Fonction pour charger les groupes ascenseurs
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


// Initialisation au chargement du DOM
document.addEventListener('DOMContentLoaded', async () => {
    console.log("Chargement automatique des groupes ascenseurs au démarrage");

    const selectIdAscenseur = 'groupeAscenseurCRDHLD';
    if (document.getElementById(selectIdAscenseur)) {
        await chargerGroupesAscenseur(selectIdAscenseur);
    }
});
