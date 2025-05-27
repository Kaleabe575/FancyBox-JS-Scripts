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
    "use strict";

    // Inject Fancybox CSS
    GM_addStyle(GM_getResourceText("fancyboxCSS"));

    // Custom CSS for the invisible overlay:
    // We force the image container to be position: relative, then place an absolutely positioned div over it.
    // The overlay is completely transparent but will catch pointer events.
    GM_addStyle(`
        /* Ensure the container is positioned relative so the overlay covers it */
        div._aagv {
            position: relative;
        }
        /* The invisible overlay covers the entire container */
        .invisible-overlay {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: transparent;
            z-index: 9999;
            /* IMPORTANT: pointer events should be active so clicks are captured */
            pointer-events: auto;
        }
    `);

    /**
     * Append an invisible overlay to the given container if one is not already present.
     * The overlay will cover the full container and intercept the click.
     */
    function addInvisibleOverlay(container) {
        if (container.querySelector(".invisible-overlay")) return;
        let overlay = document.createElement("div");
        overlay.className = "invisible-overlay";
        // Save the current image's src so that we know which image was clicked.
        let img = container.querySelector("img");
        if (img && img.src) {
            overlay.dataset.src = img.src;
        }
        overlay.addEventListener("click", function(e) {
            e.preventDefault();
            e.stopPropagation();
            openFancyboxForImage(overlay);
        });
        container.appendChild(overlay);
    }

    /**
     * When the overlay is clicked, this function finds the closest post container (the <article> element)
     * and gathers all images contained in "div._aagv" within that post.
     * It then opens Fancybox as a gallery starting with the image that was clicked.
     */
    function openFancyboxForImage(overlay) {
        // The overlay’s parent is the original image container.
        let container = overlay.parentElement;
        // Look upward for an <article> element (which usually wraps an Instagram post).
        let article = container.closest("article");

        // Gather gallery images.
        // If this is a carousel post, there should be multiple div._aagv elements,
        // each containing an <img> – we collect their src values.
        let galleryImages = [];
        if (article) {
            let imgs = article.querySelectorAll("div._aagv img");
            imgs.forEach(img => {
                if (img.src && !galleryImages.includes(img.src)) {
                    galleryImages.push(img.src);
                }
            });
        }
        // Fallback: if no article (or only a single image), collect the single image from the container.
        if (galleryImages.length === 0) {
            let img = container.querySelector("img");
            if (img && img.src) galleryImages.push(img.src);
        }

        // Determine the index of the clicked image.
        let clickedSrc = overlay.dataset.src;
        let startIndex = galleryImages.findIndex(src => src === clickedSrc);
        if (startIndex < 0) startIndex = 0;

        console.log("Opening Fancybox gallery:", galleryImages, "starting at index", startIndex);
        Fancybox.show(
            galleryImages.map(src => ({ src: src, type: "image" })),
            {
                startIndex: startIndex,
                hideScrollbar: false,
                Carousel: { infinite: false },
                Images: { Panzoom: { maxScale: 5 } },
                Thumbs: { type: "classic" },
                Toolbar: {
                    display: {
                        left: ["infobar"],
                        middle: [],
                        right: ["slideshow", "download", "thumbs", "close"]
                    }
                }
            }
        );
    }

    /**
     * Find all matching image containers and add the invisible overlay.
     */
    function addOverlaysToContainers() {
        let containers = document.querySelectorAll("div._aagv");
        containers.forEach(container => {
            addInvisibleOverlay(container);
        });
    }

    // Initial run on page load.
    addOverlaysToContainers();

    // Since Instagram loads many posts dynamically, we use a MutationObserver
    // to add the invisible overlay to any new image containers that appear.
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.matches && node.matches("div._aagv")) {
                        addInvisibleOverlay(node);
                    } else if (node.querySelectorAll) {
                        node.querySelectorAll("div._aagv").forEach(container => {
                            addInvisibleOverlay(container);
                        });
                    }
                }
            });
        });
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
