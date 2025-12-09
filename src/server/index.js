const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const moment = require('moment-timezone');
const dotenv = require('dotenv');
const path = require('path');
const xmlbuilder = require('xmlbuilder');
const cron = require('node-cron');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const fs = require('fs');
const pdfKit = require('pdfkit');
const PDFDocument = require('pdfkit');
const excelJS = require('exceljs');
process.env.TZ = 'Europe/Paris';


const envFilePath = path.join(__dirname, 'config', 'SQL.env'); // Chemin relatif au dossier du serveur
const result = dotenv.config({ path: envFilePath });

if (result.error) {
    console.error('âŒ ERREUR: Fichier SQL.env introuvable Ã :', envFilePath);
    console.error('   CrÃ©ez ce fichier avec les paramÃ¨tres de connexion.');
    process.exit(1);
}

console.log('âœ“ Configuration chargÃ©e depuis:', envFilePath);

const app = express();
app.use(express.static(path.join(__dirname, '..', 'client')));

const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT, 10) || 8085;
const secretKey = 'your_secret_key'; // ClÃ© secrÃ¨te pour signer les jetons JWT
const logFilePath = path.resolve(__dirname, 'Connexion_User.log');

const corsOptions = {
    origin: '*',
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Credentials", "true");
    next();
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const config = {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    server: process.env.DB_SERVER,
    database: process.env.DB_DATABASE,
    options: {
        trustServerCertificate: true,
        language: 'French',
    },
    pool: {
        max: 10, // Nombre max de connexions dans le pool
        min: 0,
        idleTimeoutMillis: 30000 // DÃ©lai avant de fermer les connexions inactives
    },
    connectionTimeout: 30000,
    requestTimeout: 90000
};
// Validation de la configuration
console.log("Configuration de la base de donnÃ©es :", {
    server: config.server,
    database: config.database,
    user: config.user
});

const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_SERVER', 'DB_DATABASE'];
const missing = requiredVars.filter(v => !process.env[v]);
if (missing.length > 0) {
    console.error('âŒ ERREUR: Variables manquantes dans SQL.env:', missing.join(', '));
    process.exit(1);
}

console.log('âœ“ Configuration DB validÃ©e');
console.log(`  â†’ Serveur: ${config.server}`);
console.log(`  â†’ Base: ${config.database}`);
console.log(`  â†’ Utilisateur: ${config.user}\n`);


// --- POOL DE CONNEXIONS GLOBAL ---
const poolPromise = new sql.ConnectionPool(config)
    .connect()
    .then(pool => {
        console.log('Pool de connexions SQL global crÃ©Ã© et connectÃ©.');
        return pool;
    })
    .catch(err => console.error('Erreur de connexion au pool de la base de donnÃ©es :', err));



const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        console.log('Token d\'authentification manquant pour la requÃªte :', req.originalUrl);
        return res.status(401).json({ message: 'Token d\'authentification manquant' });
    }

    jwt.verify(token, secretKey, (err, user) => {
        if (err) {
            console.log('Token invalide ou expirÃ© pour la requÃªte :', req.originalUrl);
            return res.status(403).json({ message: 'Token invalide ou expirÃ©' });
        }
        req.user = user;
        next();
    });
};


const logUserConnection = (username, action) => {
    const logEntry = `${new Date().toISOString()} - ${username} - ${action}\n`;
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('Erreur lors de la journalisation de la connexion utilisateur :', err);
        } else {
            console.log(`Connexion utilisateur journalisÃ©e avec succÃ¨s : ${username}, action : ${action}`);
        }
    });
};

async function verifierEtCreerAdmin() {
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request().query('SELECT COUNT(*) AS userCount FROM Utilisateurs');
        const userCount = result.recordset[0].userCount;

        if (userCount === 0) {
            const profilAdmin = await pool.request()
                .query(`INSERT INTO Profils (NomProfil, OngletsAccessibles, AutoDeconnexionTemps)
                        OUTPUT INSERTED.ProfilID
                        VALUES ('Admin', 'Fil des Ã©vÃ©nements,Gestion des dÃ©tenteurs,Gestion des visiteurs,Gestion des utilisateurs,Gestion des profils,Gestion Codes PIN,Gestion des ContrÃ´leurs', NULL)`);

            const profilAdminID = profilAdmin.recordset[0].ProfilID;

            const hashedPassword = await bcrypt.hash('admin', 10);
            await pool.request()
                .input('username', sql.VarChar, 'admin')
                .input('password', sql.VarChar, hashedPassword)
                .input('profileId', sql.Int, profilAdminID)
                .query(`INSERT INTO Utilisateurs (NomUtilisateur, MotDePasse, ProfilID) VALUES (@username, @password, @profileId)`);

            console.log("Utilisateur administrateur crÃ©Ã© avec succÃ¨s.");
        } else {
            console.log("Des utilisateurs existent dÃ©jÃ . Aucun utilisateur administrateur n'a Ã©tÃ© crÃ©Ã©.");
        }
    } catch (error) {
        console.error('Erreur lors de la vÃ©rification ou crÃ©ation de l\'administrateur :', error);
    }
}


// Appeler cette fonction au dÃ©marrage du serveur
verifierEtCreerAdmin();

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request()
            .input('username', sql.VarChar, username)
            .query(`
                SELECT
                    u.UtilisateurID,
                    u.MotDePasse,
                    p.OngletsAccessibles,
                    p.AutoDeconnexionTemps
                FROM Utilisateurs u
                JOIN Profils p
                ON u.ProfilID = p.ProfilID
                WHERE u.NomUtilisateur = @username
            `);

        const user = result.recordset[0];
        if (!user) return res.status(401).json({ message: 'Utilisateur non trouvÃ©.' });

        const match = await bcrypt.compare(password, user.MotDePasse);
        if (!match) {
            return res.status(401).json({ message: 'Mot de passe incorrect.' });
        }

        let tokenOptions = {};
        if (user.AutoDeconnexionTemps === null || user.AutoDeconnexionTemps === undefined) {
            console.log('Utilisateur sans dÃ©connexion automatique.');
            tokenOptions = {};
        } else {
            console.log(`Utilisateur avec expiration automatique : ${user.AutoDeconnexionTemps} minutes.`);
            tokenOptions = { expiresIn: `${user.AutoDeconnexionTemps}m` }; // Utiliser la valeur de la DB
        }

        const accessToken = jwt.sign(
            {
                id: user.UtilisateurID,
                username,
                accessibleTabs: user.OngletsAccessibles,
            },
            secretKey,
            tokenOptions
        );

        res.json({
            accessToken,
            accessibleTabs: user.OngletsAccessibles,
            autoLogoutTime: user.AutoDeconnexionTemps,
        });
    } catch (error) {
        console.error('Erreur lors de la connexion :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});



app.post('/changePassword', authenticateToken, async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request()
            .input('userId', sql.Int, userId)
            .query('SELECT MotDePasse FROM Utilisateurs WHERE UtilisateurID = @userId');

        const user = result.recordset[0];
        if (!user) return res.status(404).json({ message: 'Utilisateur non trouvÃ©.' });

        const match = await bcrypt.compare(oldPassword, user.MotDePasse);
        if (!match) return res.status(401).json({ message: 'Ancien mot de passe incorrect.' });

        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.request()
            .input('userId', sql.Int, userId)
            .input('newPassword', sql.VarChar, hashedNewPassword)
            .query('UPDATE Utilisateurs SET MotDePasse = @newPassword WHERE UtilisateurID = @userId');

        res.status(200).json({ message: 'Mot de passe modifiÃ© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la modification du mot de passe :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/creerUtilisateur', authenticateToken, async (req, res) => {
    const { username, password, profileId } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    try {
        const pool = await poolPromise; // Utilisation du pool global
        await pool.request()
            .input('NomUtilisateur', sql.VarChar, username)
            .input('MotDePasse', sql.VarChar, hashedPassword)
            .input('ProfilID', sql.Int, profileId)
            .query('INSERT INTO Utilisateurs (NomUtilisateur, MotDePasse, ProfilID) VALUES (@NomUtilisateur, @MotDePasse, @ProfilID)');
        res.status(201).json({ message: 'Utilisateur crÃ©Ã© avec succÃ¨s' });
    } catch (error) {
        console.error('Erreur lors de la crÃ©ation de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.get('/users', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request().query(`
            SELECT u.UtilisateurID, u.NomUtilisateur, p.NomProfil
            FROM Utilisateurs u
            LEFT JOIN Profils p ON u.ProfilID = p.ProfilID
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des utilisateurs :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.get('/users/:id', authenticateToken, async (req, res) => {
    const utilisateurID = req.params.id;
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request()
            .input('UtilisateurID', sql.Int, utilisateurID)
            .query('SELECT UtilisateurID, NomUtilisateur, ProfilID FROM Utilisateurs WHERE UtilisateurID = @UtilisateurID');
        const utilisateur = result.recordset[0];
        if (!utilisateur) {
            return res.status(404).json({ message: 'Utilisateur non trouvÃ©' });
        }
        res.status(200).json(utilisateur);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.put('/updateUser/:id', authenticateToken, async (req, res) => {
    const utilisateurID = req.params.id;
    const { password, profileId } = req.body;

    try {
        const pool = await poolPromise; // Utilisation du pool global

        if (password) {
            const hashedPassword = await bcrypt.hash(password, 10);
            await pool.request()
                .input('UtilisateurID', sql.Int, utilisateurID)
                .input('MotDePasse', sql.VarChar, hashedPassword)
                .query('UPDATE Utilisateurs SET MotDePasse = @MotDePasse WHERE UtilisateurID = @UtilisateurID');
        }

        await pool.request()
            .input('UtilisateurID', sql.Int, utilisateurID)
            .input('ProfilID', sql.Int, profileId)
            .query('UPDATE Utilisateurs SET ProfilID = @ProfilID WHERE UtilisateurID = @UtilisateurID');

        res.status(200).json({ message: 'Utilisateur modifiÃ© avec succÃ¨s' });
    } catch (error) {
        console.error('Erreur lors de la modification de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.get('/profiles', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request().query('SELECT ProfilID, NomProfil, OngletsAccessibles, AutoDeconnexionTemps FROM Profils');
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des profils :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.get('/profiles/:id', authenticateToken, async (req, res) => {
    const profilID = req.params.id;

    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request()
            .input('ProfilID', sql.Int, profilID)
            .query('SELECT ProfilID, NomProfil, OngletsAccessibles, AutoDeconnexionTemps FROM Profils WHERE ProfilID = @ProfilID');

        const profil = result.recordset[0];

        if (!profil) {
            return res.status(404).json({ message: 'Profil non trouvÃ©.' });
        }

        res.status(200).json(profil);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration du profil :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.put('/profiles/:id', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { nomProfil, ongletsAccessibles, autoDeconnexionTemps } = req.body;

    if (!nomProfil || !ongletsAccessibles) {
        return res.status(400).json({ message: 'Le nom du profil et les onglets accessibles sont requis.' });
    }

    try {
        const pool = await poolPromise; // Utilisation du pool global
        await pool.request()
            .input('NomProfil', sql.VarChar, nomProfil)
            .input('OngletsAccessibles', sql.VarChar, ongletsAccessibles)
            .input('ProfilID', sql.Int, id)
            .input('AutoDeconnexionTemps', sql.Int, autoDeconnexionTemps || null)
            .query(`UPDATE Profils SET NomProfil = @NomProfil, OngletsAccessibles = @OngletsAccessibles, AutoDeconnexionTemps = @AutoDeconnexionTemps  WHERE ProfilID = @ProfilID`);

        res.status(200).json({ message: 'Profil modifiÃ© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la modification du profil :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});



app.post('/profiles', authenticateToken, async (req, res) => {
    const { nomProfil, ongletsAccessibles, autoDeconnexionTemps } = req.body;

    if (!nomProfil || !ongletsAccessibles) {
        return res.status(400).json({ message: 'Le nom du profil et les onglets accessibles sont requis.' });
    }

    try {
        const pool = await poolPromise; // Utilisation du pool global
        await pool.request()
            .input('NomProfil', sql.VarChar, nomProfil)
            .input('OngletsAccessibles', sql.VarChar, ongletsAccessibles)
            .input('AutoDeconnexionTemps', sql.Int, autoDeconnexionTemps || null)
            .query(`INSERT INTO Profils (NomProfil, OngletsAccessibles, AutoDeconnexionTemps) VALUES (@NomProfil, @OngletsAccessibles, @AutoDeconnexionTemps)`);

        res.status(201).json({ message: 'Profil crÃ©Ã© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la crÃ©ation du profil :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.get('/profileInUse/:id', authenticateToken, async (req, res) => {
    const profilID = req.params.id;
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request()
            .input('ProfilID', sql.Int, profilID)
            .query('SELECT NomUtilisateur FROM Utilisateurs WHERE ProfilID = @ProfilID');
        res.status(200).json({ utilisateurs: result.recordset });
    } catch (error) {
        console.error('Erreur lors de la vÃ©rification du profil :', error);
        res.status(500).json({ message: 'Erreur interne du serveur' });
    }
});

app.delete('/deleteProfile/:id', authenticateToken, async (req, res) => {
    const profilID = req.params.id;

    try {
        const pool = await poolPromise; // Utilisation du pool global

        const userCountResult = await pool.request()
            .input('ProfilID', sql.Int, profilID)
            .query('SELECT COUNT(*) AS userCount FROM Utilisateurs WHERE ProfilID = @ProfilID');

        const userCount = userCountResult.recordset[0]?.userCount || 0;

        if (userCount > 0) {
            return res.status(400).json({ message: 'Le profil est encore utilisÃ© par des utilisateurs.' });
        }

        const deleteResult = await pool.request()
            .input('ProfilID', sql.Int, profilID)
            .query('DELETE FROM Profils WHERE ProfilID = @ProfilID');

        if (deleteResult.rowsAffected[0] === 0) {
            return res.status(404).json({ message: 'Profil introuvable ou dÃ©jÃ  supprimÃ©.' });
        }

        res.status(200).json({ message: 'Profil supprimÃ© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la suppression du profil :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.delete('/deleteUser/:id', authenticateToken, async (req, res) => {
    const utilisateurID = req.params.id;

    try {
        const pool = await poolPromise; // Utilisation du pool global
        await pool.request()
            .input('UtilisateurID', sql.Int, utilisateurID)
            .query('DELETE FROM Utilisateurs WHERE UtilisateurID = @UtilisateurID');

        res.status(200).json({ message: 'Utilisateur supprimÃ© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la suppression de l\'utilisateur :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/createProfile', authenticateToken, async (req, res) => {
    const { nomProfil, ongletsAccessibles, autoDeconnexionTemps } = req.body;

    if (!nomProfil || !ongletsAccessibles) {
        return res.status(400).json({ message: 'Le nom du profil et les onglets accessibles sont requis.' });
    }

    try {
        const pool = await poolPromise; // Utilisation du pool global
        await pool.request()
            .input('NomProfil', sql.VarChar, nomProfil)
            .input('OngletsAccessibles', sql.VarChar, ongletsAccessibles)
            .input('AutoDeconnexionTemps', sql.Int, autoDeconnexionTemps || null)
            .query(`INSERT INTO Profils (NomProfil, OngletsAccessibles, AutoDeconnexionTemps)
                    VALUES (@NomProfil, @OngletsAccessibles, @AutoDeconnexionTemps)`);

        res.status(201).json({ message: 'Profil crÃ©Ã© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la crÃ©ation du profil :', error);
        res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
});

app.post('/logout', authenticateToken, async (req, res) => {
    try {
        logUserConnection(req.user.username, 'Logout');
        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        console.error('Erreur lors de la dÃ©connexion :', error);
        res.status(500).json({ message: 'Internal server error' });
    }
});

app.all('/verifierConnexion', authenticateToken, async (req, res) => {
    return res.status(200).json({ success: true, message: 'Connexion rÃ©ussie.' });
});

app.get('/listeGroupesAcces', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request().query('SELECT Name FROM ACCGRP;');
        const groupesAcces = result.recordset.map(row => row.Name);
        return res.status(200).json(groupesAcces);
    } catch (erreur) {
        console.error(`Erreur lors de la rÃ©cupÃ©ration des groupes d'accÃ¨s : ${erreur.message}`);
        return res.status(500).send('Erreur lors de la rÃ©cupÃ©ration des groupes d\'accÃ¨s.');
    }
});

app.post('/verifierNumeroExiste', authenticateToken, async (req, res) => {
    const { numero } = req.body;

    if (!numero) {
        return res.status(400).json({ error: 'Veuillez fournir un numÃ©ro.' });
    }

    try {
        const pool = await poolPromise; // Utilisation du pool global
        const result = await pool.request()
            .input('numero', sql.VarChar, numero)
            .query(`SELECT COUNT(*) AS Count FROM CRDHLD WHERE Num = @numero`);

        const count = result.recordset[0].Count;
        return res.status(200).json({ existeDeja: count > 0 });
    } catch (erreur) {
        console.error(`Erreur lors de la vÃ©rification du numÃ©ro existant : ${erreur.message}`);
        return res.status(500).json({ error: 'Erreur lors de la vÃ©rification du numÃ©ro existant.' });
    }
});

app.get('/listeGroupesAscenseurs', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT ID, Name FROM dbo.Lift');

        const groupesAscenseurs = result.recordset.map(row => ({
            value: row.Name,
            label: row.Name
        }));

        res.status(200).json(groupesAscenseurs);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des groupes ascenseurs :', error);
        res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration des groupes ascenseurs.' });
    }
});


app.post('/creerDetenteur', authenticateToken, async (req, res) => {
    const { numero, nom, prenom, type, badge, technologie, groupeAcces, societe, dateDebutCRDHLD, dateFinCRDHLD, groupeAscenseurCRDHLD, codePin, departement, valide } = req.body;

    if (!numero || !nom || !prenom || !type || !badge || !technologie || !groupeAcces) {
        return res.status(400).json({ error: 'Les champs obligatoires sont manquants.' });
    }
    if (isNaN(type) || isNaN(technologie)) {
        return res.status(400).json({ error: 'Le type et la technologie doivent Ãªtre des nombres.' });
    }

    try {
        const pool = await poolPromise;
        const numeroExiste = await pool.request()
            .input('numero', sql.VarChar, numero)
            .query('SELECT COUNT(*) AS Count FROM CRDHLD WHERE Num = @numero');

        if (numeroExiste.recordset[0].Count > 0) {
            return res.status(400).json({ error: 'Ce numÃ©ro existe dÃ©jÃ . La crÃ©ation du dÃ©tenteur est bloquÃ©e.' });
        }

        const xmlString = xmlbuilder.create('query', { headless: true })
            .ele('Number', numero).up()
            .ele('Last_Name', nom).up()
            .ele('First_Name', prenom).up()
            .ele('Type', type).up()
            .ele('Badge', badge).up()
            .ele('Technology', technologie).up()
            .ele('Access_Group', groupeAcces).up()
            .ele('Company', societe || '').up()
            .ele('From_Date', dateDebutCRDHLD || '').up()
            .ele('To_Date', dateFinCRDHLD || '').up()
            .ele('Lift_Program', groupeAscenseurCRDHLD || '').up()
            .ele('PIN_code', codePin || '').up()
            .ele('Department', departement || '').up()
            .ele('Validated', valide ? '1' : '0').up()
            .ele('Status', '0').up()
            .ele('Result', '0').up()
            .end({ pretty: true });

        await pool.request()
            .input('xmlString', sql.NVarChar, xmlString)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);
            `);

        res.status(200).json({ success: true, message: 'DÃ©tenteur crÃ©Ã© avec succÃ¨s!' });

    } catch (error) {
        console.error(`Erreur lors de la crÃ©ation du dÃ©tenteur : ${error.message}`);
        res.status(500).json({ error: 'Une erreur s\'est produite lors de la crÃ©ation du dÃ©tenteur.' });
    }
});

app.get('/detenteurs', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`
            SELECT
                Last_Name AS nom, First_Name AS prenom, Caption AS type, Code AS badge,
                Techno AS technologie, Num AS numero, AG_Name AS groupeAcces,
                Lift_Name as groupeAscenseurCRDHLD, DPT_Name as departement,
                Start_Date as dateDebutCRDHLD, TO_Date as dateFinCRDHLD,
                PIN as codePin, Valid as valide, Company as societe
            FROM dbo.rptCardholders
        `);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des dÃ©tenteurs :', error);
        res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration des dÃ©tenteurs.' });
    }
});

app.put('/detenteurs/:numero', authenticateToken, async (req, res) => {
    const numero = req.params.numero;
    const { nom, prenom, type, badge, technologie, groupeAcces, societe, dateDebutCRDHLD, dateFinCRDHLD, groupeAscenseurCRDHLD, codePin, departement, valide } = req.body;

    if (!numero || !nom || !prenom || !type || !badge || !technologie || !groupeAcces) {
        return res.status(400).json({ error: 'Les champs obligatoires sont manquants.' });
    }

    try {
        const xmlString = xmlbuilder.create('query', { headless: true })
            .ele('Number', numero).up()
            .ele('Last_Name', nom).up()
            .ele('First_Name', prenom).up()
            .ele('Type', type).up()
            .ele('Badge', badge).up()
            .ele('Technology', technologie).up()
            .ele('Access_Group', groupeAcces).up()
            .ele('Company', societe || '').up()
            .ele('From_Date', dateDebutCRDHLD || '').up()
            .ele('To_Date', dateFinCRDHLD || '').up()
            .ele('Lift_Program', groupeAscenseurCRDHLD || '').up()
            .ele('PIN_code', codePin || '').up()
            .ele('Department', departement || '').up()
            .ele('Validated', valide ? '1' : '0').up()
            .ele('Status', '0').up()
            .ele('Result', '0').up()
            .end({ pretty: true });

        const pool = await poolPromise;
        await pool.request()
            .input('xmlString', sql.NVarChar, xmlString)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);
            `);

        res.status(200).json({ message: 'DÃ©tenteur modifiÃ© avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la modification du dÃ©tenteur :', error);
        res.status(500).json({ error: 'Erreur lors de la modification du dÃ©tenteur.' });
    }
});

app.post('/detenteurs/supprimer', authenticateToken, async (req, res) => {
    const { numero } = req.body;

    if (!numero) {
        return res.status(400).json({ error: 'Le numÃ©ro du dÃ©tenteur est requis pour la suppression.' });
    }

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('numero', sql.VarChar, numero)
            .query(`SELECT Last_Name, First_Name, Code, Techno, AG_Name FROM dbo.rptCardholders WHERE Num = @numero`);

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'DÃ©tenteur introuvable.' });
        }
        const detenteur = result.recordset[0];

        const xmlString = xmlbuilder.create('query', { headless: true })
            .ele('Number', numero).up()
            .ele('Last_Name', detenteur.Last_Name || 'Inconnu').up()
            .ele('First_Name', detenteur.First_Name || 'Inconnu').up()
            .ele('Type', '3').up()
            .ele('Badge', detenteur.Code || '').up()
            .ele('Technology', detenteur.Techno || '').up()
            .ele('Access_Group', detenteur.AG_Name || '').up()
            .ele('Status', '0').up()
            .ele('Result', '0').up()
            .end({ pretty: true });

        await pool.request()
            .input('xmlString', sql.NVarChar, xmlString)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0)
            `);

        res.status(200).json({ message: 'DÃ©tenteur marquÃ© comme "EffacÃ©".' });
    } catch (error) {
        console.error('Erreur lors de la suppression du dÃ©tenteur :', error);
        res.status(500).json({ error: 'Une erreur s\'est produite lors de la suppression.' });
    }
});

app.get('/filDeLEau', authenticateToken, async (req, res) => {
    const trnTypes = [24, 25, 32, 31, 61, 63, 1, 3];
    const trnTypesCondition = trnTypes.map(type => `Trn_Type = ${type}`).join(' OR ');

    const requeteSQL = `
        SELECT TOP 200 Date, From_Name, Desc3, Trn_Type
        FROM LOGt WHERE ${trnTypesCondition} ORDER BY Date DESC;
    `;

    try {
        const pool = await poolPromise;
        const result = await pool.request().query(requeteSQL);
        res.status(200).json(result.recordset);
    } catch (erreur) {
        console.error(`Erreur lors de la rÃ©cupÃ©ration du fil de l'eau : ${erreur.message}`);
        res.status(500).send('Erreur lors de la rÃ©cupÃ©ration du fil de l\'eau.');
    }
});

app.get('/dernierEvenementDate', authenticateToken, async (req, res) => {
    const requeteSQL = `SELECT MAX(Date) AS lastEventDate FROM LOGt;`;
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(requeteSQL);
        const lastEventDate = result.recordset[0]?.lastEventDate || null;

        if (!lastEventDate) {
            return res.status(404).json({ error: 'Aucun Ã©vÃ©nement trouvÃ©.' });
        }
        return res.status(200).json({ lastEventDate });
    } catch (erreur) {
        console.error(`Erreur lors de la rÃ©cupÃ©ration de la date du dernier Ã©vÃ©nement : ${erreur.message}`);
        return res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration de la date du dernier Ã©vÃ©nement' });
    }
});

function genererCodeHexadecimalUnique(nom, prenom, numero) {
    const input = nom + prenom + numero + Date.now().toString();
    const hash = crypto.createHash('sha256').update(input).digest('hex');
    return hash.substring(0, 12);
}

async function genererQRCode(codeHex) {
    try {
        return await QRCode.toDataURL(codeHex);
    } catch (error) {
        console.error('Erreur lors de la gÃ©nÃ©ration du QR code :', error);
        throw error;
    }
}

app.post('/creerDetenteurAvecQRCode', authenticateToken, async (req, res) => {
    const { nom, prenom, societe, dateDebut, dateFin } = req.body;

    try {
        const codeHex = genererCodeHexadecimalUnique(nom, prenom, Date.now().toString());
        const qrCode = await genererQRCode(codeHex);

        const xmlString = xmlbuilder.create('query', { headless: true })
            .ele('Number', codeHex).up()
            .ele('Last_Name', nom).up()
            .ele('First_Name', prenom).up()
            .ele('Company', societe).up()
            .ele('Type', '0').up()
            .ele('From_Date', dateDebut).up()
            .ele('TO_Date', dateFin).up()
            .ele('Badge', codeHex).up()
            .ele('Technology', '3').up()
            .ele('Access_Group', 'Visiteur').up()
            .ele('Validated', '0').up()
            .ele('Status', '0').up()
            .ele('Result', '0').up()
            .end({ pretty: true });

        const pool = await poolPromise;
        await pool.request()
            .input('xmlString', sql.NVarChar, xmlString)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);
            `);

        return res.status(200).json({ success: true, qrCode, codeHex });
    } catch (error) {
        console.error(`Erreur lors de la crÃ©ation du dÃ©tenteur : ${error.message}`);
        return res.status(500).json({ error: 'Erreur lors de la crÃ©ation du dÃ©tenteur.' });
    }
});

app.get('/rechercherVisiteurs', authenticateToken, async (req, res) => {
    const requeteSQL = `
        SELECT CRDHLD.Last_Name, CRDHLD.First_Name, CRDHLD.Num, Card.Code AS Badge,
               CRDHLD.Start_Date, CRDHLD.TO_Date, CRDHLD.Company
        FROM dbo.CRDHLD
        JOIN dbo.Card ON CRDHLD.ID = Card.Owner
        WHERE CRDHLD.Type = 0;
    `;

    try {
        const pool = await poolPromise;
        const result = await pool.request().query(requeteSQL);
        const visiteurs = result.recordset;

        for (const visiteur of visiteurs) {
            visiteur.qrCode = await genererQRCode(visiteur.Badge);
        }
        return res.status(200).json(visiteurs);
    } catch (error) {
        console.error(`Erreur lors de la rÃ©cupÃ©ration des visiteurs : ${error.message}`);
        return res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration des visiteurs.' });
    }
});

// âœ… --- ROUTE CORRIGÃ‰E POUR L'AFFICHAGE DES DATES LUNDI-DIMANCHE ---
app.get('/societes', authenticateToken, async (req, res) => {
    const { nom } = req.query;
    try {
        const pool = await poolPromise;
        // 1. Simplifier la requÃªte SQL
        let query = `
            SELECT ID, Societe AS nom, Semaine, Annee, Pin AS codePin
            FROM CodesPIN
        `;
        const request = pool.request();
        if (nom) {
            query += ` WHERE Societe = @nom`;
            request.input('nom', sql.VarChar, nom);
        }

        const result = await request.query(query);

        // 2. Calculer la plage de dates en JS avec moment.js
        const formattedResults = result.recordset.map(row => {
            const startDate = moment().year(row.Annee).isoWeek(row.Semaine).startOf('isoWeek').format('DD/MM/YYYY');
            const endDate = moment().year(row.Annee).isoWeek(row.Semaine).endOf('isoWeek').format('DD/MM/YYYY');
            return {
                ...row,
                SemaineDates: `${startDate} au ${endDate}`
            };
        });

        res.status(200).json(formattedResults);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des sociÃ©tÃ©s :', error);
        res.status(500).json({ error: 'Erreur interne.' });
    }
});


app.get('/societes/noms', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT DISTINCT Societe AS nom FROM CodesPIN`);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des noms des sociÃ©tÃ©s :', error);
        res.status(500).json({ error: 'Erreur interne.' });
    }
});

function genererCodePin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

function obtenirSemaineActuelle() {
    return moment().isoWeek();
}

app.post('/creerSocieteAvecCodePin', authenticateToken, async (req, res) => {
    const { nomSociete, groupeAcces, groupeAscenseur } = req.body;

    if (!nomSociete || !groupeAcces || !groupeAscenseur) {
        return res.status(400).json({ error: 'Nom de sociÃ©tÃ©, groupe d\'accÃ¨s, et groupe ascenseur requis.' });
    }

    const anneeActuelle = new Date().getFullYear();
    const semaineActuelle = obtenirSemaineActuelle();
    let codePinSemaineActuelle = null;
    let transaction;

    try {
        const pool = await poolPromise;
        transaction = pool.transaction();
        await transaction.begin();

        try {
            const liftResult = await transaction.request()
                .input('authlift', sql.NVarChar, groupeAscenseur)
                .query('SELECT Name FROM dbo.Lift WHERE Name = @authlift');

            if (liftResult.recordset.length === 0) {
                await transaction.rollback();
                return res.status(400).json({ error: `Groupe d'accÃ¨s ascenseur invalide : ${groupeAscenseur}` });
            }

            for (let semaine = 1; semaine <= 52; semaine++) {
                let codePin, collision;
                do {
                    codePin = genererCodePin();
                    const result = await transaction.request()
                        .input('semaine', sql.Int, semaine)
                        .input('annee', sql.Int, anneeActuelle)
                        .input('codePin', sql.VarChar, codePin)
                        .query('SELECT COUNT(*) AS count FROM CodesPIN WHERE Semaine = @semaine AND Annee = @annee AND Pin = @codePin');
                    collision = result.recordset[0].count > 0;
                } while (collision);

                await transaction.request()
                    .input('nomSociete', sql.VarChar, nomSociete)
                    .input('semaine', sql.Int, semaine)
                    .input('annee', sql.Int, anneeActuelle)
                    .input('codePin', sql.VarChar, codePin)
                    .query(`INSERT INTO CodesPIN (Societe, Semaine, Annee, Pin) VALUES (@nomSociete, @semaine, @annee, @codePin)`);

                if (semaine === semaineActuelle) {
                    codePinSemaineActuelle = codePin;
                }
            }

            if (!codePinSemaineActuelle) {
                await transaction.rollback();
                throw new Error('Code PIN pour la semaine actuelle non dÃ©fini. Rollback.');
            }

            const xmlString = xmlbuilder.create('query', { headless: true })
                .ele('Number', `${nomSociete}_PIN`).up()
                .ele('Last_Name', `${nomSociete}_PIN`).up()
                .ele('First_Name', `${nomSociete}_PIN`).up()
                .ele('Company', nomSociete).up()
                .ele('Type', '1').up()
                .ele('Badge', `AA_${codePinSemaineActuelle}`).up()
                .ele('Technology', '3').up()
                .ele('Access_Group', groupeAcces).up()
                .ele('PIN_code', codePinSemaineActuelle).up()
                .ele('Lift_Program', groupeAscenseur).up()
                .ele('Status', '0').up()
                .ele('Result', '0').up()
                .end({ pretty: true });

            await transaction.request()
                .input('xmlString', sql.NVarChar, xmlString)
                .query(`INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result) VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);`);

            await transaction.commit();
            res.status(200).json({
                success: true,
                message: `SociÃ©tÃ© crÃ©Ã©e avec succÃ¨s. Code PIN actuel : ${codePinSemaineActuelle}`,
                codePinSemaineActuelle,
            });

        } catch (transactionError) {
            console.error('Erreur durant la transaction, rollback en cours...', transactionError);
            await transaction.rollback();
            throw transactionError;
        }
    } catch (error) {
        console.error('Erreur lors de la crÃ©ation de la sociÃ©tÃ© et des codes PIN :', error);
        res.status(500).json({ error: 'Erreur lors de la crÃ©ation. L\'opÃ©ration a Ã©tÃ© annulÃ©e.' });
    }
});

cron.schedule('0 4 * * 1', async () => {
    console.log('Mise Ã  jour hebdomadaire des codes PIN...');
    try {
        const pool = await poolPromise;
        const anneeActuelle = new Date().getFullYear();
        const semaineActuelle = obtenirSemaineActuelle();

        const societes = await pool.request()
            .input('semaine', sql.Int, semaineActuelle)
            .input('annee', sql.Int, anneeActuelle)
            .query(`SELECT Societe, Pin FROM CodesPIN WHERE Semaine = @semaine AND Annee = @annee`);

        for (const { Societe, Pin } of societes.recordset) {
            if (!Pin) {
                console.warn(`Aucun code PIN trouvÃ© pour ${Societe}, semaine ${semaineActuelle}, annÃ©e ${anneeActuelle}`);
                continue;
            }

            const xmlString = xmlbuilder.create('query', { headless: true })
                .ele('Number', `${Societe}_PIN`).up()
                .ele('Last_Name', `${Societe}_PIN`).up()
                .ele('First_Name', `${Societe}_PIN`).up()
                .ele('Type', '1').up()
                .ele('Technology', '3').up()
                .ele('Badge', `AA_${Pin}`).up()
                .ele('PIN_code', Pin).up()
                .ele('Status', '0').up()
                .ele('Result', '0').up()
                .end({ pretty: true });

            await pool.request()
                .input('xmlString', sql.NVarChar, xmlString)
                .query(`
                    INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                    VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);
                `);

            console.log(`Mise Ã  jour rÃ©ussie dans QueueMSGAPI pour ${Societe}.`);
        }
        console.log('Mise Ã  jour hebdomadaire des codes PIN terminÃ©e.');
    } catch (error) {
        console.error('Erreur lors de la mise Ã  jour des codes PIN :', error);
    }
});

cron.schedule('0 1 1 1 *', async () => {
    console.log('DÃ©but de la mise Ã  jour annuelle des codes PIN...');
    try {
        const pool = await poolPromise;
        const anneeActuelle = new Date().getFullYear();
        const anneePrecedente = anneeActuelle - 1;

        await pool.request()
            .input('annee', sql.Int, anneePrecedente)
            .query(`DELETE FROM CodesPIN WHERE Annee = @annee`);
        console.log(`Codes PIN de l'annÃ©e ${anneePrecedente} supprimÃ©s.`);

        const societesResult = await pool.request().query(`SELECT DISTINCT Societe FROM CodesPIN`);
        const societes = societesResult.recordset.map(row => row.Societe);

        for (const societe of societes) {
            for (let semaine = 1; semaine <= 52; semaine++) {
                let codePin, collision;
                do {
                    codePin = genererCodePin();
                    const result = await pool.request()
                        .input('semaine', sql.Int, semaine)
                        .input('annee', sql.Int, anneeActuelle)
                        .input('codePin', sql.VarChar, codePin)
                        .query(`SELECT COUNT(*) AS count FROM CodesPIN WHERE Semaine = @semaine AND Annee = @annee AND Pin = @codePin`);
                    collision = result.recordset[0].count > 0;
                } while (collision);

                await pool.request()
                    .input('nomSociete', sql.VarChar, societe)
                    .input('semaine', sql.Int, semaine)
                    .input('annee', sql.Int, anneeActuelle)
                    .input('codePin', sql.VarChar, codePin)
                    .query(`
                        MERGE INTO CodesPIN AS target
                        USING (VALUES (@nomSociete, @semaine, @annee, @codePin)) AS source (Societe, Semaine, Annee, Pin)
                        ON target.Societe = source.Societe AND target.Semaine = source.Semaine AND target.Annee = source.Annee
                        WHEN MATCHED THEN UPDATE SET Pin = source.Pin
                        WHEN NOT MATCHED THEN INSERT (Societe, Semaine, Annee, Pin) VALUES (source.Societe, source.Semaine, source.Annee, source.Pin);
                    `);

                if (semaine === 1) {
                    const xmlString = xmlbuilder.create('query', { headless: true })
                        .ele('Number', `${societe}_PIN`).up()
                        .ele('Last_Name', `${societe}_PIN`).up()
                        .ele('First_Name', `${societe}_PIN`).up()
                        .ele('Company', societe).up()
                        .ele('Type', '1').up()
                        .ele('Badge', `AA_${codePin}`).up()
                        .ele('Technology', '3').up()
                        .ele('PIN_code', codePin).up()
                        .ele('Status', '0').up()
                        .ele('Result', '0').up()
                        .end({ pretty: true });

                    await pool.request()
                        .input('xmlString', sql.NVarChar, xmlString)
                        .query(`
                            INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                            VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);
                        `);
                }
            }
        }
        console.log('Mise Ã  jour annuelle des codes PIN terminÃ©e.');
    } catch (error) {
        console.error('Erreur lors de la mise Ã  jour annuelle des codes PIN :', error);
    }
});

app.get('/obtenirCodePin', authenticateToken, async (req, res) => {
    const { societe } = req.query;
    if (!societe) {
        return res.status(400).json({ error: 'Nom de la sociÃ©tÃ© requis.' });
    }

    const semaineCourante = obtenirSemaineActuelle();
    const anneeCourante = new Date().getFullYear();

    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('societe', sql.VarChar, societe)
            .input('semaine', sql.Int, semaineCourante)
            .input('annee', sql.Int, anneeCourante)
            .query(`SELECT Pin FROM CodesPIN WHERE Societe = @societe AND Semaine = @semaine AND Annee = @annee`);

        if (result.recordset.length > 0) {
            res.status(200).json({ codePin: result.recordset[0].Pin });
        } else {
            res.status(404).json({ error: 'Code PIN non trouvÃ©.' });
        }
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration du code PIN :', error);
        res.status(500).json({ error: 'Erreur interne.' });
    }
});

// âœ… --- ROUTE CORRIGÃ‰E POUR L'AFFICHAGE DES DATES LUNDI-DIMANCHE ---
app.get('/telechargerTableau', authenticateToken, async (req, res) => {
    const { nom } = req.query;
    try {
        const pool = await poolPromise;
        // 1. Simplifier la requÃªte SQL
        let query = `
            SELECT Societe, Semaine, Annee, Pin
            FROM CodesPIN
        `;
        const request = pool.request();
        if (nom) {
            query += ` WHERE Societe = @nom`;
            request.input('nom', sql.VarChar, nom);
        }
        const result = await request.query(query);

        // 2. Calculer la plage de dates en JS et formater les donnÃ©es pour Excel
        const dataForExcel = result.recordset.map(row => {
            const startDate = moment().year(row.Annee).isoWeek(row.Semaine).startOf('isoWeek').format('DD/MM/YYYY');
            const endDate = moment().year(row.Annee).isoWeek(row.Semaine).endOf('isoWeek').format('DD/MM/YYYY');
            return {
                Societe: row.Societe,
                Semaine: row.Semaine,
                SemaineDates: `${startDate} au ${endDate}`,
                Annee: row.Annee,
                Pin: row.Pin
            };
        });

        const workbook = new excelJS.Workbook();
        const worksheet = workbook.addWorksheet('Codes PIN');
        worksheet.columns = [
            { header: 'SociÃ©tÃ©', key: 'Societe', width: 30 },
            { header: 'Semaine', key: 'Semaine', width: 10 },
            { header: 'Plage de dates', key: 'SemaineDates', width: 25 },
            { header: 'AnnÃ©e', key: 'Annee', width: 10 },
            { header: 'Code PIN', key: 'Pin', width: 15 },
        ];
        worksheet.addRows(dataForExcel);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Codes_PIN_${nom || 'Toutes_Societes'}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Erreur lors de la gÃ©nÃ©ration du fichier Excel :', error);
        res.status(500).json({ error: 'Erreur lors de la gÃ©nÃ©ration du fichier.' });
    }
});


app.delete('/supprimerSociete', authenticateToken, async (req, res) => {
    const { nomSociete } = req.body;

    if (!nomSociete) {
        return res.status(400).json({ error: 'Nom de la sociÃ©tÃ© requis.' });
    }

    try {
        const pool = await poolPromise;
        await pool.request()
            .input('nomSociete', sql.VarChar, nomSociete)
            .query(`DELETE FROM CodesPIN WHERE Societe = @nomSociete;`);

        const xmlString = xmlbuilder.create('query', { headless: true })
            .ele('Number', `${nomSociete}_PIN`).up()
            .ele('Last_Name', `${nomSociete}_PIN`).up()
            .ele('First_Name', `${nomSociete}_PIN`).up()
            .ele('Type', '3').up()
            .ele('Status', '0').up()
            .ele('Result', '0').up()
            .end({ pretty: true });

        await pool.request()
            .input('xmlString', sql.NVarChar, xmlString)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'ImportOneCardHolderXML', @xmlString, 0, 0);
            `);

        res.status(200).json({ success: true, message: `SociÃ©tÃ© "${nomSociete}" supprimÃ©e avec succÃ¨s.` });
    } catch (error) {
        console.error('Erreur lors de la suppression de la sociÃ©tÃ© :', error);
        res.status(500).json({ error: 'Erreur lors de la suppression.' });
    }
});

app.get('/controller/liste', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query(`SELECT ID, Name FROM dbo.Controller`);
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des contrÃ´leurs :', error);
        res.status(500).json({ error: 'Erreur lors de la rÃ©cupÃ©ration des contrÃ´leurs.' });
    }
});

app.post('/controller/recreateMemoryTables', authenticateToken, async (req, res) => {
    const { controllerId } = req.body;
    try {
        const xmlRequest = xmlbuilder.create('query', { headless: true })
            .ele('CtrID', controllerId).up()
            .ele('ReStartPolling', 1).up()
            .ele('WantClearMemory', 1).up()
            .end({ pretty: true });

        const pool = await poolPromise;
        await pool.request()
            .input('xmlString', sql.NVarChar, xmlRequest)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'CC_RecreateMemoryTables', @xmlString, 0, 0);
            `);

        res.status(200).json({ success: true, message: 'RequÃªte envoyÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de la recrÃ©ation des tables mÃ©moire :', error);
        res.status(500).json({ error: 'Ã‰chec de la requÃªte.' });
    }
});

app.post('/controller/startPolling', authenticateToken, async (req, res) => {
    const { controllerId } = req.body;
    try {
        const xmlRequest = xmlbuilder.create('query', { headless: true })
            .ele('CtrID', controllerId).up()
            .end({ pretty: true });

        const pool = await poolPromise;
        await pool.request()
            .input('xmlString', sql.NVarChar, xmlRequest)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'StartPolling', @xmlString, 0, 0);
            `);
        res.status(200).json({ success: true, message: 'RequÃªte envoyÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors du dÃ©marrage du polling :', error);
        res.status(500).json({ error: 'Ã‰chec de la requÃªte.' });
    }
});

app.post('/controller/stopPolling', authenticateToken, async (req, res) => {
    const { controllerId } = req.body;
    try {
        const xmlRequest = xmlbuilder.create('query', { headless: true })
            .ele('CtrID', controllerId).up()
            .end({ pretty: true });

        const pool = await poolPromise;
        await pool.request()
            .input('xmlString', sql.NVarChar, xmlRequest)
            .query(`
                INSERT INTO QueueMSGAPI (DateCreated, ServerName, Cmd, Msg, Status, Result)
                VALUES (GETDATE(), 'DASHNOV', 'StopPolling', @xmlString, 0, 0);
            `);
        res.status(200).json({ success: true, message: 'RequÃªte envoyÃ©e avec succÃ¨s.' });
    } catch (error) {
        console.error('Erreur lors de l\'arrÃªt du polling :', error);
        res.status(500).json({ error: 'Ã‰chec de la requÃªte.' });
    }
});

// --- GESTION DES RAPPORTS ---
const { jsPDF } = require('jspdf');
require('jspdf-autotable');

function genererPDFDynamique(headers, rows) {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    doc.autoTable({
        head: [headers],
        body: rows,
        startY: 20,
        theme: 'grid',
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fillColor: [22, 160, 133], textColor: 255 },
        didDrawPage: (data) => {
            doc.text(`Page ${doc.internal.getNumberOfPages()}`, data.settings.margin.left, doc.internal.pageSize.height - 10);
        }
    });
    return doc.output('arraybuffer');
}

app.get('/rapports', authenticateToken, async (req, res) => {
    try {
        const pool = await poolPromise;
        const result = await pool.request().query('SELECT id, nom FROM Rapports');
        res.status(200).json(result.recordset);
    } catch (error) {
        console.error('Erreur lors de la rÃ©cupÃ©ration des rapports :', error);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

app.post('/rapports', authenticateToken, async (req, res) => {
    const { nom, requete } = req.body;
    if (!nom || !requete) {
        return res.status(400).json({ error: 'Nom et requÃªte requis.' });
    }
    try {
        const pool = await poolPromise;
        await pool.request()
            .input('nom', sql.VarChar, nom)
            .input('requete', sql.NVarChar, requete)
            .query('INSERT INTO Rapports (nom, requete) VALUES (@nom, @requete)');
        res.status(200).json({ success: true, message: 'Rapport ajoutÃ©.' });
    } catch (error) {
        console.error('Erreur lors de l\'ajout du rapport :', error);
        res.status(500).json({ error: 'Erreur interne.' });
    }
});

app.get('/rapports/:id/telecharger', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { format } = req.query;
    try {
        const pool = await poolPromise;
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT nom, requete FROM Rapports WHERE id = @id');

        if (!result.recordset.length) {
            return res.status(404).json({ message: 'Rapport non trouvÃ©.' });
        }
        const { requete } = result.recordset[0];
        if (!requete) {
            return res.status(400).json({ message: 'RequÃªte SQL non dÃ©finie pour ce rapport.' });
        }

        const dataResult = await pool.request().query(requete);
        const donnees = dataResult.recordset;
        if (!donnees.length) {
            return res.status(404).json({ message: 'Aucune donnÃ©e trouvÃ©e pour ce rapport.' });
        }

        const formattedData = donnees.map(row => {
            const newRow = {};
            for (const key in row) {
                if (row[key] instanceof Date) {
                    newRow[key] = moment(row[key]).tz('Europe/Paris').format('DD/MM/YYYY HH:mm');
                } else {
                    newRow[key] = row[key];
                }
            }
            return newRow;
        });

        if (format === 'XLS') {
            const workbook = new excelJS.Workbook();
            const worksheet = workbook.addWorksheet('Rapport');
            worksheet.columns = Object.keys(formattedData[0]).map(key => ({ header: key, key: key, width: 25 }));
            worksheet.addRows(formattedData);
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename=rapport_${id}.xlsx`);
            await workbook.xlsx.write(res);
            res.end();
        } else if (format === 'PDF') {
            const headers = Object.keys(formattedData[0]);
            const rows = formattedData.map(row => headers.map(header => row[header]));
            const pdfBuffer = genererPDFDynamique(headers, rows);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=rapport_${id}.pdf`);
            res.send(Buffer.from(pdfBuffer));
        } else {
            res.status(400).json({ message: 'Format non supportÃ©.' });
        }
    } catch (error) {
        console.error('Erreur lors du tÃ©lÃ©chargement du rapport :', error);
        res.status(500).json({ message: 'Erreur interne.' });
    }
});

// ============================================
// DÃ©marrage du serveur
// ============================================
const server =
    // ============================================
    // ROUTE RACINE (Test de fonctionnement)
    // ============================================
    // ===== PAGE D'ACCUEIL =====
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

app.get('/api', (req, res) => {
    res.json({
        status: 'running',
        message: '🚀 DashNov Server est opérationnel',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        database: process.env.DB_DATABASE,
        server: process.env.DB_SERVER,
        environment: process.env.NODE_ENV,
        timezone: process.env.TZ,
        endpoints: {
            health: '/health',
            api: '/api/*',
            auth: '/api/auth/*'
        }
    });
});

// Route de santé (Health Check)
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'OK',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.listen(PORT, HOST, () => {
    console.log('\n============================================');
    console.log('  ðŸš€ Serveur DashNov dÃ©marrÃ© avec succÃ¨s');
    console.log('============================================');
    console.log(`  URL locale:      http://${HOST}:${PORT}`);
    console.log(`  Environnement:   ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Base de donnÃ©es: ${config.database}@${config.server}`);
    console.log(`  Fuseau horaire:  ${process.env.TZ}`);
    console.log('============================================');
    console.log('  Pour arrÃªter: Ctrl+C');
    console.log('============================================\n');
});

// Gestion propre de l'arrÃªt du serveur
process.on('SIGTERM', () => {
    console.log('\nâš ï¸  ArrÃªt du serveur en cours (SIGTERM)...');
    server.close(() => {
        console.log('âœ“ Serveur arrÃªtÃ© proprement.');
        sql.close().then(() => {
            console.log('âœ“ Connexions SQL fermÃ©es.');
            process.exit(0);
        }).catch(err => {
            console.error('Erreur lors de la fermeture des connexions SQL:', err);
            process.exit(1);
        });
    });
});

process.on('SIGINT', () => {
    console.log('\n\nâš ï¸  ArrÃªt du serveur demandÃ© (Ctrl+C)...');
    server.close(() => {
        console.log('âœ“ Serveur arrÃªtÃ©.');
        sql.close().then(() => {
            console.log('âœ“ Connexions SQL fermÃ©es.');
            process.exit(0);
        }).catch(err => {
            console.error('Erreur lors de la fermeture SQL:', err);
            process.exit(1);
        });
    });
});

// Gestion des erreurs non capturÃ©es
process.on('uncaughtException', (error) => {
    console.error('âŒ Erreur non capturÃ©e:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('âŒ Promise rejetÃ©e non gÃ©rÃ©e:', reason);
});


