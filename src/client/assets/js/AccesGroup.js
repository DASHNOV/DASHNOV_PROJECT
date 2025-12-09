async function chargerGroupesAcces(selectElementId) {
    const token = sessionStorage.getItem('accessToken');
    if (!token) {
        console.error('Token d\'authentification manquant.');
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/listeGroupesAcces', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
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

        // Vider les options existantes
        selectElement.innerHTML = '<option value="">-- Sélectionnez un groupe --</option>';

        // Ajouter les nouvelles options
        groupesAcces.forEach(groupe => {
            const option = document.createElement('option');
            option.value = groupe;
            option.textContent = groupe;
            selectElement.appendChild(option);
        });

        console.log(`Groupes d'accès chargés dans ${selectElementId}`);
    } catch (error) {
        console.error('Erreur lors du chargement des groupes d\'accès :', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const selectIdDetenteur = 'groupeAccesDetenteur';
    const selectIdSociete = 'groupeAccesSociete';

    if (document.getElementById(selectIdDetenteur)) {
        chargerGroupesAcces(selectIdDetenteur);
    }

    if (document.getElementById(selectIdSociete)) {
        chargerGroupesAcces(selectIdSociete);
    }
});
