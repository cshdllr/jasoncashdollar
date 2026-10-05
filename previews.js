/* Enhance static project labels with thumbnail galleries and a shared viewer. */
(() => {
    const projects = window.PORTFOLIO_PREVIEWS;
    if (!projects || typeof HTMLDialogElement === 'undefined') return;

    const slides = [];
    const dialog = document.createElement('dialog');
    dialog.className = 'preview-lightbox';
    dialog.setAttribute('aria-labelledby', 'preview-title');
    dialog.innerHTML = `
        <div class="preview-rail">
        <div class="preview-card">
        <div class="preview-panel"><div class="preview-stage"></div></div>
        </div>
        <div class="preview-caption">
            <div class="preview-caption-heading">
            <h2 id="preview-title" tabindex="-1" autofocus></h2>
            <div class="preview-links"></div>
            </div>
            <div class="preview-copy"></div>
        </div>
        </div>`;
    document.body.append(dialog);

    const stage = dialog.querySelector('.preview-stage');
    const panel = dialog.querySelector('.preview-card');
    const title = dialog.querySelector('#preview-title');
    const copy = dialog.querySelector('.preview-copy');
    const caption = dialog.querySelector('.preview-caption');
    let captionLinks = '';
    const captionTransitions = new Map();
    const captionSegmenter = typeof Intl.Segmenter === 'function'
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;

    function captionLayer(text) {
        const layer = document.createElement('span');
        layer.className = 'preview-text-layer';
        layer.setAttribute('aria-hidden', 'true');
        // Keep words intact for natural wrapping, but animate complete graphemes
        // so accents and emoji never get split into separate moving pieces.
        for (const token of text.split(/(\s+)/u)) {
            if (/^\s+$/u.test(token)) { layer.append(token); continue; }
            const word = document.createElement('span');
            word.className = 'preview-text-word';
            const characters = captionSegmenter
                ? Array.from(captionSegmenter.segment(token), part => part.segment) : Array.from(token);
            for (const character of characters) {
                const letter = document.createElement('span');
                letter.className = 'preview-text-letter';
                letter.textContent = character;
                word.append(letter);
            }
            layer.append(word);
        }
        return layer;
    }

    function settleCaptions() {
        for (const finish of captionTransitions.values()) finish();
    }

    function animateCaptionText(element, text, animate) {
        const previous = element.dataset.captionText || '';
        if (animate && previous === text) return;
        captionTransitions.get(element)?.();
        const oldWidth = element.getBoundingClientRect().width;
        element.dataset.captionText = text;
        if (!animate || reducedMotion.matches || !text) {
            element.textContent = text;
            return;
        }
        const accessible = document.createElement('span');
        accessible.className = 'preview-text-accessible';
        accessible.textContent = text;
        const outgoing = captionLayer(previous);
        outgoing.classList.add('is-exiting');
        outgoing.style.width = `${oldWidth}px`;
        const incoming = captionLayer(text);
        element.replaceChildren(accessible, incoming, outgoing);
        const { captionDuration: duration, captionLift: lift, captionStagger: stagger, captionBlur: blur } = motionSettings;
        const animations = [];
        for (const [layer, entering] of [[outgoing, false], [incoming, true]]) {
            const letters = [...layer.querySelectorAll('.preview-text-letter')];
            // Bound the wave so longer captions never take seconds to finish.
            const step = Math.min(stagger, 120 / Math.max(1, letters.length - 1));
            letters.forEach((letter, index) => {
                const clear = { transform: 'translateY(0)', opacity: 1, filter: 'blur(0px)' };
                const shifted = { transform: `translateY(${entering ? lift : -lift}px)`, opacity: 0, filter: `blur(${blur}px)` };
                animations.push(letter.animate(entering ? [shifted, clear] : [clear, shifted], {
                    duration: entering ? duration : duration * 0.55,
                    delay: (entering ? 45 : 0) + index * step * (entering ? 1 : 0.5),
                    easing: motionEasings[motionSettings.easing],
                    fill: 'both'
                }));
            });
        }
        const finish = () => {
            if (captionTransitions.get(element) !== finish) return;
            captionTransitions.delete(element);
            outgoing.remove();
            animations.forEach(animation => animation.cancel());
        };
        captionTransitions.set(element, finish);
        Promise.all(animations.map(animation => animation.finished)).then(finish).catch(() => {});
    }

    function updateCaption(animate = true) {
        const { item, project } = slides[current];
        const enteringCaption = !title.dataset.captionText;
        const titleChanged = title.dataset.captionText !== item.title;
        animateCaptionText(title, item.title, animate);
        animateCaptionText(copy, item.description.join('\n'), animate);
        const nextLinks = JSON.stringify(project.links);
        if (!animate || reducedMotion.matches) captionTransitions.get(links)?.();
        if (captionLinks === nextLinks && !enteringCaption) return;
        captionLinks = nextLinks;
        captionTransitions.get(links)?.();
        links.replaceChildren(...project.links.map(link => {
            const a = document.createElement('a');
            a.href = link.href;
            a.textContent = link.label;
            if (link.href.startsWith('https:')) {
                a.target = '_blank';
                a.rel = 'noopener noreferrer';
            }
            return a;
        }));
        if (animate && !reducedMotion.matches && project.links.length) {
            const { captionDuration: duration, captionLift: lift, captionBlur: blur, captionStagger: stagger } = motionSettings;
            const characters = captionSegmenter
                ? Array.from(captionSegmenter.segment(item.title), part => part.segment) : Array.from(item.title);
            const letters = characters.filter(character => !/^\s+$/u.test(character)).length;
            // Follow the title's last entering letter instead of appearing ahead
            // of it. Backwards fill keeps the pill invisible during the delay.
            const titleWave = titleChanged ? Math.min(120, Math.max(0, letters - 1) * stagger) : 0;
            links.inert = true;
            const animation = links.animate([
                { opacity: 0, transform: `translateY(${lift}px)`, filter: `blur(${blur}px)` },
                { opacity: 1, transform: 'translateY(0)', filter: 'blur(0px)' }
            ], {
                delay: 45 + titleWave + duration * 0.2,
                duration: duration * 0.7,
                easing: motionEasings[motionSettings.easing],
                fill: 'both'
            });
            const finish = () => {
                if (captionTransitions.get(links) !== finish) return;
                captionTransitions.delete(links);
                links.inert = false;
                animation.cancel();
            };
            captionTransitions.set(links, finish);
            animation.finished.then(finish).catch(() => {});
        }
    }
    const links = dialog.querySelector('.preview-links');
    const rail = dialog.querySelector('.preview-rail');
    let current = 0;
    let opener;
    let restoredFocus;
    function clearRestoredFocus() {
        restoredFocus?.classList.remove('is-restored-focus');
        restoredFocus = null;
    }
    function prepareFocusReturn() {
        clearRestoredFocus();
        restoredFocus = opener;
        restoredFocus?.classList.add('is-restored-focus');
    }
    document.addEventListener('keydown', event => {
        if (!dialog.open && ['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) clearRestoredFocus();
    }, true);
    document.addEventListener('focusin', event => {
        if (restoredFocus && event.target !== restoredFocus) clearRestoredFocus();
    });
    let pagePosition;
    let motion;
    let closing = false;
    let motionVersion = 0;
    let navigation;
    const peekEntrances = new Set();
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    const inlineVideos = new Map();
    const videoCleanups = new WeakMap();
    const desktopStacks = matchMedia('(hover: hover) and (pointer: fine)');

    const motionDefaults = { duration: 420, easing: 'smooth', scale: 0.9, captionDuration: 320, captionLift: 6, captionStagger: 8, captionBlur: 2 };
    const motionEasings = {
        smooth: 'cubic-bezier(.22, 1, .36, 1)',
        gentle: 'cubic-bezier(.4, 0, .2, 1)',
        even: 'linear'
    };
    let motionSettings = { ...motionDefaults };
    try {
        const saved = JSON.parse(localStorage.getItem('portfolio-viewer-motion'));
        if (saved && Number.isFinite(saved.duration) && saved.duration >= 200 && saved.duration <= 1000
            && Number.isFinite(saved.scale) && saved.scale >= 0.8 && saved.scale <= 1
            && Object.hasOwn(motionEasings, saved.easing)) motionSettings = { ...motionDefaults, duration: saved.duration, scale: saved.scale, easing: saved.easing };
        for (const [key, min, max] of [['captionDuration', 160, 700], ['captionLift', 0, 16], ['captionStagger', 0, 20], ['captionBlur', 0, 6]]) {
            if (Number.isFinite(saved?.[key]) && saved[key] >= min && saved[key] <= max) motionSettings[key] = saved[key];
        }
    } catch { /* Storage may be unavailable in a local file preview. */ }
    const tuner = document.createElement('aside');
    tuner.className = 'preview-motion-tuner';
    tuner.hidden = !new URLSearchParams(location.search).has('tuneMotion');
    tuner.setAttribute('aria-label', 'Viewer motion settings');
    tuner.innerHTML = `
        <div class="preview-motion-heading"><strong>Viewer motion</strong><button type="button" data-motion="hide" aria-label="Hide motion settings">×</button></div>
        <label for="motion-duration">Duration <output id="motion-duration-value"></output></label>
        <input id="motion-duration" type="range" min="200" max="1000" step="20">
        <label for="motion-easing">Easing</label>
        <select id="motion-easing"><option value="smooth">Smooth ease out</option><option value="gentle">Gentle ease in and out</option><option value="even">Even speed</option></select>
        <label for="motion-scale">Neighbor scale <output id="motion-scale-value"></output></label>
        <input id="motion-scale" type="range" min="0.8" max="1" step="0.01">
        <strong class="preview-motion-section">Caption motion</strong>
        <label for="caption-duration">Duration <output id="caption-duration-value"></output></label>
        <input id="caption-duration" data-caption-setting="captionDuration" data-unit="ms" type="range" min="160" max="700" step="20">
        <label for="caption-lift">Lift <output id="caption-lift-value"></output></label>
        <input id="caption-lift" data-caption-setting="captionLift" data-unit="px" type="range" min="0" max="16" step="1">
        <label for="caption-stagger">Character stagger <output id="caption-stagger-value"></output></label>
        <input id="caption-stagger" data-caption-setting="captionStagger" data-unit="ms" type="range" min="0" max="20" step="1">
        <label for="caption-blur">Blur <output id="caption-blur-value"></output></label>
        <input id="caption-blur" data-caption-setting="captionBlur" data-unit="px" type="range" min="0" max="6" step="0.5">
        <div class="preview-motion-actions"><button type="button" data-motion="previous">← Previous</button><button type="button" data-motion="next">Next →</button><button type="button" data-motion="reset">Reset</button></div>
        <p>Saved in this browser · T to toggle</p>`;
    dialog.append(tuner);
    const durationInput = tuner.querySelector('#motion-duration');
    const easingInput = tuner.querySelector('#motion-easing');
    const scaleInput = tuner.querySelector('#motion-scale');
    function applyMotionSettings() {
        rail.style.setProperty('--preview-neighbor-scale', motionSettings.scale);
        rail.style.setProperty('--preview-card-step', `${(1 + motionSettings.scale) * 50}%`);
        durationInput.value = motionSettings.duration;
        easingInput.value = motionSettings.easing;
        scaleInput.value = motionSettings.scale;
        tuner.querySelectorAll('[data-caption-setting]').forEach(input => {
            input.value = motionSettings[input.dataset.captionSetting];
            tuner.querySelector(`#${input.id}-value`).textContent = `${input.value} ${input.dataset.unit}`;
        });
        tuner.querySelector('#motion-duration-value').textContent = `${motionSettings.duration} ms`;
        tuner.querySelector('#motion-scale-value').textContent = `${Math.round(motionSettings.scale * 100)}%`;
    }
    function saveMotionSettings() {
        resetNavigation();
        settleCaptions();
        applyMotionSettings();
        try { localStorage.setItem('portfolio-viewer-motion', JSON.stringify(motionSettings)); } catch { /* Optional persistence. */ }
    }
    tuner.addEventListener('input', () => {
        motionSettings = { ...motionSettings, duration: Number(durationInput.value), easing: easingInput.value, scale: Number(scaleInput.value) };
        tuner.querySelectorAll('[data-caption-setting]').forEach(input => { motionSettings[input.dataset.captionSetting] = Number(input.value); });
        saveMotionSettings();
    });
    tuner.addEventListener('click', event => {
        const action = event.target.closest('[data-motion]')?.dataset.motion;
        if (action === 'hide') { tuner.hidden = true; title.focus({ preventScroll: true }); }
        if (action === 'reset') { motionSettings = { ...motionDefaults }; saveMotionSettings(); }
        if (action === 'previous' || action === 'next') show(current + (action === 'next' ? 1 : -1), action === 'next' ? 1 : -1);
    });
    applyMotionSettings();

    // A playing/loadedmetadata event does not guarantee a painted frame. Keep
    // the independent poster underneath until the decoder submits one.
    function watchVideoFrames(video, hideOnPause = false) {
        let pendingFrame;
        let usesVideoCallback = false;
        const cancel = () => {
            if (pendingFrame == null) return;
            if (usesVideoCallback) video.cancelVideoFrameCallback(pendingFrame);
            else cancelAnimationFrame(pendingFrame);
            pendingFrame = null;
        };
        const pending = () => {
            cancel();
            video.classList.remove('has-frame');
        };
        const ready = () => {
            if (video.readyState < 2 || video.seeking || (hideOnPause && video.paused) || video.classList.contains('has-frame')) return;
            cancel();
            const reveal = () => {
                pendingFrame = null;
                if (video.readyState >= 2 && !video.seeking) video.classList.add('has-frame');
            };
            // Paused/reduced-motion media may not submit another compositor
            // frame. loadeddata/seeked plus a paint tick covers that case.
            usesVideoCallback = !!video.requestVideoFrameCallback && !video.paused;
            pendingFrame = usesVideoCallback
                ? video.requestVideoFrameCallback(reveal) : requestAnimationFrame(reveal);
        };
        const readyEvents = ['loadeddata', 'canplay', 'playing', 'seeked'];
        const pendingEvents = ['seeking', 'emptied', 'error', ...(hideOnPause ? ['pause'] : [])];
        readyEvents.forEach(event => video.addEventListener(event, ready));
        pendingEvents.forEach(event => video.addEventListener(event, pending));
        videoCleanups.set(video, () => {
            cancel();
            readyEvents.forEach(event => video.removeEventListener(event, ready));
            pendingEvents.forEach(event => video.removeEventListener(event, pending));
            videoCleanups.delete(video);
        });
    }

    function captureVideoFrame(video) {
        if (!video?.classList.contains('has-frame') || video.readyState < 2 || video.seeking
            || !video.videoWidth || !video.videoHeight) return null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const context = canvas.getContext('2d');
            if (!context) return null;
            context.drawImage(video, 0, 0);
            return canvas;
        } catch {
            // Decoding can change between the readiness check and drawing.
            return null;
        }
    }

    function framePoster(video, fallback) {
        const canvas = captureVideoFrame(video);
        if (!canvas) return fallback;
        try {
            return canvas.toDataURL();
        } catch {
            // file:// and cross-origin media can play but prohibit canvas export.
            // A frame capture is optional; it must never abort opening the viewer.
            return fallback;
        }
    }

    function updateInlineVideos() {
        inlineVideos.forEach((visible, video) => {
            const thumbnail = video.closest('.preview-thumbnail');
            const collapsed = desktopStacks.matches && video.closest('.is-stack:not(.is-expanded)');
            const covered = collapsed && thumbnail !== thumbnail.parentElement.firstElementChild;
            if (visible && !covered && !document.hidden && !dialog.open && !reducedMotion.matches) {
                if (!video.hasAttribute('src')) video.src = video.dataset.src;
                if (video.paused) video.play().catch(() => {});
            } else {
                video.pause();
            }
        });
    }
    const videoObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => inlineVideos.set(entry.target, entry.isIntersecting));
        updateInlineVideos();
    }, { threshold: 0 });
    document.addEventListener('visibilitychange', updateInlineVideos);

    function resetMotion() {
        motionVersion++;
        if (motion) {
            motion.animations.forEach(animation => animation.cancel());
            motion.ghost?.remove();
            motion = null;
        }
        stage.classList.remove('is-morphing');
    }

    function finishMotion() {
        resetMotion();
        if (closing) {
            dialog.close();
        } else {
            dialog.classList.add('is-revealed');
            const video = stage.querySelector('video');
            if (video && !reducedMotion.matches) video.play().catch(() => {});
        }
    }

    function animateLightbox(opening) {
        if (motion && closing === !opening) return;
        closing = !opening;
        dialog.classList.toggle('is-revealed', opening);
        if (reducedMotion.matches) {
            finishMotion();
            return;
        }
        if (motion) {
            // Reverse the running timeline from its current progress, rather than
            // starting over at either endpoint. Even a very quick Escape works.
            motion.animations.forEach(animation => {
                animation.reverse();
                animation.updatePlaybackRate(Math.sign(animation.playbackRate) * motion.duration / (opening ? 420 : 200));
            });
        } else {
            const { item, trigger } = slides[current];
            const thumb = trigger.getBoundingClientRect();
            const strip = trigger.parentElement.getBoundingClientRect();
            const media = stage.querySelector('.preview-media');
            const visible = thumb.top >= 0 && thumb.bottom <= innerHeight &&
                thumb.left >= strip.left && thumb.right <= strip.right;
            let ghost;
            const animations = [];
            const options = { duration: opening ? 420 : 200, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' };
            if (media && visible && trigger.querySelector('img')) {
                const bounds = media.getBoundingClientRect();
                const thumbImage = trigger.querySelector('img');
                const coversStage = getComputedStyle(media).objectFit === 'cover';
                const coversThumbnail = getComputedStyle(thumbImage).objectFit === 'cover';
                const inlineVideo = trigger.querySelector('video');
                const frame = opening ? inlineVideo : media;
                const width = media.videoWidth || media.naturalWidth || inlineVideo?.videoWidth || thumbImage.naturalWidth;
                const height = media.videoHeight || media.naturalHeight || inlineVideo?.videoHeight || thumbImage.naturalHeight;
                const padding = item.type === 'book' ? 48 : 0;
                const scale = Math.min((bounds.width - padding) / width, (bounds.height - padding) / height);
                if (width && height && scale > 0) {
                    if (item.type === 'video' && frame?.readyState >= 2 && frame.classList.contains('has-frame') && !frame.seeking) {
                        // Carry the visible frame through both directions of the transition.
                        ghost = captureVideoFrame(frame);
                        if (!opening && inlineVideo?.readyState >= 1) inlineVideo.currentTime = media.currentTime;
                    }
                    if (!ghost) {
                        ghost = document.createElement('img');
                        ghost.src = media.tagName === 'IMG' && media.complete && media.naturalWidth
                            ? media.currentSrc : stage.querySelector('.preview-video-poster')?.src || thumbImage.currentSrc || item.thumbnail;
                        ghost.alt = '';
                        const fullImage = new Image();
                        fullImage.src = item.viewerSrc || item.poster || item.src;
                        fullImage.decode().then(() => {
                            if (ghost.isConnected && item.type !== 'video') ghost.src = fullImage.src;
                        }).catch(() => {});
                    }
                    ghost.className = 'preview-morph';
                    ghost.setAttribute('aria-hidden', 'true');
                    dialog.append(ghost);
                    const thumbScale = Math.min(thumb.width / width, thumb.height / height);
                    const thumbWidth = item.type === 'video' && !coversThumbnail ? width * thumbScale : thumb.width;
                    const thumbHeight = item.type === 'video' && !coversThumbnail ? height * thumbScale : thumb.height;
                    const small = { left: `${thumb.left + (thumb.width - thumbWidth) / 2}px`, top: `${thumb.top + (thumb.height - thumbHeight) / 2}px`, width: `${thumbWidth}px`, height: `${thumbHeight}px`, borderRadius: '8px' };
                    const large = coversStage
                        ? { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px`, borderRadius: getComputedStyle(panel.querySelector('.preview-panel')).borderRadius }
                        : { left: `${bounds.left + (bounds.width - width * scale) / 2}px`, top: `${bounds.top + (bounds.height - height * scale) / 2}px`, width: `${width * scale}px`, height: `${height * scale}px`, borderRadius: '0px' };
                    // Closing needs its own ease-out; reversing the opening
                    // curve starts slowly and feels like a delay.
                    animations.push(ghost.animate(opening ? [small, large] : [large, small], options));
                    stage.classList.add('is-morphing');
                }
            }
            const video = stage.querySelector('video');
            if (video) video.pause();
            animations.push(caption.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], options));
            animations.push(panel.animate(opening ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 1 }, { opacity: 0 }], options));
            motion = { ghost, animations, duration: options.duration };
        }
        const version = ++motionVersion;
        Promise.all(motion.animations.map(animation => animation.finished)).then(() => {
            if (version === motionVersion) finishMotion();
        }).catch(() => {}); // Navigation and resize intentionally cancel an old timeline.
    }

    function close() {
        resetNavigation();
        settleCaptions();
        if (dialog.open) {
            prepareFocusReturn();
            animateLightbox(false);
        }
    }

    function releaseVideo(container) {
        const video = container?.querySelector('video');
        if (!video) return;
        videoCleanups.get(video)?.();
        video.pause();
        video.removeAttribute('src');
        video.load();
    }

    function resetPeekEntrances() {
        for (const { peek, animation } of peekEntrances) {
            animation.cancel();
            peek.inert = false;
        }
        peekEntrances.clear();
    }

    function revealSidePreviews() {
        resetPeekEntrances();
        if (reducedMotion.matches) return;
        rail.querySelectorAll('.preview-peek').forEach((peek, index) => {
            peek.inert = true;
            const animation = peek.animate([
                { opacity: 0 },
                { opacity: 0.65 }
            ], {
                // Overlap the main opening so the sides do not feel delayed.
                delay: 100 + index * 40,
                duration: 260,
                easing: 'cubic-bezier(.22, 1, .36, 1)',
                fill: 'both'
            });
            const entrance = { peek, animation };
            peekEntrances.add(entrance);
            animation.finished.then(() => {
                if (!peekEntrances.delete(entrance)) return;
                peek.inert = false;
                animation.cancel();
            }).catch(() => {});
        });
    }

    function resetNavigation() {
        resetPeekEntrances();
        if (!navigation) return;
        navigation.animations.forEach(animation => animation.cancel());
        // Keep the same frozen frame when the outgoing card becomes a peek.
        // Swapping back to its poster here would create another end-of-slide flash.
        if (navigation.outgoingFrame) navigation.outgoingPeek.querySelector('.preview-stage').replaceChildren(navigation.outgoingFrame);
        if (navigation.incomingVideo?.isConnected) navigation.incomingVideo.controls = true;
        releaseVideo(navigation.outgoing);
        navigation.outgoing.remove();
        navigation = null;
    }

    function clearMedia() {
        releaseVideo(stage);
        stage.replaceChildren();
    }

    // Apply the same presentation to thumbnails, center cards, and neighbors.
    // Defaults stay in CSS; project exceptions live alongside preview content.
    function applyMediaStyle(element, project, item) {
        const settings = project.mediaStyle?.[item.type] || {};
        element.classList.toggle('is-image', item.type === 'image');
        for (const [key, property] of Object.entries({
            background: '--preview-media-background',
            viewerFit: '--preview-viewer-fit',
            thumbnailFit: '--preview-thumbnail-fit'
        })) {
            if (settings[key]) element.style.setProperty(property, settings[key]);
            else element.style.removeProperty(property);
        }
    }

    function createPeek(direction) {
        const { item, project } = slides[(current + direction + slides.length) % slides.length];
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `preview-card preview-peek ${direction < 0 ? 'is-previous' : 'is-next'}`;
        applyMediaStyle(button, project, item);
        button.setAttribute('aria-label', `${direction < 0 ? 'Previous' : 'Next'} preview: ${item.title} — ${item.description.join(' ')}`);
        const image = document.createElement('img');
        image.className = 'preview-media';
        image.decoding = 'async';
        image.classList.toggle('is-book', item.type === 'book');
        image.src = item.poster || item.thumbnail;
        image.alt = '';
        image.draggable = false;
        image.addEventListener('error', () => image.remove(), { once: true });
        const neighborStage = document.createElement('span');
        neighborStage.className = 'preview-stage';
        neighborStage.append(image);
        const neighborPanel = document.createElement('span');
        neighborPanel.className = 'preview-panel';
        neighborPanel.append(neighborStage);
        button.append(neighborPanel);
        button.addEventListener('click', () => navigate(direction));
        return button;
    }

    function navigate(direction) {
        if (closing) return;
        show(current + direction, direction);
        title.focus({ preventScroll: true });
    }

    function show(index, direction = 0) {
        resetNavigation();
        resetMotion();
        const outgoing = direction && !reducedMotion.matches ? panel.cloneNode(true) : null;
        let outgoingFrame;
        if (outgoing) {
            // Native controls can repaint on pause, focus changes, and removal.
            // Slide only the decoded pixels, never a live video/control surface.
            const video = stage.querySelector('video');
            if (video) {
                video.controls = false;
                outgoingFrame = captureVideoFrame(video);
                if (!outgoingFrame) {
                    outgoingFrame = document.createElement('img');
                    outgoingFrame.src = stage.querySelector('.preview-video-poster')?.src || video.poster || slides[current].item.thumbnail;
                    outgoingFrame.alt = '';
                }
                outgoingFrame.className = 'preview-media preview-frozen-frame';
                outgoingFrame.setAttribute('aria-hidden', 'true');
                video.pause();
                outgoing.querySelector('video').replaceWith(outgoingFrame);
            }
            outgoing.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
            outgoing.querySelectorAll('[autofocus]').forEach(element => element.removeAttribute('autofocus'));
        }
        closing = false;
        if (dialog.open) dialog.classList.add('is-revealed');
        current = (index + slides.length) % slides.length;
        clearMedia();
        const { project, item } = slides[current];
        applyMediaStyle(panel, project, item);
        if (dialog.open) updateCaption(Boolean(direction));

        const content = document.createElement('div');
        content.className = 'preview-current';
        const media = document.createElement(item.type === 'video' ? 'video' : 'img');
        media.className = 'preview-media';
        if (item.type === 'video') {
            // Restore controls after this card has reached the center.
            media.controls = !outgoing;
            media.muted = true;
            media.loop = true;
            media.playsInline = true;
            media.preload = 'auto';
            media.setAttribute('aria-label', item.alt);
            const inlineVideo = slides[current].trigger.querySelector('video');
            const startTime = inlineVideo?.currentTime || 0;
            const poster = document.createElement('img');
            poster.className = 'preview-video-poster';
            poster.alt = '';
            poster.src = framePoster(inlineVideo, item.thumbnail);
            content.append(poster);
            media.poster = poster.src;
            media.addEventListener('loadedmetadata', () => {
                if (startTime > 0) media.currentTime = Math.min(startTime, Math.max(0, media.duration - 0.05));
            }, { once: true });
            watchVideoFrames(media);
        } else {
            // Large photos must not block painting the caption animation.
            media.decoding = 'async';
            media.alt = item.alt;
            media.classList.toggle('is-book', item.type === 'book');
        }
        media.addEventListener('error', () => {
            if (slides[current].item !== item) return;
            const fallback = document.createElement('p');
            fallback.className = 'preview-media-fallback';
            fallback.textContent = item.type === 'book'
                ? `${item.title} — cover unavailable. The book details are below.`
                : 'This preview could not load.';
            content.replaceChildren(fallback);
        }, { once: true });
        media.src = item.viewerSrc || item.src;
        content.append(media);
        const previous = createPeek(-1);
        const next = createPeek(1);
        stage.append(content);
        rail.querySelectorAll('.preview-peek').forEach(peek => peek.remove());
        rail.append(previous, next);
        if (outgoing) {
            outgoing.classList.add('is-outgoing');
            outgoing.setAttribute('aria-hidden', 'true');
            outgoing.inert = true;
            rail.append(outgoing);
            const neighborScale = motionSettings.scale;
            const distance = panel.getBoundingClientRect().width * (1 + neighborScale) / 2 + parseFloat(getComputedStyle(rail).getPropertyValue('--preview-card-gap'));
            const options = { duration: motionSettings.duration, easing: motionEasings[motionSettings.easing], fill: 'both' };
            const outgoingPeek = direction > 0 ? previous : next;
            const animations = [
                panel.animate([
                    { transform: `translateX(${direction * distance}px) scale(${neighborScale})`, opacity: 0.65 },
                    { transform: 'translateX(0) scale(1)', opacity: 1 }
                ], options),
                outgoing.animate([
                    { transform: 'translateX(0) scale(1)', opacity: 1 },
                    { transform: `translateX(${-direction * distance}px) scale(${neighborScale})`, opacity: 0.65 }
                ], options),
                ...[previous, next].map(peek => peek.animate([
                    { transform: `translateX(${direction * distance}px) scale(${neighborScale})`, opacity: 0 },
                    // The outgoing card already fills this slot and dims as it moves.
                    // Fading its duplicate in underneath stacks their opacity, then
                    // flashes darker when the outgoing card is removed.
                    { transform: `translateX(0) scale(${neighborScale})`, opacity: peek === outgoingPeek ? 0 : 0.65 }
                ], options))
            ];
            const transition = { outgoing, animations, outgoingFrame, outgoingPeek, incomingVideo: item.type === 'video' ? media : null };
            navigation = transition;
            Promise.all(animations.map(animation => animation.finished)).then(() => {
                if (navigation === transition) resetNavigation();
            }).catch(() => {});
        }
        // Respect reduced motion and browser autoplay policies; controls always remain available.
        if (item.type === 'video' && !reducedMotion.matches) {
            media.play().catch(() => {});
        }
        panel.scrollTop = 0;
    }

    function open(index, trigger) {
        opener = trigger;
        pagePosition = { left: window.scrollX, top: window.scrollY };
        show(index);
        dialog.classList.remove('is-revealed');
        // A fresh opening is an entrance, not a morph from the last closed item.
        settleCaptions();
        for (const element of [title, copy]) {
            element.dataset.captionText = '';
            element.replaceChildren();
        }
        dialog.showModal();
        updateCaption(true);
        updateInlineVideos();
        // Establish the transparent backdrop before starting its CSS transition.
        getComputedStyle(dialog, '::backdrop').opacity;
        animateLightbox(true);
        revealSidePreviews();
        title.focus({ preventScroll: true });
    }

    function enableRubberBand(strip) {
        let pull = 0;
        let offset = 0;
        let spring;
        let releaseTimer;
        let idleTimer;
        let returningDirection = 0;
        const limit = 48;
        const clearStretch = () => {
            clearTimeout(releaseTimer);
            releaseTimer = undefined;
            spring?.cancel();
            spring = undefined;
            pull = offset = 0;
            strip.style.removeProperty('translate');
        };
        const reset = () => {
            clearStretch();
            clearTimeout(idleTimer);
            returningDirection = 0;
            strip.classList.remove('is-scrolling');
        };
        const release = () => {
            releaseTimer = undefined;
            returningDirection = Math.sign(pull);
            if (reducedMotion.matches || Math.abs(offset) < 0.5) {
                clearStretch();
                strip.classList.remove('is-scrolling');
                return;
            }
            // Run the return on the compositor. Its start is bounded from the
            // first edge pull, rather than postponed by every momentum event.
            const animation = strip.animate([
                { translate: `${offset}px 0`, offset: 0 },
                { translate: `${-offset * 0.06}px 0`, offset: 0.7 },
                { translate: '0px 0', offset: 1 }
            ], { duration: 340, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both' });
            spring = animation;
            strip.style.removeProperty('translate');
            animation.finished.then(() => {
                if (spring !== animation) return;
                clearStretch();
                strip.classList.remove('is-scrolling');
            }).catch(() => {});
        };
        strip.addEventListener('wheel', event => {
            if (event.ctrlKey || event.metaKey) return;
            if (strip.parentElement.matches('.is-stack:not(.is-expanded)') &&
                desktopStacks.matches) return;
            const horizontal = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX;
            if (!horizontal || (!event.shiftKey && Math.abs(event.deltaY) > Math.abs(horizontal))) return;
            if (!event.cancelable) return;
            event.preventDefault();
            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                // A quiet wheel starts a new gesture. Ongoing outward momentum
                // is consumed while the current return finishes.
                returningDirection = 0;
                if (!pull && !spring) strip.classList.remove('is-scrolling');
            }, 140);
            const direction = Math.sign(horizontal);
            if ((returningDirection || spring) && direction === Math.sign(pull || returningDirection)) return;
            if (returningDirection || spring) {
                // Reversing direction immediately scrolls back into the list.
                clearStretch();
                returningDirection = 0;
            }
            strip.classList.add('is-scrolling');
            const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1;
            let delta = horizontal * unit;
            if (pull) {
                const nextPull = pull + delta;
                if (Math.sign(nextPull) === Math.sign(pull)) {
                    pull = nextPull;
                    delta = 0;
                } else {
                    delta = nextPull;
                    pull = 0;
                }
            }
            const max = Math.max(0, strip.scrollWidth - strip.clientWidth);
            const target = Math.max(0, Math.min(max, strip.scrollLeft)) + delta;
            strip.scrollLeft = Math.max(0, Math.min(max, target));
            pull += target - Math.max(0, Math.min(max, strip.scrollLeft));
            if (reducedMotion.matches) pull = 0;
            offset = -Math.sign(pull) * limit * Math.abs(pull) / (limit + Math.abs(pull));
            if (pull) {
                strip.style.translate = `${offset}px 0`;
                // Schedule once: even a wheel that keeps emitting at the edge
                // cannot leave the thumbnails stretched indefinitely.
                if (releaseTimer === undefined) releaseTimer = setTimeout(release, 70);
            } else {
                clearStretch();
            }
        }, { passive: false });
        // Touch retains platform elasticity; reset interrupted desktop gestures.
        strip.addEventListener('pointerdown', reset, { passive: true });
        strip.addEventListener('focusin', reset);
        window.addEventListener('resize', reset);
        window.addEventListener('blur', reset);
        reducedMotion.addEventListener('change', reset);
    }

    function enableThumbnailStack(shell, strip) {
        const thumbnails = Array.from(strip.children);
        if (thumbnails.length < 2) return;
        shell.classList.add('is-stack');
        const angles = [-2, 3, -3.5, 2, -1.5, 3.5];
        let rowX = 0;
        let collapseTimer;
        thumbnails.forEach((thumbnail, index) => {
            thumbnail.style.setProperty('--row-x', `${rowX}px`);
            thumbnail.style.setProperty('--stack-x', `${Math.min(index, 4) * 5}px`);
            thumbnail.style.setProperty('--stack-y', `${index ? (index % 3) * 2 - 2 : 0}px`);
            thumbnail.style.setProperty('--stack-angle', `${angles[index % angles.length]}deg`);
            thumbnail.style.setProperty('--stack-order', thumbnails.length - index);
            thumbnail.style.setProperty('--fan-delay', `${Math.min(index, 5) * 18}ms`);
            rowX += (thumbnail.classList.contains('is-book') ? 48 : 104) + 8;
        });
        const expand = () => {
            clearTimeout(collapseTimer);
            if (desktopStacks.matches) shell.classList.add('is-expanded');
            updateInlineVideos();
        };
        const collapse = () => {
            clearTimeout(collapseTimer);
            collapseTimer = setTimeout(() => {
                const ownsLightbox = dialog.open && opener?.closest('.preview-project') === shell.closest('.preview-project');
                if (shell.matches(':hover') || shell.querySelector(':focus-visible') || ownsLightbox) return;
                strip.scrollLeft = 0;
                shell.classList.remove('is-expanded');
                updateInlineVideos();
            }, 180);
        };
        // Start on an actual thumbnail; the expanded row stays open while the
        // pointer crosses gaps or reaches a previously hidden thumbnail.
        strip.addEventListener('pointerover', event => {
            if (event.target.closest('.preview-thumbnail')) expand();
        });
        shell.addEventListener('pointerleave', collapse);
        shell.addEventListener('focusin', expand);
        shell.addEventListener('focusout', collapse);
        dialog.addEventListener('close', collapse);
        desktopStacks.addEventListener('change', () => {
            clearTimeout(collapseTimer);
            shell.classList.remove('is-expanded');
            strip.scrollLeft = 0;
            updateInlineVideos();
        });
    }

    projects.forEach(project => {
        const original = document.querySelector(`.project-card[data-preview-project="${project.slug}"], .project-card[href="${project.slug}"], .project-card[href="${project.slug}.html"]`);
        if (!original || !project.items.length) return;
        const first = slides.length;
        const article = document.createElement('article');
        article.className = 'preview-project';
        article.id = `preview-${project.slug}`;
        const heading = document.createElement('div');
        heading.className = 'preview-project-heading';
        const h3 = document.createElement('h3');
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'preview-project-title';
        trigger.textContent = project.title;
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-label', `View ${project.title} previews`);
        trigger.addEventListener('click', () => open(first, trigger));
        h3.append(trigger);
        const description = document.createElement('p');
        description.className = 'preview-project-description';
        description.textContent = project.description;
        heading.append(h3, description);
        article.append(heading);

        const strip = document.createElement('div');
        strip.className = 'preview-strip';
        strip.setAttribute('role', 'group');
        strip.setAttribute('aria-label', `${project.title} previews`);
        project.items.forEach((item, itemIndex) => {
            const index = slides.length;
            const button = document.createElement('button');
            slides.push({ project, item, trigger: button });
            button.type = 'button';
            button.className = 'preview-thumbnail';
            applyMediaStyle(button, project, item);
            button.classList.toggle('is-book', item.type === 'book');
            button.classList.toggle('is-video', item.type === 'video');
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-label', `${item.title}: ${item.description.join(' ')}, ${item.type === 'video' ? 'video, ' : ''}${itemIndex + 1} of ${project.items.length}`);
            button.title = `${item.title} — ${item.description.join(' ')}`;
            // Text remains visible if a remote book cover is unavailable.
            const fallback = document.createElement('span');
            fallback.className = 'preview-thumbnail-fallback';
            fallback.textContent = item.title;
            fallback.setAttribute('aria-hidden', 'true');
            const image = document.createElement('img');
            image.alt = '';
            image.loading = item.type === 'video' ? 'eager' : 'lazy';
            image.decoding = 'async';
            image.addEventListener('error', () => image.remove(), { once: true });
            image.src = item.thumbnail;
            button.append(fallback, image);
            if (item.type === 'video') {
                const video = document.createElement('video');
                video.muted = true;
                video.defaultMuted = true;
                video.loop = true;
                video.playsInline = true;
                video.preload = 'none';
                video.poster = item.thumbnail;
                video.dataset.src = item.previewVideo || item.src;
                video.setAttribute('aria-hidden', 'true');
                video.tabIndex = -1;
                watchVideoFrames(video, true);
                video.addEventListener('playing', () => button.classList.add('is-playing'));
                video.addEventListener('pause', () => button.classList.remove('is-playing'));
                video.addEventListener('error', () => {
                    videoObserver.unobserve(video);
                    inlineVideos.delete(video);
                    videoCleanups.get(video)?.();
                    button.classList.remove('is-playing');
                    video.remove();
                }, { once: true });
                button.append(video);
                inlineVideos.set(video, false);
                videoObserver.observe(video);
                const badge = document.createElement('span');
                badge.className = 'preview-play';
                badge.setAttribute('aria-hidden', 'true');
                button.append(badge);
            }
            button.addEventListener('click', () => open(index, button));
            strip.append(button);
        });
        if (project.slug === 'bookshelf' && Number.isInteger(project.totalBooks)) {
            const allBooks = document.createElement('a');
            allBooks.className = 'preview-thumbnail is-book preview-all-books';
            allBooks.href = 'bookshelf.html';
            allBooks.setAttribute('aria-label', `See all ${project.totalBooks} books`);
            const label = document.createElement('span');
            label.textContent = 'See all';
            const count = document.createElement('strong');
            count.textContent = project.totalBooks.toLocaleString();
            allBooks.append(label, count);
            strip.append(allBooks);
        }
        const shell = document.createElement('div');
        shell.className = 'preview-strip-shell';
        shell.append(strip);
        article.append(shell);
        enableRubberBand(strip);
        enableThumbnailStack(shell, strip);
        original.replaceWith(article);
    });

    dialog.addEventListener('cancel', event => {
        event.preventDefault();
        close();
    });
    dialog.addEventListener('close', () => {
        resetNavigation();
        resetMotion();
        dialog.classList.remove('is-revealed');
        clearMedia();
        prepareFocusReturn();
        opener?.focus({ preventScroll: true });
        // Native dialog focus restoration can scroll an overflowed thumbnail
        // strip. Keep the page exactly where it was when the preview opened.
        window.scrollTo({ ...pagePosition, behavior: 'instant' });
        updateInlineVideos();
    });

    // Native dialog contains focus and makes the background inert. Prevent the
    // shared site's Escape-to-top shortcut from moving the underlying page.
    dialog.addEventListener('keydown', event => {
        if (event.key === 'Escape') event.stopPropagation();
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key.toLowerCase() === 't' && !event.target.matches('input:not([type="range"]), select, textarea')) {
            event.preventDefault();
            tuner.hidden = !tuner.hidden;
            (tuner.hidden ? title : durationInput).focus({ preventScroll: true });
            return;
        }
        if (event.target.tagName === 'VIDEO' || event.target.closest('.preview-motion-tuner')) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            navigate(event.key === 'ArrowRight' ? 1 : -1);
        }
    });
    let backdropDown = false;
    const outside = event => {
        return !event.target.closest('.preview-card, .preview-caption, .preview-motion-tuner');
    };
    dialog.addEventListener('pointerdown', event => { backdropDown = outside(event); });
    dialog.addEventListener('click', event => {
        if (backdropDown && outside(event)) close();
        backdropDown = false;
    });
    let touchStart;
    stage.addEventListener('touchstart', event => {
        if (event.target.tagName !== 'VIDEO' && event.touches.length === 1) {
            touchStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        }
    }, { passive: true });
    stage.addEventListener('touchend', event => {
        if (!touchStart) return;
        const dx = event.changedTouches[0].clientX - touchStart.x;
        const dy = event.changedTouches[0].clientY - touchStart.y;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) navigate(dx < 0 ? 1 : -1);
        touchStart = null;
    }, { passive: true });
    stage.addEventListener('touchcancel', () => { touchStart = null; });
    // A resized viewport invalidates the geometry. Settle immediately rather
    // than sending the image to an obsolete position.
    window.addEventListener('resize', () => {
        resetNavigation();
        settleCaptions();
        if (motion) finishMotion();
    });
    reducedMotion.addEventListener('change', () => {
        resetNavigation();
        if (motion) finishMotion();
        if (reducedMotion.matches) stage.querySelector('video')?.pause();
        if (dialog.open) updateCaption(false);
        updateInlineVideos();
    });
})();
