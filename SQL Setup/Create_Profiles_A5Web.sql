CREATE TABLE Profils (
    ProfilID INT PRIMARY KEY IDENTITY(1,1),  -- ID unique pour chaque profil
    NomProfil NVARCHAR(50) NOT NULL,          -- Nom du profil (ex: Admin, Utilisateur)
    OngletsAccessibles NVARCHAR(MAX) NOT NULL, -- Liste des onglets accessibles séparés par des virgules
    AutoDeconnexionTemps INT NULL              -- Temps de déconnexion automatique en minutes (null si illimité)
);
