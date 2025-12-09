# Guide de Référence: CSS Responsive pour DashNov

## 📐 Breakpoints et Media Queries

### Breakpoints Définis

```css
:root {
    --breakpoint-mobile: 768px;   /* Limite mobile/tablette */
    --breakpoint-tablet: 1024px;  /* Limite tablette/desktop */
}
```

### Utilisation des Media Queries

#### Mobile (< 768px)
```css
@media screen and (max-width: 767px) {
    /* Styles spécifiques mobile uniquement */
    body {
        font-size: 14px;
    }
    
    .navbar-brand img {
        max-width: 120px;
    }
}
```

#### Tablette (768px - 1023px)
```css
@media screen and (max-width: 1023px) {
    /* Styles pour tablette ET mobile */
    .burger-menu {
        display: flex;
    }
    
    .sidebar {
        transform: translateX(-100%);
    }
}
```

#### Desktop (≥ 1024px)
```css
@media screen and (min-width: 1024px) {
    /* Styles desktop */
    .burger-menu {
        display: none;
    }
    
    .sidebar {
        transform: translateX(0);
    }
}
```

---

## 🎨 Unités Relatives Recommandées

### Pour la Typographie
```css
/* ❌ Éviter les pixels fixes */
h1 { font-size: 32px; }

/* ✅ Utiliser rem (relatif à la racine) */
h1 { font-size: 2rem; } /* 32px si root = 16px */

/* ✅ Utiliser clamp() pour fluide */
h1 { 
    font-size: clamp(1.5rem, 4vw, 2.5rem);
    /* Min: 1.5rem, Préféré: 4vw, Max: 2.5rem */
}
```

### Pour les Espacements
```css
/* ❌ Pixels fixes */
.content-section {
    padding: 20px;
    margin-bottom: 20px;
}

/* ✅ Unités relatives */
.content-section {
    padding: 1.25rem;        /* 20px si root = 16px */
    margin-bottom: 1.25rem;
}

/* ✅ Responsive avec media queries */
@media screen and (max-width: 767px) {
    .content-section {
        padding: 0.625rem;   /* 10px */
    }
}
```

### Pour les Largeurs
```css
/* ❌ Largeur fixe */
.container {
    width: 1200px;
}

/* ✅ Largeur relative */
.container {
    width: 90%;
    max-width: 1200px;
}

/* ✅ Avec unités viewport */
.hero {
    width: 100vw;  /* 100% de la largeur du viewport */
    height: 100vh; /* 100% de la hauteur du viewport */
}
```

---

## 🖼️ Images et Médias Responsifs

### Images Adaptatives
```css
/* Base pour toutes les images */
img {
    max-width: 100%;
    height: auto;
    display: block;
}

/* Logo avec tailles adaptatives */
.navbar-brand img {
    max-width: 200px;
    transition: max-width 0.3s;
}

@media screen and (max-width: 1023px) {
    .navbar-brand img {
        max-width: 150px;
    }
}

@media screen and (max-width: 767px) {
    .navbar-brand img {
        max-width: 120px;
    }
}
```

### Vidéos Responsives
```css
.video-container {
    position: relative;
    padding-bottom: 56.25%; /* Ratio 16:9 */
    height: 0;
    overflow: hidden;
}

.video-container iframe,
.video-container video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}
```

---

## 📊 Tableaux Responsifs

### Approche 1: Scroll Horizontal
```css
.table-responsive {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch; /* Smooth scroll iOS */
}

@media screen and (max-width: 767px) {
    .table-responsive table {
        min-width: 600px; /* Force scroll si trop large */
    }
}
```

### Approche 2: Empilage Vertical (Cards)
```css
@media screen and (max-width: 767px) {
    table, thead, tbody, th, td, tr {
        display: block;
    }
    
    thead tr {
        position: absolute;
        top: -9999px;
        left: -9999px;
    }
    
    tr {
        margin-bottom: 1rem;
        border: 1px solid #ddd;
    }
    
    td {
        border: none;
        position: relative;
        padding-left: 50%;
    }
    
    td:before {
        position: absolute;
        left: 6px;
        content: attr(data-label);
        font-weight: bold;
    }
}
```

---

## 🎯 Formulaires Responsifs

### Inputs et Boutons
```css
/* Base */
.form-control, .form-select {
    width: 100%;
    padding: 0.625rem;
    font-size: 1rem;
    border: 2px solid #ccc;
    border-radius: 4px;
}

/* Boutons responsive */
.btn {
    padding: 0.5rem 1rem;
    font-size: 1rem;
    display: inline-block;
}

@media screen and (max-width: 1023px) {
    .btn {
        width: 100%;           /* Pleine largeur sur mobile */
        margin-bottom: 0.625rem;
    }
}
```

### Grilles de Formulaires
```css
.form-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
}

@media screen and (max-width: 767px) {
    .form-row {
        grid-template-columns: 1fr; /* Une colonne sur mobile */
    }
}
```

---

## 🎭 Animations et Transitions

### Principes de Base
```css
/* Toujours définir une transition */
.element {
    transition: all 0.3s ease;
}

/* Préférer transform à left/right pour les performances */
/* ❌ Moins performant */
.sidebar {
    left: -250px;
    transition: left 0.3s;
}

/* ✅ Plus performant */
.sidebar {
    transform: translateX(-100%);
    transition: transform 0.3s;
}
```

### Respecter les Préférences Utilisateur
```css
/* Désactiver animations si l'utilisateur préfère */
@media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## 🎨 Grilles Responsive (Flexbox & Grid)

### Flexbox
```css
.flex-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
}

.flex-item {
    flex: 1 1 300px; /* Grow, shrink, base */
}

@media screen and (max-width: 767px) {
    .flex-item {
        flex: 1 1 100%; /* Pleine largeur sur mobile */
    }
}
```

### CSS Grid
```css
.grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
}

/* Responsive automatique avec auto-fit/auto-fill */
/* Pas besoin de media queries ! */
```

---

## 📱 Navbar Responsive

### Structure Recommandée
```css
.navbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    flex-wrap: wrap;
}

@media screen and (max-width: 767px) {
    .navbar {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.625rem;
    }
    
    .navbar .d-flex {
        width: 100%;
        justify-content: space-between;
    }
}
```

---

## 🔧 Utilitaires Responsive

### Classes Utilitaires à Créer
```css
/* Visibilité responsive */
.hide-mobile {
    display: block;
}

@media screen and (max-width: 767px) {
    .hide-mobile {
        display: none !important;
    }
}

.show-mobile {
    display: none;
}

@media screen and (max-width: 767px) {
    .show-mobile {
        display: block !important;
    }
}

/* Espacements responsive */
.p-responsive {
    padding: 1.25rem;
}

@media screen and (max-width: 767px) {
    .p-responsive {
        padding: 0.625rem;
    }
}
```

---

## ✅ Checklist Responsive

Avant de considérer votre design comme "responsive", vérifiez:

- [ ] Toutes les images ont `max-width: 100%` et `height: auto`
- [ ] Aucune largeur fixe en pixels (sauf max-width)
- [ ] Les tableaux ont une solution pour mobile (scroll ou cards)
- [ ] Les formulaires sont utilisables sur mobile
- [ ] La navigation est accessible sur tous les écrans
- [ ] Les boutons ont une taille tactile suffisante (min 44x44px)
- [ ] Le texte est lisible sans zoom (min 16px sur mobile)
- [ ] Les animations respectent `prefers-reduced-motion`
- [ ] Testé sur au moins 3 tailles: mobile, tablette, desktop
- [ ] Testé en mode portrait ET paysage sur mobile

---

## 🚀 Optimisations Avancées

### Container Queries (Moderne)
```css
/* Alternative aux media queries basée sur le conteneur */
.card-container {
    container-type: inline-size;
}

@container (min-width: 400px) {
    .card {
        display: grid;
        grid-template-columns: 1fr 2fr;
    }
}
```

### Aspect Ratio (Moderne)
```css
/* Maintenir un ratio sans padding-bottom hack */
.video-thumbnail {
    aspect-ratio: 16 / 9;
    width: 100%;
}
```

### Clamp pour Typographie Fluide
```css
h1 {
    font-size: clamp(1.5rem, 2vw + 1rem, 3rem);
    /* Taille fluide entre 1.5rem et 3rem */
}
```

---

## 📚 Ressources Supplémentaires

- **MDN Web Docs**: https://developer.mozilla.org/fr/docs/Web/CSS/Media_Queries
- **CSS-Tricks**: https://css-tricks.com/snippets/css/a-guide-to-flexbox/
- **Can I Use**: https://caniuse.com/ (vérifier la compatibilité)
- **Responsive Design Checker**: http://responsivedesignchecker.com/

---

**Dernière mise à jour**: 2025-12-09  
**Version**: 1.0  
**Projet**: DashNov Application
