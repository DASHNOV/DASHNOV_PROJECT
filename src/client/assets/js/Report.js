// Charger les rapports disponibles
async function chargerRapports() {
    try {
        console.log('Appel à l\'API pour charger les rapports');
        const response = await fetch('http://192.168.201.36:8085/rapports', {
            headers: { Authorization: `Bearer ${sessionStorage.getItem('accessToken')}` }
        });

        if (response.ok) {
            const rapports = await response.json();
            console.log('Rapports reçus :', rapports);

            const rapportSelect = document.getElementById('rapportSelect');
            rapportSelect.innerHTML = '<option value="" disabled selected>-- Sélectionnez un rapport --</option>';

            rapports.forEach(rapport => {
                const option = document.createElement('option');
                option.value = rapport.id;
                option.textContent = rapport.nom;
                rapportSelect.appendChild(option);
            });
        } else {
            console.error('Erreur lors du chargement des rapports :', response.statusText);
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des rapports :', error);
    }
}

// Ajouter un rapport via formulaire
async function ajouterRapport() {
    const nom = document.getElementById('nomRapport').value;
    const requete = document.getElementById('requeteRapport').value;

    if (!nom || !requete) {
        alert('Veuillez remplir tous les champs.');
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/rapports', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nom, requete })
        });

        if (response.ok) {
            alert('Rapport ajouté avec succès.');
            document.getElementById('ajoutRapportForm').reset();
            chargerRapports();
        } else {
            alert('Erreur lors de l\'ajout du rapport.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'ajout du rapport :', error);
    }
}

// Télécharger un rapport (PDF/XLS)
async function telechargerRapport(format) {
    const rapportId = document.getElementById('rapportSelect').value;

    if (!rapportId) {
        alert('Veuillez sélectionner un rapport.');
        return;
    }

    try {
        // Construire l'URL avec les paramètres requis
        const url = `http://192.168.201.36:8085/rapports/${rapportId}/telecharger?format=${format}`;

        // Faire une requête pour récupérer le fichier
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${sessionStorage.getItem('accessToken')}`
            }
        });

        if (response.ok) {
            // Récupérer le fichier sous forme de blob
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);

            // Créer un lien temporaire pour télécharger le fichier
            const a = document.createElement('a');
            a.href = url;

            // Définir un nom de fichier dynamique basé sur l'ID du rapport et le format
            a.download = `rapport_${rapportId}.${format.toLowerCase()}`;
            document.body.appendChild(a);

            // Déclencher le téléchargement
            a.click();

            // Nettoyer le DOM
            a.remove();
            window.URL.revokeObjectURL(url); // Libérer l'URL temporaire
        } else {
            const message = await response.text(); // Lire le message d'erreur du serveur
            console.error('Erreur serveur :', message);
            alert('Erreur lors du téléchargement du rapport.');
        }
    } catch (error) {
        console.error('Erreur lors du téléchargement du rapport :', error);
        alert('Une erreur est survenue. Veuillez réessayer.');
    }
}


// Initialisation
document.addEventListener('DOMContentLoaded', chargerRapports);
