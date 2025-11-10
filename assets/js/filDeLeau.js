async function filDeLEau() {
    const eventLogTableBody = document.getElementById('eventLogBody');

    try {
        const response = await fetch('http://192.168.201.36:8085/filDeLEau', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${sessionStorage.getItem('accessToken')}`,
                'Content-Type': 'application/json',
            },
        });

        const eventLogData = await response.json();



        if (eventLogData && eventLogData.length > 0) {
            const fragment = document.createDocumentFragment();

            eventLogData.forEach(entry => {

                // Utiliser directement la date brute
                const formattedDate = formatDateRaw(entry.Date);

                const tableRow = document.createElement('tr');
                tableRow.innerHTML = `
                    <td>${getEventType(entry.Trn_Type)}</td>
                    <td>${formattedDate}</td>
                    <td>${entry.From_Name}</td>
                    <td>${getBadgeCode(entry.Trn_Type, entry.Desc3)}</td>
                `;
                fragment.appendChild(tableRow);
            });

            eventLogTableBody.innerHTML = '';
            eventLogTableBody.appendChild(fragment);
        } else {
            const defaultMessage = document.createElement('tr');
            defaultMessage.innerHTML = '<td colspan="4">Aucun événement dans le fil de l\'eau.</td>';
            eventLogTableBody.innerHTML = '';
            eventLogTableBody.appendChild(defaultMessage);
        }
    } catch (error) {
        const errorMessage = document.createElement('tr');
        errorMessage.innerHTML = '<td colspan="4">Erreur lors de la récupération du fil de l\'eau.</td>';
        eventLogTableBody.innerHTML = '';
        eventLogTableBody.appendChild(errorMessage);
    }
}

function formatDateRaw(dateString) {


    // Diviser la chaîne brute sans manipuler les heures
    const [datePart, timePart] = dateString.split('T');
    const [hours, minutes, secondsWithZ] = timePart.split(':');
    const cleanSeconds = secondsWithZ.split('.')[0];

    const [year, month, day] = datePart.split('-');

    // Retourner une chaîne formattée directement
    const formattedDate = `${day}/${month}/${year} - ${hours}:${minutes}:${cleanSeconds}`;
    return formattedDate;
}

function getEventType(trnType) {
    switch (trnType) {
        case 24:
            return 'Coupure du courant';
        case 25:
            return 'Remise du courant';
        case 32:
            return 'Erreur de communication';
        case 31:
            return 'Communication OK';
        case 61:
            return 'Badge Inconnu';
        case 63:
            return 'Badge non Alloué';
        case 1:
            return 'Accès Accordé';
        case 3:
            return 'Accès Refusé';
        default:
            return '';
    }
}

function getBadgeCode(trnType, desc3) {
    if (trnType === 1 || trnType === 3 || trnType === 61) {
        return `${desc3}`;
    }
    return '';
}
