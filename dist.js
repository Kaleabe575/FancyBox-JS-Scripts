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

    // Inject Fancybox CSS
    GM_addStyle(GM_getResourceText('fancyboxCSS'));

    // Common Fancybox options
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
        Html: { loop: false } // Consistent loop setting
    };

    // --- DeviantArt Specific Logic ---
    if (window.location.hostname.includes('deviantart.com')) {
        // Utility: Convert thumbnail URLs to high-quality versions.
        function getHighQualityImageUrl(src) {
            return src.includes("/th/") ? src.replace("/th/", "/") : src;
        }

        // Main click handler: when an image with "cursor: zoom-in" is clicked, open it.
        function handleDocumentClick(e) {
            // Ignore clicks inside FancyBox's modal container.
            if (e.target.closest('.fancybox__container')) return;

            // Get a reference to the image element.
            let target = e.target;
            if (target.tagName !== "IMG") {
                target = target.closest("img");
            }
            if (!target) return;

            // Proceed only if the computed cursor style is exactly "zoom-in".
            const computedCursor = window.getComputedStyle(target).cursor;
            if (computedCursor !== "zoom-in") return;

            // Prevent the default behavior.
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Open FancyBox with just the clicked image and use common options.
            Fancybox.show(
                [{ src: getHighQualityImageUrl(target.src), type: "image" }],
                { ...commonFancyboxOptions } // Use common options
            );
        }

        // Attach the event listener at the capture phase.
        document.documentElement.addEventListener("click", handleDocumentClick, true);
        console.log("DeviantArt Fancybox script active."); // For debugging
    }

    // --- Reddit Specific Logic ---
    if (window.location.hostname.includes('reddit.com')) {
        let __redditFancyboxModalActive = false; // Scoped variable

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
            if (url && /preview\.redd\.it\//.test(url)) { // Escaped regex
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

        // Open Fancybox for a post image/video
        function openFancybox(e) {
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
                    ...commonFancyboxOptions, // Use common options
                    startIndex: startIndex
                });
            }
        }

        // Attach event listeners to all post images/videos, override Reddit's modal
        function addMediaListeners() {
            const modal = document.querySelector('[data-testid="lightbox-template"]');
            if (!modal) return;
            const imgs = modal.querySelectorAll('img.media-lightbox-img, img[alt][src]:not([src*="emoji"])');
            imgs.forEach(media => {
                if (!media.dataset.fancyboxBound) {
                    media.dataset.fancyboxBound = true;
                    media.removeEventListener('click', openFancybox, true);
                    media.addEventListener('click', openFancybox, true);
                }
            });
        }

        function bindModalImageFancybox() {
            const modal = document.querySelector('[data-testid="lightbox-template"]');
            if (!modal) return;
            const imgs = modal.querySelectorAll('img.media-lightbox-img, img[alt][src]:not([src*="emoji"])');
            imgs.forEach(img => {
                if (!img.dataset.fancyboxBound) {
                    img.dataset.fancyboxBound = true;
                    img.removeEventListener('click', openModalFancybox, true);
                    img.addEventListener('click', openModalFancybox, true);
                }
            });
        }

        function clearModalFancyboxFlags() {
            document.querySelectorAll('img.media-lightbox-img, img[alt][src]:not([src*="emoji"])').forEach(img => {
                delete img.dataset.fancyboxBound;
            });
        }

        function openModalFancybox(e) {
            e.preventDefault();
            e.stopPropagation();
            const modal = e.target.closest('[data-testid="lightbox-template"]');
            if (!modal) return;
            let imgs = Array.from(modal.querySelectorAll('figure img.media-lightbox-img'));
            if (imgs.length === 0) {
                imgs = Array.from(modal.querySelectorAll('img[alt][src]:not([src*="emoji"])'));
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
                    ...commonFancyboxOptions, // Use common options
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
                let img = modal.querySelector('figure img.media-lightbox-img') || modal.querySelector('img[alt][src]:not([src*="emoji"])');
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

        const mediaListenersObserver = new MutationObserver(addMediaListeners);
        mediaListenersObserver.observe(document.body, { childList: true, subtree: true });
        addMediaListeners();
        automateModalToFancybox();
        console.log("Reddit Fancybox script active."); // For debugging
    }

    // --- Twitter (X) Specific Logic ---
    if (window.location.hostname.includes('x.com')) {

        // Function to generate the original image URL
        function getOriginalImageUrl(src) {
            if (src.includes('?')) {
                const url = new URL(src);
                const params = new URLSearchParams(url.search);
                params.set('name', 'orig');
                return `${url.origin}${url.pathname}?${params.toString()}`;
            } else {
                // Twitter's new URL format might not have '?' for media,
                // and ':orig' might not always work if 'name' param is absent.
                // A more robust way for new URLs: if format=... is present, change to orig.
                if (src.includes('format=')) {
                    return src.replace(/(&|\?)format=[^&]+/, '$1name=orig');
                }
                // Fallback for older or different URL structures if any
                return src.includes(':large') ? src.replace(':large', ':orig') : src + ':orig';
            }
        }

        // Function to collect all images and videos in the relevant container
        function getGalleryImages(target) {
            let mediaContainer;
            const tweet = target.closest('article[role="article"]');

            if (tweet) {
                mediaContainer = tweet;
            } else {
                // Try to find a suitable container for media in other views (e.g., media tab)
                mediaContainer = target.closest('[data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
                if (mediaContainer) {
                    // Heuristic: go up a few levels to find a common parent for multiple images if they exist
                    let parentCounter = 0;
                    let tempContainer = mediaContainer.parentElement;
                    while(tempContainer && parentCounter < 5) { // Limit search depth
                        if (tempContainer.querySelectorAll('img[src*="pbs.twimg.com"], video[src*="video.twimg.com"]').length > 1) {
                            mediaContainer = tempContainer;
                            break;
                        }
                        tempContainer = tempContainer.parentElement;
                        parentCounter++;
                    }
                    if (!mediaContainer.parentElement && target.closest('[aria-label*="Timeline:"]')) { // If still not good, check timeline
                         mediaContainer = target.closest('[aria-label*="Timeline:"]');
                    }
                } else {
                     mediaContainer = target.closest('[aria-label*="Timeline:"]');
                }
            }
            if (!mediaContainer) mediaContainer = document.body; // Fallback to body, less ideal

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
                // For videos, the src attribute is usually direct.
                // If videos also have preview images that are caught by the img selector,
                // ensure they are handled or deduplicated if necessary.
                // For now, assume video src is unique enough.
                const videoSrc = video.querySelector('source[src*="video.twimg.com"]')?.src || video.src;
                if(videoSrc && !seenUrls.has(videoSrc)) {
                    items.push({ src: videoSrc, type: 'video', el: video });
                    seenUrls.add(videoSrc);
                }
            });
            return items;
        }

        // Function to open media in Fancybox
        function openFancybox(e) {
            // Check if the click is on a relevant element or inside something we should ignore
            const clickedElement = e.target;
            if (clickedElement.closest('.fancybox__container') ||
                clickedElement.closest('a[href^="/"] [data-testid="User-Name"]')) { // Ignore clicks on user profile links within cards
                return;
            }

            const targetMediaElement = clickedElement.closest('img[src*="pbs.twimg.com"]:not([src*="profile_images"]), video[src*="video.twimg.com"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]');

            if (!targetMediaElement) return;

            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();


            const galleryItems = getGalleryImages(targetMediaElement);
            let startIndex = 0;

            if (targetMediaElement.tagName === 'IMG' && targetMediaElement.src.includes('pbs.twimg.com')) {
                const clickedSrc = getOriginalImageUrl(targetMediaElement.src);
                startIndex = galleryItems.findIndex(item => item.src === clickedSrc);
            } else if (targetMediaElement.tagName === 'VIDEO' && targetMediaElement.src.includes('video.twimg.com')) {
                const clickedSrc = targetMediaElement.src; // or from source element
                startIndex = galleryItems.findIndex(item => item.src === clickedSrc || item.el === targetMediaElement);
            } else if (galleryItems.length > 0) { // Fallback for clicks on container like tweetPhoto
                 const firstImage = galleryItems.find(item => item.type ==='image');
                 if (firstImage) startIndex = galleryItems.indexOf(firstImage);
            }


            if (galleryItems.length > 0) {
                Fancybox.show(galleryItems.map(item => ({
                    src: item.src,
                    type: item.type
                })), {
                    ...commonFancyboxOptions, // Use common options
                    startIndex: Math.max(0, startIndex) // Ensure startIndex is not -1
                });
            }
        }

        // Function to apply event listeners to media elements
        function addMediaListeners() {
            // More specific selectors might be needed if Twitter's DOM is very dynamic
            // Listen on a higher-level stable element if direct binding is problematic
            const targetNode = document.querySelector('body'); // Observe body or primary column
            if (!targetNode) return;

            // Debounce or ensure listeners are not added multiple times unnecessarily
            if (targetNode.dataset.xFancyboxListenersAttached) return;

            // Using event delegation on a stable parent
            targetNode.addEventListener('click', function(e) {
                // Check if the clicked element (or its parent) is a media item we care about
                const mediaTarget = e.target.closest('img[src*="pbs.twimg.com"]:not([src*="profile_images"]), video[src*="video.twimg.com"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
                if (mediaTarget) {
                    // Further check: ensure it's within an article or a media timeline context if possible
                    // This helps avoid triggering on profile pictures in mentions, etc.
                    if (mediaTarget.closest('article[role="article"], [aria-label*="Timeline:"], [data-testid="lightbox"]')) {
                         // Prevent default image link navigation only if we are opening fancybox
                        const potentialGallery = getGalleryImages(mediaTarget);
                        if(potentialGallery && potentialGallery.length > 0){
                            openFancybox(e); // Pass the event object
                        }
                    }
                }
            }, true); // Use capture phase

            targetNode.dataset.xFancyboxListenersAttached = 'true';
        }

        // Initial run & Observer for dynamic content
        // Twitter loads content dynamically, so we need to re-apply listeners or use delegation.
        // Event delegation (used in addMediaListeners above) is generally better for performance.
        // A MutationObserver can be a fallback or used for elements that delegation doesn't catch well.

        // We are using event delegation in addMediaListeners, so a complex observer might not be needed
        // if the delegation target (document.body) is sufficient.
        // However, if there are specific containers that get replaced entirely, an observer might be useful.
        // For now, relying on the delegated event from addMediaListeners.
        addMediaListeners();
        console.log("Twitter (X) Fancybox script active."); // For debugging
    }

})();
