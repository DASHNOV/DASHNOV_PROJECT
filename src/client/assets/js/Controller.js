// Charger la liste des contrôleurs et les afficher dans un tableau
async function chargerListeControleurs() {
    const tableBody = document.getElementById('tableControleursBody');
    tableBody.innerHTML = ''; // Réinitialiser le tableau

    try {
        const response = await fetch('http://192.168.201.36:8085/controller/liste', {
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
        });

        const controleurs = await response.json();

        if (!Array.isArray(controleurs)) {
            throw new Error("La réponse des contrôleurs n'est pas un tableau.");
        }

        controleurs.forEach(controleur => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="controleur-checkbox" data-controller-id="${controleur.ID}">
                </td>
                <td>${controleur.Name}</td>
                <td>
                    <button class="btn btn-primary btn-sm" onclick="envoyerRecreateMemoryTables(${controleur.ID})">Initialisation</button>
                    <button class="btn btn-success btn-sm" onclick="envoyerStartPolling(${controleur.ID})">Démarrer</button>
                    <button class="btn btn-danger btn-sm" onclick="envoyerStopPolling(${controleur.ID})">Arrêter</button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des contrôleurs :', error);
    }
}



// Envoyer une requête pour recréer les tables mémoire
async function envoyerRecreateMemoryTables(controllerId) {
    if (!controllerId) {
        alert('Aucun contrôleur sélectionné.');
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/controller/recreateMemoryTables', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ controllerId, restartPolling: 0, wantClearMemory: 1 }),
        });

        if (response.ok) {
            alert('Requête envoyée avec succès.');
        } else {
            alert('Échec de la requête.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la requête :', error);
    }
}

// Envoyer une requête pour démarrer le polling
async function envoyerStartPolling(controllerId) {
    if (!controllerId) {
        alert('Aucun contrôleur sélectionné.');
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/controller/startPolling', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ controllerId, syncId: 2, answerId: 'API_CONTROLLER' }),
        });

        if (response.ok) {
            alert('Requête de démarrage envoyée avec succès.');
        } else {
            alert('Échec de la requête.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la requête :', error);
    }
}

// Envoyer une requête pour arrêter le polling
async function envoyerStopPolling(controllerId) {
    if (!controllerId) {
        alert('Aucun contrôleur sélectionné.');
        return;
    }

    try {
        const response = await fetch('http://192.168.201.36:8085/controller/stopPolling', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ controllerId, syncId: 3, answerId: 'API_CONTROLLER' }),
        });

        if (response.ok) {
            alert('Requête d\'arrêt envoyée avec succès.');
        } else {
            alert('Échec de la requête.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'envoi de la requête :', error);
    }
}

async function executerActionGroupee(action) {
    // Récupérer tous les contrôleurs sélectionnés
    const checkboxes = document.querySelectorAll('.controleur-checkbox:checked');
    const selectedControllers = Array.from(checkboxes).map(checkbox => checkbox.dataset.controllerId);

    if (selectedControllers.length === 0) {
        alert("Veuillez sélectionner au moins un contrôleur.");
        return;
    }

    if (selectedControllers.length > 4) {
        alert("Vous ne pouvez sélectionner qu'un maximum de 4 contrôleurs.");
        return;
    }

    try {
        for (const controllerId of selectedControllers) {
            if (action === 'Initialisation') {
                await envoyerRecreateMemoryTables(controllerId);
            } else if (action === 'Démarrer le Polling') {
                await envoyerStartPolling(controllerId);
            } else if (action === 'Stop le Polling') {
                await envoyerStopPolling(controllerId);
            }
        }
        alert(`Action "${action}" exécutée avec succès pour les contrôleurs sélectionnés.`);
    } catch (error) {
        console.error(`Erreur lors de l'exécution de l'action "${action}" pour les contrôleurs sélectionnés :`, error);
        alert(`Une erreur est survenue lors de l'exécution de l'action "${action}".`);
    }
}



document.addEventListener('DOMContentLoaded', () => {
    chargerListeControleurs();
});
