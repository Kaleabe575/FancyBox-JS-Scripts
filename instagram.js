// ==UserScript==
// @name         Instagram Invisible Overlay Fancybox Gallery
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Use an invisible overlay on Instagram images to open a Fancybox gallery of all carousel images.
// @author       You
// @match        https://www.instagram.com/*
// @require      https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js
// @resource     fancyboxCSS https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';
    GM_addStyle(GM_getResourceText('fancyboxCSS'));
    GM_addStyle(`
        div._aagv { position: relative; }
        .invisible-overlay {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: transparent; z-index: 9999; pointer-events: auto;
            cursor: pointer;
        }
    `);

    function addInvisibleOverlay(container) {
        if (container.querySelector('.invisible-overlay')) return;
        let overlay = document.createElement('div');
        overlay.className = 'invisible-overlay';
        let img = container.querySelector('img');
        if (img && img.src) overlay.dataset.src = img.src;
        overlay.addEventListener('click', function(e) {
            if (e.ctrlKey) return;
            e.preventDefault();
            e.stopPropagation();
            openFancyboxForImage(overlay, e);
        });
        container.appendChild(overlay);
    }

    function openFancyboxForImage(overlay, event) {
        let container = overlay.parentElement;
        let article = container.closest('article');
        let galleryImages = [];
        if (article) {
            article.querySelectorAll('div._aagv img').forEach(img => {
                if (img.src && !galleryImages.includes(img.src)) galleryImages.push(img.src);
            });
        }
        if (galleryImages.length === 0) {
            let img = container.querySelector('img');
            if (img && img.src) galleryImages.push(img.src);
        }
        let clickedSrc = overlay.dataset.src;
        let startIndex = galleryImages.findIndex(src => src === clickedSrc);
        if (startIndex < 0) startIndex = 0;
        Fancybox.show(
            galleryImages.map(src => ({ src, type: 'image' })),
            {
                startIndex,
                hideScrollbar: false,
                Carousel: { infinite: false },
                Images: { Panzoom: { maxScale: 5 } },
                Thumbs: { type: 'classic' },
                Toolbar: {
                    display: {
                        left: ['infobar'],
                        middle: [],
                        right: ['slideshow', 'download', 'thumbs', 'close']
                    }
                }
            }
        );
    }

    function addOverlaysToContainers() {
        document.querySelectorAll('div._aagv').forEach(addInvisibleOverlay);
    }

    addOverlaysToContainers();
    new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches('div._aagv')) {
                        addInvisibleOverlay(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll('div._aagv').forEach(addInvisibleOverlay);
                    }
                }
            });
        });
    }).observe(document.body, { childList: true, subtree: true });
})();
