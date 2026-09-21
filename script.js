/* ==========================================================================
   Cosmic Plunge - Scroll & Interactive Frame Animation Logic with Telemetry & Audio
   ========================================================================== */

const canvas = document.getElementById("scroll-animation");
const context = canvas.getContext("2d");

const loader = document.getElementById("loader");
const loaderStatus = document.getElementById("loader-status");
const loaderFill = document.getElementById("loader-fill");
const frameNumDisplay = document.getElementById("frame-num");
const progressBar = document.getElementById("progress-bar");
const activeSectionBadge = document.getElementById("active-section-name");

// Telemetry Elements
const hudAlt = document.getElementById("hud-alt");
const hudSpeed = document.getElementById("hud-speed");
const hudTemp = document.getElementById("hud-temp");
const hudGforce = document.getElementById("hud-gforce");
const thermalVal = document.getElementById("thermal-val");
const thermalFill = document.getElementById("thermal-fill");
const telemetryHud = document.getElementById("telemetry-hud");
const hudToggleBtn = document.getElementById("hud-toggle-btn");

// Audio Elements & State
const audioToggleBtn = document.getElementById("audio-toggle-btn");
const audioIcon = document.getElementById("audio-icon");
const audioText = document.getElementById("audio-text");
let audioCtx = null;
let synthOsc = null;
let gainNode = null;
let filterNode = null;
let isAudioPlaying = false;

const frameCount = 196;
const currentFrame = index => `assets/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

const images = [];
let loadedCount = 0;
let currentFrameIndex = 1;

// Sections definition matching animation timeline
const sectionsInfo = [
    { id: 'section-1', name: 'Stage 1: Deep Space', startFrame: 1, endFrame: 40 },
    { id: 'section-2', name: 'Stage 2: Atmosphere', startFrame: 41, endFrame: 85 },
    { id: 'section-3', name: 'Stage 3: City Skyline', startFrame: 86, endFrame: 140 },
    { id: 'section-4', name: 'Stage 4: Grand Carnival', startFrame: 141, endFrame: 196 }
];

/* --------------------------------------------------------------------------
   Dynamic Mouse Parallax & Ambient Zero-G Float State
   -------------------------------------------------------------------------- */
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
let currentX = 0;
let currentY = 0;
let ambientTime = 0;

// Track mouse position across screen (-1 to +1)
window.addEventListener('mousemove', (e) => {
    mouseX = (e.clientX / window.innerWidth) * 2 - 1;
    mouseY = (e.clientY / window.innerHeight) * 2 - 1;
}, { passive: true });

// Handle full screen canvas resizing with device pixel ratio
function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    // Immediately redraw current frame after resize
    updateImage(currentFrameIndex);
}

// Draw image frame using 100% Full Cover aspect ratio math
function drawImageCover(img) {
    if (!img || !img.complete) return;
    
    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1920;
    const ih = img.naturalHeight || 1080;
    
    const imgRatio = iw / ih;
    const canvasRatio = cw / ch;
    
    let renderW, renderH, offsetX, offsetY;
    
    if (canvasRatio > imgRatio) {
        renderW = cw;
        renderH = cw / imgRatio;
        offsetX = 0;
        offsetY = (ch - renderH) / 2;
    } else {
        renderH = ch;
        renderW = ch * imgRatio;
        offsetX = (cw - renderW) / 2;
        offsetY = (cw - renderW) / 2;
        offsetY = 0;
    }
    
    context.clearRect(0, 0, cw, ch);
    context.drawImage(img, offsetX, offsetY, renderW, renderH);
}

// Update active image frame
function updateImage(index) {
    currentFrameIndex = index;
    const img = images[index - 1];
    if (img && img.complete) {
        drawImageCover(img);
    }
    
    // Update frame counter UI
    if (frameNumDisplay) {
        frameNumDisplay.textContent = index.toString().padStart(3, '0');
    }
    
    // Update section active state
    updateSectionsUI(index);
}

// Activate sections and update header badge based on frame index
function updateSectionsUI(frameIndex) {
    let activeSec = sectionsInfo[0];
    
    sectionsInfo.forEach((sec) => {
        const elem = document.getElementById(sec.id);
        if (frameIndex >= sec.startFrame && frameIndex <= sec.endFrame) {
            activeSec = sec;
            if (elem) elem.classList.add('active');
        } else {
            if (elem) elem.classList.remove('active');
        }
    });
    
    if (activeSectionBadge && activeSec) {
        activeSectionBadge.textContent = activeSec.name;
    }
}

// Preload all 196 image frames smoothly
function preloadImages() {
    for (let i = 1; i <= frameCount; i++) {
        const img = new Image();
        img.src = currentFrame(i);
        
        img.onload = () => {
            loadedCount++;
            const progress = Math.floor((loadedCount / frameCount) * 100);
            
            if (loaderStatus) loaderStatus.textContent = `Loading sequence... ${progress}%`;
            if (loaderFill) loaderFill.style.width = `${progress}%`;
            
            // First frame loaded -> initial draw
            if (i === 1) {
                updateImage(1);
            }
            
            // All frames finished loading
            if (loadedCount === frameCount) {
                setTimeout(() => {
                    if (loader) loader.classList.add('hidden');
                }, 400);
            }
        };
        
        img.onerror = () => {
            loadedCount++;
            if (loadedCount === frameCount) {
                if (loader) loader.classList.add('hidden');
            }
        };
        
        images.push(img);
    }
}

/* --------------------------------------------------------------------------
   Dynamic Telemetry Calculations
   -------------------------------------------------------------------------- */
function updateTelemetry(scrollFraction) {
    // Altitude: 400 KM down to 0 KM
    const altitude = Math.max(0, (400 * (1 - scrollFraction))).toFixed(1);
    if (hudAlt) hudAlt.textContent = `${altitude} KM`;

    // Velocity Curve (Peak during re-entry around scroll 0.35)
    let speed = 0;
    if (scrollFraction < 0.2) {
        speed = Math.floor(27600 * (scrollFraction / 0.2));
    } else if (scrollFraction < 0.6) {
        speed = Math.floor(27600 - (18000 * ((scrollFraction - 0.2) / 0.4)));
    } else {
        speed = Math.floor(9600 * (1 - ((scrollFraction - 0.6) / 0.4)));
    }
    if (hudSpeed) hudSpeed.textContent = `${speed.toLocaleString()} KM/H`;

    // Heat Shield Temperature Curve
    let temp = 22;
    if (scrollFraction > 0.15 && scrollFraction < 0.55) {
        const factor = Math.sin(((scrollFraction - 0.15) / 0.4) * Math.PI);
        temp = Math.floor(22 + (1628 * factor));
    } else {
        temp = Math.floor(22 + (150 * (1 - scrollFraction)));
    }
    if (hudTemp) hudTemp.textContent = `${temp} °C`;
    if (thermalVal) thermalVal.textContent = `${temp} °C`;
    if (thermalFill) {
        const fillPct = Math.min(100, Math.max(5, (temp / 1650) * 100));
        thermalFill.style.width = `${fillPct.toFixed(0)}%`;
    }

    // G-Force
    let gforce = 1.0;
    if (scrollFraction > 0.2 && scrollFraction < 0.5) {
        const factor = Math.sin(((scrollFraction - 0.2) / 0.3) * Math.PI);
        gforce = (1.0 + (3.8 * factor)).toFixed(1);
    }
    if (hudGforce) hudGforce.textContent = `${gforce} G`;

    // Modulate Ambient Audio pitch/cutoff based on scroll height
    if (filterNode && isAudioPlaying) {
        const targetFreq = 120 + (scrollFraction * 450);
        filterNode.frequency.setTargetAtTime(targetFreq, audioCtx.currentTime, 0.1);
    }
}

// Scroll position handler using RequestAnimationFrame
function handleScroll() {
    const html = document.documentElement;
    const scrollTop = html.scrollTop || document.body.scrollTop;
    const maxScrollTop = html.scrollHeight - window.innerHeight;
    
    if (maxScrollTop <= 0) return;

    const scrollFraction = Math.max(0, Math.min(1, scrollTop / maxScrollTop));
    
    // Update top progress bar
    if (progressBar) {
        progressBar.style.width = `${(scrollFraction * 100).toFixed(1)}%`;
    }
    
    // Calculate 1-based frame index
    const frameIndex = Math.min(
        frameCount,
        Math.max(1, Math.floor(scrollFraction * frameCount) + 1)
    );
    
    updateImage(frameIndex);
    updateTelemetry(scrollFraction);
}

/* --------------------------------------------------------------------------
   Continuous Animation Loop for Parallax & Zero-G Float State
   -------------------------------------------------------------------------- */
function animateLoop() {
    ambientTime += 0.015;
    
    const html = document.documentElement;
    const scrollTop = html.scrollTop || document.body.scrollTop;
    
    // Factor is 1 at top (Stage 1), smoothly fades to 0 as user scrolls past 600px
    const scrollFactor = Math.max(0, 1 - (scrollTop / 600));
    
    if (scrollFactor > 0.01) {
        // Continuous organic floating sine wave (Zero-G pulse)
        const floatX = Math.sin(ambientTime * 0.7) * 12 * scrollFactor;
        const floatY = Math.cos(ambientTime * 0.5) * 10 * scrollFactor;
        const floatRotate = Math.sin(ambientTime * 0.4) * 0.6 * scrollFactor;
        
        // Mouse parallax offsets
        targetX = mouseX * 22 * scrollFactor;
        targetY = mouseY * 18 * scrollFactor;
        
        // Linear interpolation (Lerp) for silky smooth movement
        currentX += (targetX + floatX - currentX) * 0.08;
        currentY += (targetY + floatY - currentY) * 0.08;
        
        // Apply slight scale (1.04) so canvas edges stay offscreen during tilt
        const currentScale = 1 + (0.04 * scrollFactor);
        
        canvas.style.transform = `translate3d(${currentX.toFixed(2)}px, ${currentY.toFixed(2)}px, 0) scale(${currentScale.toFixed(3)}) rotate(${floatRotate.toFixed(2)}deg)`;
    } else {
        canvas.style.transform = 'translate3d(0px, 0px, 0) scale(1) rotate(0deg)';
    }
    
    requestAnimationFrame(animateLoop);
}

/* --------------------------------------------------------------------------
   Web Audio API Ambient Cosmic Synth Generator
   -------------------------------------------------------------------------- */
function toggleAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContext();
    }

    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }

    if (isAudioPlaying) {
        if (gainNode) {
            gainNode.gain.setTargetAtTime(0, audioCtx.currentTime, 0.2);
            setTimeout(() => {
                synthOsc.stop();
                synthOsc.disconnect();
                isAudioPlaying = false;
            }, 300);
        }
        if (audioIcon) audioIcon.className = "fa-solid fa-volume-xmark";
        if (audioText) audioText.textContent = "Audio: OFF";
        if (audioToggleBtn) audioToggleBtn.classList.remove("active");
    } else {
        synthOsc = audioCtx.createOscillator();
        filterNode = audioCtx.createBiquadFilter();
        gainNode = audioCtx.createGain();

        synthOsc.type = 'sawtooth';
        synthOsc.frequency.setValueAtTime(55, audioCtx.currentTime); // Low A bass synth

        filterNode.type = 'lowpass';
        filterNode.frequency.setValueAtTime(160, audioCtx.currentTime);

        gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gainNode.gain.setTargetAtTime(0.12, audioCtx.currentTime, 0.5);

        synthOsc.connect(filterNode);
        filterNode.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        synthOsc.start();
        isAudioPlaying = true;

        if (audioIcon) audioIcon.className = "fa-solid fa-volume-high";
        if (audioText) audioText.textContent = "Audio: ON";
        if (audioToggleBtn) audioToggleBtn.classList.add("active");
    }
}

if (audioToggleBtn) {
    audioToggleBtn.addEventListener('click', toggleAudio);
}

// HUD Toggle Handler
if (hudToggleBtn && telemetryHud) {
    hudToggleBtn.addEventListener('click', () => {
        telemetryHud.classList.toggle('hidden-hud');
        hudToggleBtn.classList.toggle('active');
    });
}

/* --------------------------------------------------------------------------
   Modal Window Handlers
   -------------------------------------------------------------------------- */
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
};

// Close modal when clicking dark backdrop overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});

// Ticket Form Handler
window.handleTicketSubmit = function(e) {
    e.preventDefault();
    const form = document.getElementById('ticket-form');
    const successBox = document.getElementById('ticket-success');
    if (form && successBox) {
        form.style.display = 'none';
        successBox.classList.remove('hidden');
    }
};

// FAQ Accordion Toggle
window.toggleFaq = function(buttonElem) {
    const faqItem = buttonElem.parentElement;
    faqItem.classList.toggle('open');
};

// Event Listeners
window.addEventListener('resize', resizeCanvas);
window.addEventListener('scroll', handleScroll, { passive: true });

// Initialize
resizeCanvas();
preloadImages();
requestAnimationFrame(animateLoop);
