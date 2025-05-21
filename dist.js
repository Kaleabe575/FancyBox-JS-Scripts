// ==UserScript==
// @name         Enhanced image viewer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Replaces default image galleries with Fancybox v5.0.36 on DeviantArt, Reddit, and X (Twitter).
// @author       You
// @match        https://www.deviantart.com/*
// @match        https://reddit.com/*
// @match        https://www.reddit.com/*
// @match        https://x.com/*
// @match        https://twitter.com/*
// @require      https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js
// @resource     fancyboxCSS https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(GM_getResourceText('fancyboxCSS'));

    const commonFancyboxOptions = {
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
        Html: { loop: false }
    };

    if (window.location.hostname.includes('deviantart.com')) {
        function getHighQualityImageUrl(src) {
            return src.includes("/th/") ? src.replace("/th/", "/") : src;
        }

        function handleDocumentClick(e) {
            if (e.target.closest('.fancybox__container')) return;
            let target = e.target;
            if (target.tagName !== "IMG") {
                target = target.closest("img");
            }
            if (!target) return;
            const computedCursor = window.getComputedStyle(target).cursor;
            if (computedCursor !== "zoom-in") return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            Fancybox.show(
                [{ src: getHighQualityImageUrl(target.src), type: "image" }],
                { ...commonFancyboxOptions }
            );
        }
        document.documentElement.addEventListener("click", handleDocumentClick, true);
    }

    if (window.location.hostname.includes('reddit.com')) {
        let __redditFancyboxModalActive = false;
        const REDDIT_MODAL_IMAGE_SELECTOR = 'img.media-lightbox-img, img[alt][src]:not([src*="emoji"])';

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
            if (url && /preview\.redd\.it\//.test(url)) {
                const match = url.match(/-v0-([a-zA-Z0-9]+)\.(jpg|jpeg|png|gif|webp)/);
                if (match) {
                    const hash = match[1];
                    const ext = match[2];
                    return `https://i.redd.it/${hash}.${ext}`;
                }
            }
            return url;
        }
        function getGalleryImages(target) {
            const post = target.closest('.Post');
            if (!post) return [];
            const items = [];
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

        function bindModalImageFancybox() {
            const modal = document.querySelector('[data-testid="lightbox-template"]');
            if (!modal) return;
            // Use the defined constant for the selector
            const imgs = modal.querySelectorAll(REDDIT_MODAL_IMAGE_SELECTOR);
            imgs.forEach(img => {
                if (!img.dataset.fancyboxBound) {
                    img.dataset.fancyboxBound = true;
                    // Ensure we remove the correct listener if it was somehow previously attached with a different function
                    img.removeEventListener('click', openModalFancybox, true);
                    img.addEventListener('click', openModalFancybox, true);
                }
            });
        }
        function clearModalFancyboxFlags() {
            document.querySelectorAll(REDDIT_MODAL_IMAGE_SELECTOR).forEach(img => {
                delete img.dataset.fancyboxBound;
            });
        }
        function openModalFancybox(e) {
            e.preventDefault();
            e.stopPropagation();
            const modal = e.target.closest('[data-testid="lightbox-template"]');
            if (!modal) return;
            let imgs = Array.from(modal.querySelectorAll('figure img.media-lightbox-img'));
            if (imgs.length === 0) { // Fallback for single-image modal structure
                imgs = Array.from(modal.querySelectorAll(REDDIT_MODAL_IMAGE_SELECTOR));
            }

            const seen = new Set();
            const gallery = imgs.map(img => ({ src: getBestImageUrl(img), type: 'image', el: img }))
                .filter(item => {
                    if (seen.has(item.src)) return false;
                    seen.add(item.src);
                    return true;
                });
            const startIndex = gallery.findIndex(item => item.el === e.target);
            if (gallery.length > 0) {
                __redditFancyboxModalActive = true;
                Fancybox.show(gallery.map(item => ({ src: item.src, type: item.type })), {
                    ...commonFancyboxOptions,
                    startIndex: startIndex >= 0 ? startIndex : 0,
                    on: {
                        destroy: () => {
                            __redditFancyboxModalActive = false;
                            clearModalFancyboxFlags();
                        }
                    }
                });
            }
        }
        function triggerFancyboxOnModalImage(modal) {
            let attempts = 0;
            function tryOpen() {
                if (!modal.parentNode) return;
                let img = modal.querySelector('figure img.media-lightbox-img') || modal.querySelector(REDDIT_MODAL_IMAGE_SELECTOR);
                const closeBtn = modal.querySelector('button[data-testid="close-button"]');
                if (img && img.complete && img.naturalWidth > 0 && getComputedStyle(modal).opacity === '1') {
                    bindModalImageFancybox();
                    openModalFancybox({
                        preventDefault: () => {},
                        stopPropagation: () => {},
                        target: img
                    });
                    setTimeout(() => {
                        let waited = 0;
                        function closeIfFancyboxOpen() {
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
        function automateModalToFancybox() {
            let lastModalVisible = false;
            let debounce = false;
            const observer = new MutationObserver(() => {
                const modal = document.querySelector('[data-testid="lightbox-template"]');
                const isVisible = !!modal;
                if (!isVisible && lastModalVisible) {
                    __redditFancyboxModalActive = false;
                    clearModalFancyboxFlags();
                    lastModalVisible = false;
                    debounce = false;
                    return;
                }
                if (isVisible && !debounce) {
                    debounce = true;
                    lastModalVisible = true;
                    triggerFancyboxOnModalImage(modal);
                    setTimeout(() => { debounce = false; }, 700);
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
        // Removed mediaListenersObserver and its call to addMediaListeners as automateModalToFancybox handles the modal replacement.
        automateModalToFancybox();
    }

    if (window.location.hostname.includes('x.com')) {
        function getOriginalImageUrl(src) {
            if (!src || !src.includes('pbs.twimg.com')) return src;

            try {
                const url = new URL(src);
                if (url.search) { // Has query parameters
                    const params = new URLSearchParams(url.search);
                    params.set('name', 'orig'); // This should override existing 'name' or add it.
                                                // It typically makes 'format' redundant or overrides it.
                    return `${url.origin}${url.pathname}?${params.toString()}`;
                } else { // No query parameters, likely uses :large, :medium etc. in path
                    // Remove any existing colon-suffix (like :large, :medium, :small, :thumb) and append :orig
                    return src.replace(/:\w*$/, '') + ':orig';
                }
            } catch (e) {
                console.warn('[Enhanced ImageViewer] Failed to parse URL for X/Twitter image:', src, e);
                // Fallback for unparseable URLs, try simple suffix replacement if no query string
                if (!src.includes('?')) {
                    return src.replace(/:\w*$/, '') + ':orig';
                }
                return src; // Return original if parsing failed and has query string
            }
        }

        function getGalleryImages(target) {
            let mediaContainer;
            const tweet = target.closest('article[role="article"]');
            if (tweet) {
                mediaContainer = tweet;
            } else {
                mediaContainer = target.closest('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
                if (mediaContainer) {
                    // Try to find a shared parent if multiple images/videos are grouped nearby
                    let potentialGalleryParent = mediaContainer.parentElement;
                    for (let i = 0; i < 3 && potentialGalleryParent; i++) { // Check a few levels up
                        // Check if this parent contains more than one potential media item for a gallery
                        if (potentialGalleryParent.querySelectorAll('img[src*="pbs.twimg.com"]:not([src*="profile_images"]), video[src*="video.twimg.com"]').length > 1) {
                            mediaContainer = potentialGalleryParent;
                            break;
                        }
                        potentialGalleryParent = potentialGalleryParent.parentElement;
                    }
                }
                // If no specific media container or tweet, try a broader timeline context
                if (!mediaContainer) {
                    mediaContainer = target.closest('[aria-label*="Timeline:"]');
                }
            }

            if (!mediaContainer) {
                return []; // If no suitable container is found, return an empty array
            }

            const items = [];
            const seenUrls = new Set();
            mediaContainer.querySelectorAll('img[src*="pbs.twimg.com"]:not([src*="profile_images"])').forEach(img => {
                const origSrc = getOriginalImageUrl(img.src);
                if (!seenUrls.has(origSrc)) {
                    items.push({ src: origSrc, type: 'image', el: img });
                    seenUrls.add(origSrc);
                }
            });
            mediaContainer.querySelectorAll('video[src*="video.twimg.com"]').forEach(video => {
                const videoSrc = video.querySelector('source[src*="video.twimg.com"]')?.src || video.src;
                // Ensure videoSrc is a string and not empty
                if (typeof videoSrc === 'string' && videoSrc && !seenUrls.has(videoSrc)) {
                    items.push({ src: videoSrc, type: 'video', el: video });
                    seenUrls.add(videoSrc);
                }
            });
            return items;
        }
        function openFancybox(e) {
            const clickedElement = e.target;
            // Do not open Fancybox if clicking on a username link within a tweet, or inside an existing Fancybox
            if (clickedElement.closest('.fancybox__container') ||
                clickedElement.closest('a[href^="/"][role="link"] [data-testid="User-Name"]') || // More specific selector for username links
                clickedElement.closest('a[href*="/status/"] [dir="ltr"] > span, a[href*="/status/"] [data-testid="socialContext"]')) { // Links to other tweets or social context
                return;
            }

            const targetMediaElement = clickedElement.closest('img[src*="pbs.twimg.com"]:not([src*="profile_images"]), video[src*="video.twimg.com"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
            if (!targetMediaElement) return; // No relevant media element was clicked
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            const galleryItems = getGalleryImages(targetMediaElement);
            let startIndex = 0;
            if (targetMediaElement.tagName === 'IMG' && targetMediaElement.src.includes('pbs.twimg.com')) {
                const clickedSrc = getOriginalImageUrl(targetMediaElement.src);
                startIndex = galleryItems.findIndex(item => item.src === clickedSrc);
            } else if (targetMediaElement.tagName === 'VIDEO') { // Could be the VIDEO tag itself or a source inside
                const videoSrc = targetMediaElement.querySelector('source[src*="video.twimg.com"]')?.src || targetMediaElement.src;
                const clickedSrc = videoSrc;
                startIndex = galleryItems.findIndex(item => item.src === clickedSrc || item.el === targetMediaElement);
            } else if (galleryItems.length > 0) { // Fallback if clicked on a container like data-testid="tweetPhoto"
                 // Try to find the actual image element within the clicked container if possible, or default to first image
                 const actualImgInContainer = targetMediaElement.querySelector('img[src*="pbs.twimg.com"]:not([src*="profile_images"])');
                 const firstImage = actualImgInContainer ? galleryItems.find(item => item.el === actualImgInContainer) : galleryItems.find(item => item.type ==='image');
                 if (firstImage) startIndex = galleryItems.indexOf(firstImage);
            }
            if (galleryItems.length > 0) {
                Fancybox.show(galleryItems.map(item => ({
                    src: item.src,
                    type: item.type
                })), {
                    ...commonFancyboxOptions,
                    startIndex: Math.max(0, startIndex)
                });
            }
        }
        function addMediaListeners() {
            const targetNode = document.body; // Listen on the body for delegated events
            if (!targetNode) return;

            // Prevent attaching multiple listeners to the body
            if (targetNode.dataset.xFancyboxListenersAttached) return;

            targetNode.addEventListener('click', function(e) {
                const mediaTarget = e.target.closest('img[src*="pbs.twimg.com"]:not([src*="profile_images"]), video[src*="video.twimg.com"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
                if (mediaTarget) {
                    // Ensure the media is part of a tweet, timeline, or a modal/lightbox structure that we want to enhance
                    if (mediaTarget.closest('article[role="article"], [aria-label*="Timeline:"], div[aria-labelledby^="modal-header"]')) {
                         const potentialGallery = getGalleryImages(mediaTarget);
                        if (potentialGallery && potentialGallery.length > 0){
                            openFancybox(e);
                        }
                    }
                }
            }, true);
            targetNode.dataset.xFancyboxListenersAttached = 'true';
        }
        // Initial call to set up the delegated listener
        addMediaListeners(); 
    }

})();
