// Fonction pour formater la date au format attendu
function formatDate(dateString) {
    // Convertir en objet Date
    const date = new Date(dateString);
    
    // Extraire les composants de la date et de l'heure
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2); // Ajouter un zéro si nécessaire
    const day = ('0' + date.getDate()).slice(-2);
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    
    // Retourner la date formatée
    return `${year}-${month}-${day} ${hours}:${minutes}:00`;
    }
    
    async function creerDetenteurQRCodeVisiteur() {
    const nom = document.getElementById('nomVisiteur').value;
    const prenom = document.getElementById('prenomVisiteur').value;
    const societe = document.getElementById('societeVisiteur').value;
    const dateDebut = document.getElementById('dateDebut').value;
    const dateFin = document.getElementById('dateFin').value;
    
    // Formatter les dates avant de les envoyer au serveur
    const dateDebutFormatted = formatDate(dateDebut);
    const dateFinFormatted = formatDate(dateFin);
    
    try {
    const response = await fetch('http://192.168.201.36:8085/creerDetenteurAvecQRCode', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            nom,
            prenom,
            societe,
            dateDebut: dateDebutFormatted,  // Envoyer la date formatée
            dateFin: dateFinFormatted      // Envoyer la date formatée
        })
    });
    
    if (response.ok) {
        const data = await response.json();
        alert('Visiteur créé avec succès !');
    } else {
        const errorData = await response.json();
        alert(`Erreur lors de la création du détenteur : ${errorData.error}`);
    }
    } catch (error) {
    console.error('Erreur lors de la création du détenteur :', error);
    alert('Une erreur est survenue lors de la création du détenteur.');
    await rechercherVisiteurs()
    }
    }
    
    
    async function rechercherVisiteurs() {
    try {
    const response = await fetch('http://192.168.201.36:8085/rechercherVisiteurs', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
            'Content-Type': 'application/json'
        }
    });
    
    if (response.ok) {
        const visiteurs = await response.json();
        const bodyTableVisiteurs = document.getElementById('bodyTableVisiteurs');
        bodyTableVisiteurs.innerHTML = ''; // Vider les résultats précédents
    
        if (visiteurs.length > 0) {
            visiteurs.forEach(visiteur => {
                const newRow = bodyTableVisiteurs.insertRow();
    
                const cellNom = newRow.insertCell();
                const cellPrenom = newRow.insertCell();
                const cellNumero = newRow.insertCell();
                const cellQRCode = newRow.insertCell();
    
                cellNom.textContent = visiteur.Last_Name;
                cellPrenom.textContent = visiteur.First_Name;
                cellNumero.textContent = visiteur.Num;
    
                if (visiteur.qrCode) {
                    const qrImage = document.createElement('img');
                    qrImage.src = visiteur.qrCode;
                    qrImage.alt = 'QR Code';
                    cellQRCode.appendChild(qrImage);
    
                    // Assure-toi que les bonnes données sont passées à la fonction d'impression
                    qrImage.onclick = () => imprimerCarte(
                        visiteur.qrCode,
                        visiteur.Last_Name,
                        visiteur.First_Name,
                        visiteur.Start_Date, 
                        visiteur.TO_Date,
                        visiteur.Company
                    );
                } else {
                    cellQRCode.textContent = 'QR Code indisponible';
                }
            });
    
            document.getElementById('resultatsRechercheVisiteurs').style.display = 'block';
        } else {
            alert('Aucun visiteur trouvé.');
        }
    } else {
        alert('Erreur lors de la recherche des visiteurs.');
    }
    } catch (error) {
    console.error('Erreur lors de la recherche des visiteurs :', error);
    }
    }
    
    // Fonction pour formater la date en soustrayant 2 heures
    function formaterDateAvecCorrection(dateString) {
    // Créer un objet Date à partir de la chaîne de date fournie
    const date = new Date(dateString);
    
    // Soustraire 2 heures pour corriger le fuseau horaire
    date.setHours(date.getHours() - 2);
    
    // Extraire les composants de la date
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Mois indexé à 0
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    // Retourner la date dans le format dd/mm/yyyy hh:mm
    return `${day}/${month}/${year} ${hours}:${minutes}`;
    }
    
    function imprimerCarte(qrCode, nom, prenom, dateDebut, dateFin, societe) {
    const dateDebutFormattee = formaterDateAvecCorrection(dateDebut);  // Correction de l'heure
    const dateFinFormattee = formaterDateAvecCorrection(dateFin);      // Correction de l'heure
    
    const printWindow = window.open('', '_blank');
    const content = `
    <html>
    <head>
        <title>Imprimer QR Code</title>
        <style>
            @media print {
                @page {
                    size: 54mm 86mm;
                    margin: 0;
                }
                body {
                    margin: 0;
                    padding: 0;
                    width: 54mm;
                    height: 86mm;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    font-family: Arial, sans-serif;
                }
                .card-content {
                    text-align: center;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    justify-content: space-between;
                }
                .card-content h3 {
                    font-size: 12pt;
                    margin-bottom: 10px;
                }
                .card-content p {
                    margin: 0;
                    font-size: 10pt;
                }
                .card-content img {
                    width: 50mm;
                    height: 50mm;
                    margin-top: 5px;
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                }
            }
        </style>
    </head>
    <body>
        <div class="card-content">
            <h3>Carte Visiteur</h3>
            <p>${nom}</p>
            <p>${prenom}</p>
            <p>${societe}</p>
            <p>${dateDebutFormattee}</p>
            <img src="${qrCode}" alt="QR Code" class="qr-code">
        </div>
    </body>
    </html>
    `;
    
    printWindow.document.open();
    printWindow.document.write(content);
    printWindow.document.close();
    
    printWindow.onload = function () {
    printWindow.focus();
    printWindow.print();
    printWindow.close();
    };
    }