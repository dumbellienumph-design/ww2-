import * as THREE from 'three';

export class AudioManager {
    constructor(camera) {
        this.listener = new THREE.AudioListener();
        camera.add(this.listener);

        this.sounds = new Map();
        this.loader = new THREE.AudioLoader();
        this.globalVolume = 1.0;
        this.isAudioContextStarted = false;
        
        this.onProgress = null;
    }

    async loadSound(name, url, isPositional = false, loop = false, volume = 1.0) {
        return new Promise((resolve) => {
            this.loader.load(url, (buffer) => {
                const audio = isPositional ? new THREE.PositionalAudio(this.listener) : new THREE.Audio(this.listener);
                audio.setBuffer(buffer);
                audio.setLoop(loop);
                audio.setVolume(volume * this.globalVolume);
                
                if (isPositional) {
                    audio.setRefDistance(5);
                    audio.setMaxDistance(100);
                    audio.setRolloffFactor(1);
                }

                this.sounds.set(name, audio);
                resolve(audio);
            }, (xhr) => {
                if (this.onProgress) {
                    this.onProgress(name, xhr.loaded / xhr.total);
                }
            }, (error) => {
                console.warn(`Failed to load sound: ${name} from ${url}. Skipping...`, error);
                resolve(null); // Resolve anyway to prevent blocking the loading bar
            });
        });
    }

    startAudioContext() {
        if (this.isAudioContextStarted) return;
        const context = THREE.AudioContext.getContext();
        if (context.state === 'suspended') { context.resume(); }
        this.isAudioContextStarted = true;
    }

    fadeSound(name, targetVolume, duration = 1.0) {
        const sound = this.sounds.get(name);
        if (!sound) return;

        const startVolume = sound.getVolume();
        const startTime = performance.now();

        const animateFade = () => {
            const now = performance.now();
            const elapsed = (now - startTime) / (duration * 1000);

            if (elapsed < 1) {
                const currentVolume = startVolume + (targetVolume * this.globalVolume - startVolume) * elapsed;
                sound.setVolume(currentVolume);
                requestAnimationFrame(animateFade);
            } else {
                sound.setVolume(targetVolume * this.globalVolume);
                if (targetVolume === 0) sound.stop();
            }
        };

        if (targetVolume > 0 && !sound.isPlaying) {
            sound.setVolume(0);
            sound.play();
        }
        
        animateFade();
    }

    play(name, options = {}) {
        const sound = this.sounds.get(name);
        if (sound) {
            if (options.randomPitch) {
                sound.setPlaybackRate(0.9 + Math.random() * 0.2);
            }
            if (sound.isPlaying) sound.stop();
            sound.play();
        }
    }

    stop(name) {
        const sound = this.sounds.get(name);
        if (sound && sound.isPlaying) {
            sound.stop();
        }
    }

    setPlaybackRate(name, rate) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.setPlaybackRate(rate);
        }
    }

    updateAltitudeEffects(y) {
        const lowPass = this.listener.context.createBiquadFilter();
        lowPass.type = 'lowpass';
        const cutoff = THREE.MathUtils.mapLinear(THREE.MathUtils.clamp(y, 0, 100), 0, 100, 20000, 5000);
        lowPass.frequency.setValueAtTime(cutoff, this.listener.context.currentTime);
    }

    setVolume(name, volume) {
        const sound = this.sounds.get(name);
        if (sound) {
            sound.setVolume(volume * this.globalVolume);
        }
    }

    createPositionalSource(name, mesh) {
        const sound = this.sounds.get(name);
        if (sound && sound instanceof THREE.PositionalAudio) {
            mesh.add(sound);
            return sound;
        }
        return null;
    }
}