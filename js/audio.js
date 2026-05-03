export class GameAudio {
    constructor() {
        this.ctx = null;
        this.enabled = false;
    }

    _init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.enabled = true;
        } catch (e) {
            console.warn('Web Audio API not available');
        }
    }

    startAmbient() {
        this._init();
        if (!this.enabled) return;
        this._scheduleArtillery();
    }

    destroy() {
        this.enabled = false;
        if (this._artilleryTimer) clearTimeout(this._artilleryTimer);
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
    }

    _scheduleArtillery() {
        if (!this.enabled) return;
        const delay = (10 + Math.random() * 20) * 1000;
        this._artilleryTimer = setTimeout(() => { 
            if (this.enabled) {
                this._playRumble(); 
                this._scheduleArtillery(); 
            }
        }, delay);
    }

    _playRumble() {
        const duration = 1.5 + Math.random() * 2;
        const bufLen = Math.floor(this.ctx.sampleRate * duration);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.8;
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 100;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + 0.4);
        gain.gain.linearRampToValueAtTime(0.18, this.ctx.currentTime + duration - 0.4);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration);
        src.connect(lp); lp.connect(gain); gain.connect(this.ctx.destination);
        src.start();
    }

    playGunshot() {
        this._init();
        if (!this.enabled) return;
        const bufLen = Math.floor(this.ctx.sampleRate * 0.14);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3.5);
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(2.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.14);
        src.connect(gain); gain.connect(this.ctx.destination);
        src.start();
    }

    playFootstep() {
        this._init();
        if (!this.enabled) return;
        const bufLen = Math.floor(this.ctx.sampleRate * 0.055);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3) * 0.35;
        }
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 350 + Math.random() * 150;
        const gain = this.ctx.createGain(); gain.gain.value = 0.45;
        src.connect(lp); lp.connect(gain); gain.connect(this.ctx.destination);
        src.start();
    }

    playChickenSquawk() {
        this._init();
        if (!this.enabled) return;
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800 + Math.random() * 400, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.connect(gain); gain.connect(this.ctx.destination);
        osc.start(); osc.stop(now + 0.15);
    }

    playExplosionBlast() {
        this._init();
        if (!this.enabled) return;
        const bufLen = Math.floor(this.ctx.sampleRate * 1.5);
        const buf = this.ctx.createBuffer(1, bufLen, this.ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 2);
        const src = this.ctx.createBufferSource();
        src.buffer = buf;
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 150;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(1.5, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 1.5);
        src.connect(lp); lp.connect(gain); gain.connect(this.ctx.destination);
        src.start();
    }

    play(name) {
        if (name === 'explosion_blast') this.playExplosionBlast();
        if (name === 'chicken_squawk') this.playChickenSquawk();
        if (name === 'tank_fire') this.playGunshot(); // Reuse gunshot for now
    }
}
