// ==UserScript==
// @name         Reddit Gallery with Fancybox (Override Modal)
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Replace Reddit.com gallery with Fancybox v5.0.36
// @author       You
// @match        https://reddit.com/*
// @match        https://www.reddit.com/*
// @require      https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js
// @resource     fancyboxCSS https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(GM_getResourceText('fancyboxCSS'));

    // Helper: Get highest quality image from srcset or data-lazy-srcset
    function getBestImageUrl(img) {
        let srcset = img.getAttribute('data-lazy-srcset') || img.getAttribute('srcset');
        let url = null;
        if (srcset) {
            let candidates = srcset.split(',').map(s => {
                const [u, size] = s.trim().split(' ');
                const width = size ? parseInt(size) : 0;
                return { url: u, width };
            });
            candidates.sort((a, b) => b.width - a.width);
            if (candidates.length > 0) url = candidates[0].url;
        }
        if (!url) {
            url = img.getAttribute('data-lazy-src') || img.src;
        }
        // Try to get original quality for Reddit-hosted images
        if (url && /preview\.redd\.it\//.test(url)) {
            // Extract the hash and extension from the path
            // Example: https://preview.redd.it/desc-v0-wuh0uoaz3s0f1.png?... -> wuh0uoaz3s0f1.png
            const match = url.match(/-v0-([a-zA-Z0-9]+)\.(jpg|jpeg|png|gif|webp)/);
            if (match) {
                const hash = match[1];
                const ext = match[2];
                return `https://i.redd.it/${hash}.${ext}`;
            }
        }
        return url;
    }

    // Collect all images in the post (for galleries)
    function getGalleryImages(target) {
        // Use the structure from post_structure_.html
        const post = target.closest('.Post');
        if (!post) return [];
        const items = [];
        // Only select images that are not avatars or icons
        post.querySelectorAll('img').forEach(img => {
            const src = getBestImageUrl(img);
            if (src && !src.startsWith('data:') && img.offsetWidth > 50 && img.offsetHeight > 50) {
                items.push({ src, type: 'image', el: img });
            }
        });
        post.querySelectorAll('video').forEach(video => {
            if (video.src) items.push({ src: video.src, type: 'video', el: video });
        });
        return items;
    }

    // Open Fancybox for a post image/video
    function openFancybox(e) {
        // Only run if inside a Reddit modal (let Reddit handle feed clicks)
        if (!e.target.closest('[data-testid="lightbox-template"]')) return;
        e.stopImmediatePropagation();
        e.preventDefault();
        e.stopPropagation();
        if (e.target.closest('.fancybox__container')) return;
        const target = e.target.closest('img, video');
        if (!target) return;
        const galleryItems = getGalleryImages(target);
        let startIndex = 0;
        if (target.tagName === 'IMG') {
            const clickedSrc = getBestImageUrl(target);
            startIndex = galleryItems.findIndex(item => item.src === clickedSrc);
        } else if (target.tagName === 'VIDEO') {
            startIndex = galleryItems.findIndex(item => item.src === target.src);
        }
        if (galleryItems.length > 0) {
            Fancybox.show(galleryItems.map(item => ({ src: item.src, type: item.type })), {
                Html: { loop: false },
                startIndex: startIndex,
                hideScrollbar: false,
                Carousel: { infinite: false },
                Images: { Panzoom: { maxScale: 5 } },
                Thumbs: { type: "classic" },
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

    // Attach event listeners to all post images/videos, override Reddit's modal
    function addMediaListeners() {
        // Only bind to images inside the modal, not in the feed
        const modal = document.querySelector('[data-testid="lightbox-template"]');
        if (!modal) return;
        const imgs = modal.querySelectorAll('img.media-lightbox-img, img[alt][src]:not([src*="emoji"])');
        imgs.forEach(media => {
            if (!media.dataset.fancyboxBound) {
                media.dataset.fancyboxBound = true;
                media.removeEventListener('click', openFancybox, true);
                media.addEventListener('click', openFancybox, true); // Use capture phase
            }
        });
    }

    // Attach Fancybox handler to modal images
    function bindModalImageFancybox() {
        const modal = document.querySelector('[data-testid="lightbox-template"]');
        if (!modal) return;
        // Support both single and multi-image modals
        const imgs = modal.querySelectorAll('img.media-lightbox-img, img[alt][src]:not([src*="emoji"])');
        imgs.forEach(img => {
            if (!img.dataset.fancyboxBound) {
                img.dataset.fancyboxBound = true;
                img.removeEventListener('click', openModalFancybox, true);
                img.addEventListener('click', openModalFancybox, true);
            }
        });
    }

    // Utility: Remove fancyboxBound from all modal images in DOM
    function clearModalFancyboxFlags() {
        document.querySelectorAll('img.media-lightbox-img, img[alt][src]:not([src*="emoji"])').forEach(img => {
            delete img.dataset.fancyboxBound;
        });
    }

    // Open Fancybox for images in Reddit's modal
    function openModalFancybox(e) {
        e.preventDefault();
        e.stopPropagation();
        const modal = e.target.closest('[data-testid="lightbox-template"]');
        if (!modal) return; // Prevent error if modal is null
        // Support both multi-image and single-image modal
        let imgs = Array.from(modal.querySelectorAll('figure img.media-lightbox-img'));
        if (imgs.length === 0) {
            // Fallback for single-image modal structure
            imgs = Array.from(modal.querySelectorAll('img[alt][src]:not([src*="emoji"])'));
        }
        // Filter out duplicate images by src
        const seen = new Set();
        const gallery = imgs.map(img => ({ src: getBestImageUrl(img), type: 'image', el: img }))
            .filter(item => {
                if (seen.has(item.src)) return false;
                seen.add(item.src);
                return true;
            });
        const startIndex = gallery.findIndex(item => item.el === e.target);
        if (gallery.length > 0) {
            window.__redditFancyboxModalActive = true;
            Fancybox.show(gallery.map(item => ({ src: item.src, type: item.type })), {
                startIndex: startIndex >= 0 ? startIndex : 0,
                hideScrollbar: false,
                Carousel: { infinite: false },
                Images: { Panzoom: { maxScale: 5 } },
                Thumbs: { type: "classic" },
                Toolbar: {
                    display: {
                        left: ["infobar"],
                        middle: [],
                        right: ["slideshow", "download", "thumbs", "close"],
                    },
                },
                on: {
                    destroy: () => {
                        window.__redditFancyboxModalActive = false;
                        clearModalFancyboxFlags(); // Always clear flags so next modal gets handler
                    }
                }
            });
        }
    }

    // Wait for modal image to be present and loaded, then trigger Fancybox directly
    function triggerFancyboxOnModalImage(modal) {
        let attempts = 0;
        function tryOpen() {
            if (!modal.parentNode) return; // Modal was removed
            let img = modal.querySelector('figure img.media-lightbox-img') || modal.querySelector('img[alt][src]:not([src*="emoji"])');
            const closeBtn = modal.querySelector('button[data-testid="close-button"]');
            if (img && img.complete && img.naturalWidth > 0 && getComputedStyle(modal).opacity === '1') {
                bindModalImageFancybox(); // Ensure handler is attached
                // Directly call openModalFancybox with a synthetic event
                openModalFancybox({
                    preventDefault: () => {},
                    stopPropagation: () => {},
                    target: img
                });
                // Simulate a click on the close button to close the modal after Fancybox is fully open
                setTimeout(() => {
                    // Wait for Fancybox to be open before closing modal
                    let waited = 0;
                    function closeIfFancyboxOpen() {
                        // Check if Fancybox is open
                        if (document.querySelector('.fancybox__container')) {
                            if (closeBtn) closeBtn.click();
                        } else if (waited < 1000) {
                            waited += 50;
                            setTimeout(closeIfFancyboxOpen, 50);
                        }
                    }
                    closeIfFancyboxOpen();
                }, 200);
            } else if (attempts < 30) {
                attempts++;
                setTimeout(tryOpen, 50);
            }
        }
        tryOpen();
    }

    // Enhance automateModalToFancybox to always bind modal image handler and trigger Fancybox reliably
    function automateModalToFancybox() {
        let lastModalVisible = false;
        let debounce = false;
        const observer = new MutationObserver(() => {
            const modal = document.querySelector('[data-testid="lightbox-template"]');
            const isVisible = !!modal;
            if (!isVisible && lastModalVisible) {
                // Modal just closed
                window.__redditFancyboxModalActive = false;
                clearModalFancyboxFlags();
                lastModalVisible = false;
                debounce = false;
                return;
            }
            if (isVisible && !debounce) {
                debounce = true;
                lastModalVisible = true;
                // Wait for modal image and trigger Fancybox
                triggerFancyboxOnModalImage(modal);
                // Allow automation again after a short delay
                setTimeout(() => { debounce = false; }, 700);
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // Only observe for modal content
    const observer = new MutationObserver(addMediaListeners);
    observer.observe(document.body, { childList: true, subtree: true });
    addMediaListeners();
    automateModalToFancybox();
})();
