// ==UserScript==
// @name         DeviantArt FancyBox Single Image Trigger with Options
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Replace deviantart.com gallery with Fancybox v5.0.36
// @author       You
// @match        https://www.deviantart.com/*
// @require      https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.umd.js
// @resource     fancyboxCSS https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.36/dist/fancybox/fancybox.css
// @grant        GM_addStyle
// @grant        GM_getResourceText
// ==/UserScript==

(function () {
  "use strict";

  // Inject FancyBox CSS.
  GM_addStyle(GM_getResourceText("fancyboxCSS"));

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

    // Open FancyBox with just the clicked image and include the provided options.
    Fancybox.show(
      [{ src: getHighQualityImageUrl(target.src), type: "image" }],
      {
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
      }
    );
  }

  // Attach the event listener at the capture phase.
  document.documentElement.addEventListener("click", handleDocumentClick, true);
})();
