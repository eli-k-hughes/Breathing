class BreathingExercise {
    constructor() {
        this.instruction = document.querySelector('.breathing-instruction');
        this.circleBackground = document.querySelector('.breathing-circle-background');
        this.dial = document.querySelector('.dial');
        this.timer = document.querySelector('.timer');
        this.progressRing = document.querySelector('.progress-ring');
        
        this.totalDuration = 240; // 4 minutes in seconds
        this.remainingTime = this.totalDuration;
        
        // Define variations
        this.variations = {
            light: {
                inhaleTime: 2,
                exhaleTime: 5,
                name: 'Breathe Light'
            },
            slow: {
                inhaleTime: 4,
                exhaleTime: 6,
                name: 'Breathe Slow'
            },
            deep: {
                inhaleTime: 6,
                exhaleTime: 6,
                name: 'Breathe Deep'
            },
            box: {
                inhaleTime: 4,
                inhaleHoldTime: 4,
                exhaleTime: 4,
                exhaleHoldTime: 4,
                name: 'Box Breathing',
                type: 'box'
            },
            relaxed: {
                inhaleTime: 4,
                inhaleHoldTime: 7,
                exhaleTime: 8,
                name: 'Deep & Relaxed',
                type: 'hold'
            },
            nadi: {
                inhaleTime: 4,
                exhaleTime: 4,
                name: 'Nadi Shodhana',
                type: 'nadi'
            }
        };
        
        // Get last used variation from localStorage, default to 'light' if none found
        const lastUsedVariation = localStorage.getItem('lastUsedVariation') || 'light';
        
        // Set initial variation to last used
        this.setVariation(lastUsedVariation);
        
        // Check the corresponding radio button
        const radioButton = document.querySelector(`input[name="variation"][value="${lastUsedVariation}"]`);
        if (radioButton) {
            radioButton.checked = true;
        }

        // Initialize text elements
        this.mainText = this.instruction.querySelector('tspan');
        this.nostrilText = this.instruction.querySelector('.nostril-text');
        
        // Always start with centered "begin"
        this.mainText.setAttribute('dy', '0');
        this.mainText.textContent = 'begin';
        this.nostrilText.textContent = '';
        this.nostrilText.setAttribute('dy', '24');

        // Store initial state for Nadi Shodhana
        this.isNadiStarted = false;
        
        // Listen for variation changes
        document.querySelectorAll('input[name="variation"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                const newVariation = e.target.value;
                this.setVariation(newVariation);
                // Save to localStorage when user changes variation
                localStorage.setItem('lastUsedVariation', newVariation);
                this.restart();
            });
        });
        
        this.isInhaling = true;
        this.startTime = null;
        this.animationFrame = null;
        
        this.isFinished = false;
        this.isPaused = true;  // Start paused
        
        // Add click handler for the central circle
        this.circleBackground.addEventListener('click', () => {
            if (this.isFinished) {
                this.restart();
            } else {
                this.togglePause();
            }
        });

        this.pausedProgress = 0;  // Add this to track progress when paused
        
        // Check if vibration is supported
        this.hasVibration = 'vibrate' in navigator;
        
        // Track last vibration time to avoid duplicates
        this.lastVibrationTime = 0;

        // Add currentVariation property
        this.currentVariation = 'light';

        this.lastTimerUpdate = null;

        // Sound and vibration controls
        this.vibrationEnabled = true;
        this.soundEnabled = false;
        
        // Create audio context and sounds
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.transitionSound = this.createTransitionSound();

        // Add control listeners
        document.getElementById('vibrationToggle').addEventListener('change', (e) => {
            this.vibrationEnabled = e.target.checked;
        });
        
        document.getElementById('soundToggle').addEventListener('change', (e) => {
            this.soundEnabled = e.target.checked;
            if (this.soundEnabled) {
                // Resume audio context on user interaction
                this.audioContext.resume();
            }
        });

        // Add drawer handling
        this.drawer = document.querySelector('.variation-selector');
        this.wasRunningBeforeDrawer = false;

        this.drawer.addEventListener('mouseenter', () => {
            if (!this.isPaused) {
                this.wasRunningBeforeDrawer = true;
                this.togglePause();
            }
        });

        this.drawer.addEventListener('mouseleave', () => {
            if (this.wasRunningBeforeDrawer) {
                this.togglePause();
                this.wasRunningBeforeDrawer = false;
            }
        });

        // For mobile
        this.drawer.addEventListener('touchstart', () => {
            if (!this.isPaused) {
                this.wasRunningBeforeDrawer = true;
                this.togglePause();
            }
        });

        this.drawer.addEventListener('touchend', (e) => {
            // Only resume if we're not touching a radio button
            if (e.target.type !== 'radio' && this.wasRunningBeforeDrawer) {
                this.togglePause();
                this.wasRunningBeforeDrawer = false;
            }
        });
    }

    setVariation(variationId) {
        this.currentVariation = variationId;
        const variation = this.variations[variationId];
        
        // Convert all times to seconds for consistent timing
        this.inhaleTime = variation.inhaleTime;
        this.exhaleTime = variation.exhaleTime;
        this.inhaleHoldTime = variation.inhaleHoldTime || 0;
        this.exhaleHoldTime = variation.exhaleHoldTime || 0;
        
        // Calculate total cycle time
        this.cycleTime = this.inhaleTime + this.exhaleTime + 
            (this.inhaleHoldTime || 0) + (this.exhaleHoldTime || 0);
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pausedProgress = performance.now() - this.startTime;
            cancelAnimationFrame(this.animationFrame);
            clearTimeout(this.timerTimeout);
        } else {
            if (this.startTime === null) {
                // First start of the exercise
                if (this.variations[this.currentVariation].type === 'nadi') {
                    // Set up initial state for Nadi Shodhana
                    this.mainText.setAttribute('dy', '-12');
                    this.nostrilText.setAttribute('dy', '24');
                    this.mainText.textContent = 'breathe in';
                    this.nostrilText.textContent = 'left nostril';
                } else {
                    this.mainText.setAttribute('dy', '0');
                    this.mainText.textContent = 'breathe in';
                    this.nostrilText.textContent = '';
                }
                this.signalTransition();
            }
            
            const pauseDuration = performance.now() - (this.startTime + this.pausedProgress);
            this.startTime = performance.now() - this.pausedProgress;
            
            // Ensure proper text positioning before starting animation
            if (this.variations[this.currentVariation].type === 'nadi') {
                this.mainText.setAttribute('dy', '-12');
                this.nostrilText.setAttribute('dy', '24');
            }
            
            this.animate(this.startTime);
            this.updateTimer();
        }
    }

    finish() {
        this.isFinished = true;
        cancelAnimationFrame(this.animationFrame);
        
        const fullCircle = this.describeArc(150, 150, 148, 0, 360);
        this.progressRing.setAttribute('d', fullCircle);
        this.progressRing.setAttribute('stroke', 'white');
        
        this.dial.style.display = 'none';
        const mainText = this.instruction.querySelector('tspan');
        const nostrilText = this.instruction.querySelector('.nostril-text');
        mainText.textContent = 'restart';
        nostrilText.textContent = '';
        this.circleBackground.classList.add('finished');
    }

    restart() {
        this.isFinished = false;
        this.isPaused = true;
        this.startTime = null;
        this.pausedProgress = 0;
        this.remainingTime = this.totalDuration;
        this.isInhaling = true;
        
        // Reset visual elements
        this.dial.style.display = '';
        this.progressRing.setAttribute('stroke', 'white');
        this.circleBackground.classList.remove('finished');
        
        this.lastTimerUpdate = null;
        
        // Reset text positions and content
        const mainText = this.instruction.querySelector('tspan');
        const nostrilText = this.instruction.querySelector('.nostril-text');
        
        // Reset Nadi state
        this.isNadiStarted = false;
        
        // Always center the "begin" text
        mainText.setAttribute('dy', '0');
        mainText.textContent = 'begin';
        nostrilText.textContent = '';
        
        this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
        
        this.start();
    }

    start() {
        // Reset text positions and content
        this.mainText.setAttribute('dy', '0');
        this.mainText.textContent = 'begin';
        this.nostrilText.textContent = '';
        this.nostrilText.setAttribute('dy', '24');
        
        // Reset Nadi state
        this.isNadiStarted = false;
        
        this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
        this.updateTimer();
    }

    animate(timestamp) {
        if (!this.startTime) {
            this.startTime = timestamp;
        }
        
        // Handle initial Nadi Shodhana state
        if (this.variations[this.currentVariation].type === 'nadi' && !this.isNadiStarted && !this.isPaused) {
            this.isNadiStarted = true;
            this.mainText.setAttribute('dy', '-12');
            this.nostrilText.setAttribute('dy', '24');
            this.mainText.textContent = 'breathe in';
            this.nostrilText.textContent = 'left nostril';
        }
        
        const progress = this.isPaused ? 
            this.pausedProgress / 1000 : 
            (timestamp - this.startTime) / 1000;
            
        const cycleProgress = progress % this.cycleTime;

        // Calculate the current angle (only for visual updates)
        const currentAngle = (360 * cycleProgress) / this.cycleTime;
        
        // Update visual elements
        this.updateProgressRing(currentAngle);
        this.updateDialPosition(currentAngle);

        // Make threshold even tighter for precise timing
        const threshold = 0.02; // 20ms threshold for more precise transitions

        // Handle state transitions and vibrations
        if (this.variations[this.currentVariation].type === 'box') {
            // Box breathing timing (working correctly)
            const inhaleEnd = this.inhaleTime;
            const inhaleHoldEnd = inhaleEnd + this.inhaleHoldTime;
            const exhaleEnd = inhaleHoldEnd + this.exhaleTime;
            
            if (Math.abs(cycleProgress - inhaleEnd) < threshold) {
                this.instruction.textContent = 'hold';
                this.signalTransition();
            } else if (Math.abs(cycleProgress - inhaleHoldEnd) < threshold) {
                this.instruction.textContent = 'breathe out';
                this.signalTransition();
            } else if (Math.abs(cycleProgress - exhaleEnd) < threshold) {
                this.instruction.textContent = 'hold';
                this.signalTransition();
            } else if (Math.abs(cycleProgress) < threshold || Math.abs(cycleProgress - this.cycleTime) < threshold) {
                this.instruction.textContent = 'breathe in';
                this.signalTransition();
            }
        } else if (this.variations[this.currentVariation].type === 'hold') {
            // Deep & Relaxed (4-7-8)
            const inhaleEnd = this.inhaleTime;
            const holdEnd = inhaleEnd + this.inhaleHoldTime;
            const cycleEnd = this.cycleTime;
            
            // Only trigger at exact end points
            if (cycleProgress >= inhaleEnd && cycleProgress < inhaleEnd + threshold) {
                this.instruction.textContent = 'hold';
                this.signalTransition();
            } else if (cycleProgress >= holdEnd && cycleProgress < holdEnd + threshold) {
                this.instruction.textContent = 'breathe out';
                this.signalTransition();
            } else if (cycleProgress >= cycleEnd - threshold || cycleProgress < threshold) {
                this.instruction.textContent = 'breathe in';
                this.signalTransition();
            }
        } else if (this.variations[this.currentVariation].type === 'nadi') {
            const cycleLength = this.inhaleTime + this.exhaleTime;
            const totalCycle = cycleLength * 2;
            const adjustedProgress = progress % totalCycle;
            
            // First half of cycle (Left inhale -> Right exhale)
            if (adjustedProgress < cycleLength) {
                if (adjustedProgress < this.inhaleTime) {
                    this.mainText.textContent = 'breathe in';
                    this.nostrilText.textContent = 'left nostril';
                    
                    if (Math.abs(adjustedProgress) < threshold) {
                        this.signalTransition();
                    }
                } else {
                    this.mainText.textContent = 'breathe out';
                    this.nostrilText.textContent = 'right nostril';
                    
                    if (Math.abs(adjustedProgress - this.inhaleTime) < threshold) {
                        this.signalTransition();
                    }
                }
            } 
            // Second half of cycle (Right inhale -> Left exhale)
            else {
                const secondHalfProgress = adjustedProgress - cycleLength;
                if (secondHalfProgress < this.inhaleTime) {
                    this.mainText.textContent = 'breathe in';
                    this.nostrilText.textContent = 'right nostril';
                    
                    if (Math.abs(secondHalfProgress) < threshold) {
                        this.signalTransition();
                    }
                } else {
                    this.mainText.textContent = 'breathe out';
                    this.nostrilText.textContent = 'left nostril';
                    
                    if (Math.abs(secondHalfProgress - this.inhaleTime) < threshold) {
                        this.signalTransition();
                    }
                }
            }
        } else {
            // Regular patterns (Light, Slow, Deep)
            const inhaleEnd = this.inhaleTime;
            const cycleEnd = this.cycleTime;
            
            // Only trigger at exact end points
            if (cycleProgress >= inhaleEnd && cycleProgress < inhaleEnd + threshold) {
                const mainText = this.instruction.querySelector('tspan');
                const nostrilText = this.instruction.querySelector('.nostril-text');
                mainText.textContent = 'breathe out';
                nostrilText.textContent = '';
                this.signalTransition();
            } else if (cycleProgress >= cycleEnd - threshold || cycleProgress < threshold) {
                const mainText = this.instruction.querySelector('tspan');
                const nostrilText = this.instruction.querySelector('.nostril-text');
                mainText.textContent = 'breathe in';
                nostrilText.textContent = '';
                this.signalTransition();
            }
        }

        // Update visual elements based on current phase
        this.updateVisuals(cycleProgress);

        if (this.remainingTime > 0 && !this.isPaused) {
            this.animationFrame = requestAnimationFrame(this.animate.bind(this));
        }
    }

    updateVisuals(cycleProgress) {
        if (this.variations[this.currentVariation].type === 'box') {
            // ... existing box breathing visual logic ...
        } else if (this.variations[this.currentVariation].type === 'hold') {
            if (cycleProgress < this.inhaleTime) {
                const scale = 1 + (cycleProgress / this.inhaleTime) * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
                this.circleBackground.setAttribute('fill', 'rgba(50, 50, 50, 0.9)');
            } else if (cycleProgress < this.inhaleTime + this.inhaleHoldTime) {
                this.circleBackground.setAttribute('transform', `scale(1.2)`);
            } else {
                const exhaleProgress = (cycleProgress - this.inhaleTime - this.inhaleHoldTime) / this.exhaleTime;
                const scale = 1.2 - exhaleProgress * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
                this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
            }
        } else if (this.variations[this.currentVariation].type === 'nadi') {
            const cycleLength = this.inhaleTime + this.exhaleTime;
            const totalCycle = cycleLength * 2;
            const adjustedProgress = cycleProgress % totalCycle;
            
            // Handle both halves of the cycle
            const currentHalfProgress = adjustedProgress < cycleLength ? 
                adjustedProgress : adjustedProgress - cycleLength;

            if (currentHalfProgress < this.inhaleTime) {
                const scale = 1 + (currentHalfProgress / this.inhaleTime) * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
                this.circleBackground.setAttribute('fill', 'rgba(50, 50, 50, 0.9)');
            } else {
                const exhaleProgress = (currentHalfProgress - this.inhaleTime) / this.exhaleTime;
                const scale = 1.2 - exhaleProgress * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
                this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
            }
        } else {
            if (cycleProgress < this.inhaleTime) {
                const scale = 1 + (cycleProgress / this.inhaleTime) * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
                this.circleBackground.setAttribute('fill', 'rgba(50, 50, 50, 0.9)');
            } else {
                const exhaleProgress = (cycleProgress - this.inhaleTime) / this.exhaleTime;
                const scale = 1.2 - exhaleProgress * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
                this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
            }
        }
    }

    updateTimer() {
        if (this.isPaused) return;
        
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        this.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (this.remainingTime > 0) {
            this.remainingTime--;
            this.timerTimeout = setTimeout(() => this.updateTimer(), 1000);
        } else {
            this.finish();
        }
    }

    // Fix the helper methods to be instance methods
    describeArc(x, y, radius, startAngle, endAngle) {
        const start = this.polarToCartesian(x, y, radius, endAngle);
        const end = this.polarToCartesian(x, y, radius, startAngle);
        const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
        return [
            "M", start.x, start.y, 
            "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y,
            "A", radius, radius, 0, largeArcFlag, 0, start.x, start.y
        ].join(" ");
    }

    polarToCartesian(centerX, centerY, radius, angleInDegrees) {
        const angleInRadians = (angleInDegrees-90) * Math.PI / 180.0;
        return {
            x: centerX + (radius * Math.cos(angleInRadians)),
            y: centerY + (radius * Math.sin(angleInRadians))
        };
    }

    // Add new method for vibration patterns
    vibrate(pattern) {
        if (this.hasVibration && this.vibrationEnabled && !this.isPaused) {
            if (typeof pattern === 'number') {
                pattern = [pattern];
            }
            // Strong vibration for transitions
            navigator.vibrate(pattern.map(duration => duration * 10));
        }
    }

    createTransitionSound() {
        // Create a short "pop" sound
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, 0);
        
        gainNode.gain.setValueAtTime(0, 0);
        
        oscillator.start();
        return { oscillator, gainNode };
    }

    playTransitionSound() {
        if (!this.soundEnabled) return;
        
        const time = this.audioContext.currentTime;
        this.transitionSound.gainNode.gain.cancelScheduledValues(time);
        this.transitionSound.gainNode.gain.setValueAtTime(0, time);
        this.transitionSound.gainNode.gain.linearRampToValueAtTime(0.3, time + 0.01);
        this.transitionSound.gainNode.gain.linearRampToValueAtTime(0, time + 0.1);
    }

    signalTransition() {
        if (this.isPaused) return;
        
        // Clear any pending vibrations
        navigator.vibrate(0);
        
        // Play both sound and vibration at the exact same time
        if (this.soundEnabled) {
            this.playTransitionSound();
        }
        if (this.vibrationEnabled && this.hasVibration) {
            // Use same timing as sound (100ms total duration)
            navigator.vibrate([100]);
        }
    }

    // New helper methods to separate visual updates
    updateProgressRing(currentAngle) {
        const radius = 148;
        const largeArcFlag = currentAngle > 180 ? 1 : 0;
        const angleInRadians = (currentAngle - 90) * (Math.PI / 180);
        const endX = 150 + radius * Math.cos(angleInRadians);
        const endY = 150 + radius * Math.sin(angleInRadians);
        const arcPath = `M 150 2 A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
        this.progressRing.setAttribute('d', arcPath);
    }

    updateDialPosition(currentAngle) {
        const radius = 148;
        const angleInRadians = (currentAngle - 90) * (Math.PI / 180);
        const endX = 150 + radius * Math.cos(angleInRadians);
        const endY = 150 + radius * Math.sin(angleInRadians);
        this.dial.setAttribute('cx', endX);
        this.dial.setAttribute('cy', endY);
    }
}

// Start the exercise when the page loads
window.addEventListener('load', () => {
    const exercise = new BreathingExercise();
    exercise.start();
}); 