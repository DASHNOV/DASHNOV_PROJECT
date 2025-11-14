CREATE TABLE Utilisateurs (
    UtilisateurID INT PRIMARY KEY IDENTITY(1,1),  -- ID unique pour chaque utilisateur
    NomUtilisateur NVARCHAR(50) NOT NULL,         -- Nom d'utilisateur (login)
    MotDePasse NVARCHAR(255) NOT NULL,            -- Mot de passe (hashé)
    ProfilID INT NOT NULL,                        -- Référence au profil (clé étrangère vers Profils)
    CONSTRAINT FK_Utilisateurs_Profils FOREIGN KEY (ProfilID) REFERENCES Profils(ProfilID)
);
