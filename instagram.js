// ==UserScript==
// @name         Instagram Gallery with Fancybox Overlay
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Overlay an icon on Instagram images to open them in Fancybox
// @author       You
// @match        https://www.instagram.com/*
// @require      https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js
// @resource     fancyboxCSS https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';

    // Inject Fancybox CSS
    GM_addStyle(GM_getResourceText('fancyboxCSS'));

    // Inject custom CSS for our overlay icon and ensuring Instagram containers are positioned
    GM_addStyle(`
        /* Ensure container of images is relatively positioned */
        div._aagv {
            position: relative;
        }
        /* Style for the overlay icon; hidden by default and shown on hover */
        .fancybox-overlay-icon {
            position: absolute;
            top: 5px;
            left: 5px;
            background: rgba(0, 0, 0, 0.6);
            color: #fff;
            border-radius: 3px;
            padding: 4px 6px;
            font-size: 14px;
            z-index: 9999;
            cursor: pointer;
            opacity: 0;
            transition: opacity 0.2s ease;
            user-select: none;
        }
        div._aagv:hover .fancybox-overlay-icon {
            opacity: 1;
        }
    `);

    /**
     * Append an overlay icon to a container (if not already added).
     * When the icon is clicked, we stop the event and open Fancybox.
     */
    function addOverlayIconToContainer(container) {
        // Skip if the overlay is already present
        if (container.querySelector('.fancybox-overlay-icon')) return;

        let overlay = document.createElement('div');
        overlay.className = 'fancybox-overlay-icon';
        overlay.textContent = '🔍'; // This is the magnifying glass icon

        // When user clicks the overlay, open Fancybox for this container
        overlay.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openFancyboxForContainer(container);
        });

        container.appendChild(overlay);
    }

    /**
     * Gather all images inside the container (assumed to be any <img> element)
     * and open them in Fancybox.
     */
    function openFancyboxForContainer(container) {
        let galleryItems = [];
        // Select all images in the container (adjust selector if needed)
        container.querySelectorAll('img').forEach(img => {
            if (img && img.src) {
                galleryItems.push({ src: img.src, type: 'image' });
            }
        });

        if (galleryItems.length > 0) {
            console.log('Opening Fancybox with gallery:', galleryItems);
            Fancybox.show(galleryItems, {
                startIndex: 0,
                hideScrollbar: false,
                Carousel: {
                    infinite: false,
                },
                Images: {
                    Panzoom: {
                        maxScale: 5,
                    },
                },
                Thumbs: {
                    type: "classic",
                },
                Toolbar: {
                    display: {
                        left: ["infobar"],
                        middle: [],
                        right: ["slideshow", "download", "thumbs", "close"],
                    },
                }
            });
        }
    }

    /**
     * Scan for all Instagram containers (div._aagv) on the page and add the overlay icon.
     */
    function addOverlayIcons() {
        let containers = document.querySelectorAll('div._aagv');
        containers.forEach(container => {
            addOverlayIconToContainer(container);
        });
    }

    // Run initially on page load
    addOverlayIcons();

    // Use a MutationObserver to detect new elements as Instagram loads dynamic content.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // If the added node itself is a container, or contains one, add the overlay icon
                    if (node.matches('div._aagv')) {
                        addOverlayIconToContainer(node);
                    } else {
                        node.querySelectorAll && node.querySelectorAll('div._aagv').forEach(container => {
                            addOverlayIconToContainer(container);
                        });
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
