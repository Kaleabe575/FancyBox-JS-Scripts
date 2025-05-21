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
                    ...commonFancyboxOptions,
                    startIndex: startIndex
                });
            }
        }
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
    }

    if (window.location.hostname.includes('x.com')) {
        function getOriginalImageUrl(src) {
            if (src.includes('?')) {
                const url = new URL(src);
                const params = new URLSearchParams(url.search);
                params.set('name', 'orig');
                return `${url.origin}${url.pathname}?${params.toString()}`;
            } else {
                if (src.includes('format=')) {
                    return src.replace(/(&|\?)format=[^&]+/, '$1name=orig');
                }
                return src.includes(':large') ? src.replace(':large', ':orig') : src + ':orig';
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
                    let parentCounter = 0;
                    let tempContainer = mediaContainer.parentElement;
                    while(tempContainer && parentCounter < 5) {
                        if (tempContainer.querySelectorAll('img[src*="pbs.twimg.com"], video[src*="video.twimg.com"]').length > 1) {
                            mediaContainer = tempContainer;
                            break;
                        }
                        tempContainer = tempContainer.parentElement;
                        parentCounter++;
                    }
                    if (!mediaContainer.parentElement && target.closest('[aria-label*="Timeline:"]')) {
                         mediaContainer = target.closest('[aria-label*="Timeline:"]');
                    }
                } else {
                     mediaContainer = target.closest('[aria-label*="Timeline:"]');
                }
            }
            if (!mediaContainer) mediaContainer = document.body;
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
                if(videoSrc && !seenUrls.has(videoSrc)) {
                    items.push({ src: videoSrc, type: 'video', el: video });
                    seenUrls.add(videoSrc);
                }
            });
            return items;
        }
        function openFancybox(e) {
            const clickedElement = e.target;
            if (clickedElement.closest('.fancybox__container') ||
                clickedElement.closest('a[href^="/"] [data-testid="User-Name"]')) {
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
                const clickedSrc = targetMediaElement.src;
                startIndex = galleryItems.findIndex(item => item.src === clickedSrc || item.el === targetMediaElement);
            } else if (galleryItems.length > 0) {
                 const firstImage = galleryItems.find(item => item.type ==='image');
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
            const targetNode = document.querySelector('body');
            if (!targetNode) return;
            if (targetNode.dataset.xFancyboxListenersAttached) return;
            targetNode.addEventListener('click', function(e) {
                const mediaTarget = e.target.closest('img[src*="pbs.twimg.com"]:not([src*="profile_images"]), video[src*="video.twimg.com"], [data-testid="tweetPhoto"], [data-testid="videoPlayer"]');
                if (mediaTarget) {
                    if (mediaTarget.closest('article[role="article"], [aria-label*="Timeline:"], [data-testid="lightbox"]')) {
                         const potentialGallery = getGalleryImages(mediaTarget);
                        if(potentialGallery && potentialGallery.length > 0){
                            openFancybox(e);
                        }
                    }
                }
            }, true);
            targetNode.dataset.xFancyboxListenersAttached = 'true';
        }
        addMediaListeners();
    }

})();
