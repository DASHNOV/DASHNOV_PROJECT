/**
 * RESPONSIVE.JS - Gestion du menu burger et du responsive design
 * DashNov Application
 * 
 * Ce fichier gère:
 * - L'ouverture/fermeture du menu burger sur mobile/tablette
 * - Les animations de la sidebar
 * - L'overlay semi-transparent
 * - L'accessibilité (ARIA, clavier)
 * - La fermeture automatique lors du redimensionnement
 */

(function () {
    'use strict';

    // ========================================
    // VARIABLES ET ÉLÉMENTS DOM
    // ========================================
    const burgerMenu = document.querySelector('.burger-menu');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.querySelector('.sidebar-overlay');
    const body = document.body;
    const sidebarLinks = document.querySelectorAll('.sidebar a');

    // Breakpoint pour mobile/tablette (doit correspondre au CSS)
    const MOBILE_BREAKPOINT = 1024;

    // ========================================
    // FONCTIONS PRINCIPALES
    // ========================================

    /**
     * Toggle (ouvrir/fermer) le menu sidebar
     */
    function toggleSidebar() {
        const isOpen = body.classList.contains('sidebar-open');

        if (isOpen) {
            closeSidebar();
        } else {
            openSidebar();
        }
    }

    /**
     * Ouvrir la sidebar
     */
    function openSidebar() {
        body.classList.add('sidebar-open');

        // Mise à jour des attributs ARIA pour l'accessibilité
        if (burgerMenu) {
            burgerMenu.setAttribute('aria-expanded', 'true');
        }
        if (sidebar) {
            sidebar.setAttribute('aria-hidden', 'false');
        }
        if (overlay) {
            overlay.setAttribute('aria-hidden', 'false');
        }

        // Empêcher le scroll du body quand le menu est ouvert (optionnel)
        // body.style.overflow = 'hidden';
    }

    /**
     * Fermer la sidebar
     */
    function closeSidebar() {
        body.classList.remove('sidebar-open');

        // Mise à jour des attributs ARIA
        if (burgerMenu) {
            burgerMenu.setAttribute('aria-expanded', 'false');
        }
        if (sidebar) {
            sidebar.setAttribute('aria-hidden', 'true');
        }
        if (overlay) {
            overlay.setAttribute('aria-hidden', 'true');
        }

        // Réactiver le scroll du body
        // body.style.overflow = '';
    }

    /**
     * Vérifier si on est en mode mobile/tablette
     */
    function isMobileView() {
        return window.innerWidth < MOBILE_BREAKPOINT;
    }

    /**
     * Gérer le redimensionnement de la fenêtre
     */
    function handleResize() {
        // Si on passe en mode desktop, fermer le menu et réinitialiser
        if (!isMobileView()) {
            closeSidebar();

            // Réinitialiser les attributs ARIA pour desktop
            if (sidebar) {
                sidebar.setAttribute('aria-hidden', 'false');
            }
        } else {
            // En mode mobile, la sidebar est cachée par défaut
            if (!body.classList.contains('sidebar-open') && sidebar) {
                sidebar.setAttribute('aria-hidden', 'true');
            }
        }
    }

    /**
     * Gérer la navigation clavier (Échap pour fermer)
     */
    function handleKeydown(event) {
        // Touche Échap (code 27)
        if (event.key === 'Escape' || event.keyCode === 27) {
            if (body.classList.contains('sidebar-open')) {
                closeSidebar();
                // Remettre le focus sur le bouton burger
                if (burgerMenu) {
                    burgerMenu.focus();
                }
            }
        }
    }

    // ========================================
    // ÉCOUTEURS D'ÉVÉNEMENTS
    // ========================================

    /**
     * Initialiser tous les écouteurs d'événements
     */
    function initEventListeners() {
        // Clic sur le bouton burger
        if (burgerMenu) {
            burgerMenu.addEventListener('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                toggleSidebar();
            });
        }

        // Clic sur l'overlay pour fermer le menu
        if (overlay) {
            overlay.addEventListener('click', function () {
                closeSidebar();
            });
        }

        // Clic sur un lien de la sidebar (fermer le menu sur mobile)
        sidebarLinks.forEach(function (link) {
            link.addEventListener('click', function () {
                // Fermer uniquement en mode mobile
                if (isMobileView()) {
                    // Petit délai pour permettre la navigation
                    setTimeout(closeSidebar, 100);
                }
            });
        });

        // Redimensionnement de la fenêtre
        let resizeTimer;
        window.addEventListener('resize', function () {
            // Debounce pour éviter trop d'appels
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(handleResize, 150);
        });

        // Navigation au clavier
        document.addEventListener('keydown', handleKeydown);
    }

    // ========================================
    // INITIALISATION
    // ========================================

    /**
     * Initialiser le module responsive
     */
    function init() {
        // Vérifier que les éléments existent
        if (!burgerMenu || !sidebar || !overlay) {
            console.warn('DashNov Responsive: Certains éléments requis sont manquants');
            return;
        }

        // Initialiser les écouteurs
        initEventListeners();

        // Initialiser l'état ARIA selon la taille d'écran
        handleResize();

        console.log('DashNov Responsive: Module initialisé avec succès');
    }

    // ========================================
    // DÉMARRAGE
    // ========================================

    // Attendre que le DOM soit complètement chargé
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // Le DOM est déjà chargé
        init();
    }

    // Exposer certaines fonctions globalement si nécessaire (optionnel)
    window.DashNovResponsive = {
        toggleSidebar: toggleSidebar,
        openSidebar: openSidebar,
        closeSidebar: closeSidebar,
        isMobileView: isMobileView
    };

})();
