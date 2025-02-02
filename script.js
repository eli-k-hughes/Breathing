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
            }
        };
        
        // Set initial variation
        this.setVariation('light');
        
        // Listen for variation changes
        document.querySelectorAll('input[name="variation"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.setVariation(e.target.value);
                this.restart();
            });
        });
        
        this.isInhaling = true;
        this.startTime = null;
        this.animationFrame = null;
        
        this.isFinished = false;
        this.isPaused = false;
        
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
    }

    setVariation(variationId) {
        this.currentVariation = variationId;
        const variation = this.variations[variationId];
        this.inhaleTime = variation.inhaleTime;
        this.exhaleTime = variation.exhaleTime;
        this.inhaleHoldTime = variation.inhaleHoldTime || 0;
        this.exhaleHoldTime = variation.exhaleHoldTime || 0;
        this.cycleTime = this.inhaleTime + this.exhaleTime + 
            (this.inhaleHoldTime || 0) + (this.exhaleHoldTime || 0);
    }
    
    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pausedProgress = performance.now() - this.startTime;
            cancelAnimationFrame(this.animationFrame);
            this.lastTimerUpdate = performance.now();
        } else {
            this.startTime = performance.now() - this.pausedProgress;
            if (this.lastTimerUpdate) {
                const pauseDuration = Math.floor((performance.now() - this.lastTimerUpdate) / 1000);
                this.remainingTime += pauseDuration;
            }
            this.animate();
        }
    }

    finish() {
        this.isFinished = true;
        cancelAnimationFrame(this.animationFrame);
        
        // Fix the helper function calls
        const fullCircle = this.describeArc(150, 150, 148, 0, 360);
        this.progressRing.setAttribute('d', fullCircle);
        this.progressRing.setAttribute('stroke', 'white');
        
        this.dial.style.display = 'none';
        this.instruction.textContent = 'restart';
        this.circleBackground.classList.add('finished');
    }

    restart() {
        this.isFinished = false;
        this.isPaused = false;
        this.startTime = null;
        this.pausedProgress = 0;  // Reset paused progress
        this.remainingTime = this.totalDuration;
        this.isInhaling = true;
        
        // Reset visual elements
        this.dial.style.display = '';
        this.progressRing.setAttribute('stroke', 'white');
        this.circleBackground.classList.remove('finished');
        
        this.lastTimerUpdate = null;
        this.start();
    }

    start() {
        this.animate();
        this.updateTimer();
    }

    animate(timestamp) {
        if (!this.startTime) this.startTime = timestamp;
        
        // Calculate progress based on actual time or paused progress
        const progress = this.isPaused ? 
            this.pausedProgress / 1000 : 
            (timestamp - this.startTime) / 1000;
            
        const cycleProgress = progress % this.cycleTime;

        // Calculate the current angle
        const currentAngle = (360 * cycleProgress) / this.cycleTime;
        
        // Calculate the SVG arc path
        const radius = 148;
        const angleInRadians = (currentAngle - 90) * (Math.PI / 180);
        
        // Calculate end point
        const endX = 150 + radius * Math.cos(angleInRadians);
        const endY = 150 + radius * Math.sin(angleInRadians);
        
        // Create arc path
        const largeArcFlag = currentAngle > 180 ? 1 : 0;
        const arcPath = `M 150 2 A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY}`;
        
        // Update progress ring
        this.progressRing.setAttribute('d', arcPath);

        // Update dial position
        this.dial.setAttribute('cx', endX);
        this.dial.setAttribute('cy', endY);

        // Add second-by-second light vibration
        const currentSecond = Math.floor(progress);
        if (currentSecond > this.lastVibrationTime) {
            this.lastVibrationTime = currentSecond;
            this.vibrate(10); // Light 10ms vibration each second
        }

        // Handle different breathing patterns
        if (this.variations[this.currentVariation].type === 'box') {
            if (cycleProgress < this.inhaleTime) {
                if (!this.isInhaling) {
                    this.isInhaling = true;
                    this.instruction.textContent = 'breathe in';
                    this.circleBackground.setAttribute('fill', 'rgba(50, 50, 50, 0.9)');
                    this.vibrate([0, 100]);
                }
                const scale = 1 + (cycleProgress / this.inhaleTime) * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
            } else if (cycleProgress < this.inhaleTime + this.inhaleHoldTime) {
                if (this.instruction.textContent !== 'hold') {
                    this.instruction.textContent = 'hold';
                    this.vibrate([0, 50, 50, 50]);
                }
                this.circleBackground.setAttribute('transform', `scale(1.2)`);
            } else if (cycleProgress < this.inhaleTime + this.inhaleHoldTime + this.exhaleTime) {
                this.instruction.textContent = 'breathe out';
                if (this.isInhaling) {
                    this.isInhaling = false;
                    this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
                    this.vibrate([0, 100]); // Stronger vibration at transition
                }
                const exhaleProgress = (cycleProgress - this.inhaleTime - this.inhaleHoldTime) / this.exhaleTime;
                const scale = 1.2 - exhaleProgress * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
            } else {
                this.instruction.textContent = 'hold';
                this.circleBackground.setAttribute('transform', `scale(1.0)`);
                if (this.instruction.textContent !== 'hold') {
                    this.instruction.textContent = 'hold';
                    this.vibrate([0, 50, 50, 50]); // Double pulse for hold
                }
            }
        } else if (this.variations[this.currentVariation].type === 'hold') {
            if (cycleProgress < this.inhaleTime) {
                this.instruction.textContent = 'breathe in';
                if (!this.isInhaling) {
                    this.isInhaling = true;
                    this.circleBackground.setAttribute('fill', 'rgba(50, 50, 50, 0.9)');
                    this.vibrate([0, 100]);
                }
                const scale = 1 + (cycleProgress / this.inhaleTime) * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
            } else if (cycleProgress < this.inhaleTime + this.inhaleHoldTime) {
                this.instruction.textContent = 'hold';
                this.circleBackground.setAttribute('transform', `scale(1.2)`);
                if (this.instruction.textContent !== 'hold') {
                    this.instruction.textContent = 'hold';
                    this.vibrate([0, 50, 50, 50]);
                }
            } else {
                this.instruction.textContent = 'breathe out';
                if (this.isInhaling) {
                    this.isInhaling = false;
                    this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
                    this.vibrate([0, 100]);
                }
                const exhaleProgress = (cycleProgress - this.inhaleTime - this.inhaleHoldTime) / this.exhaleTime;
                const scale = 1.2 - exhaleProgress * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
            }
        } else {
            if (cycleProgress < this.inhaleTime) {
                if (!this.isInhaling) {
                    this.isInhaling = true;
                    this.instruction.textContent = 'breathe in';
                    this.circleBackground.setAttribute('fill', 'rgba(50, 50, 50, 0.9)');
                    this.vibrate([0, 100]); // Stronger vibration at transition
                }
                const scale = 1 + (cycleProgress / this.inhaleTime) * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
            } else {
                if (this.isInhaling) {
                    this.isInhaling = false;
                    this.instruction.textContent = 'breathe out';
                    this.circleBackground.setAttribute('fill', 'rgba(30, 30, 30, 0.9)');
                    this.vibrate([0, 100]); // Stronger vibration at transition
                }
                const exhaleProgress = (cycleProgress - this.inhaleTime) / this.exhaleTime;
                const scale = 1.2 - exhaleProgress * 0.2;
                this.circleBackground.setAttribute('transform', `scale(${scale})`);
            }
        }

        if (this.remainingTime > 0) {
            this.animationFrame = requestAnimationFrame(this.animate.bind(this));
        }
    }

    updateTimer() {
        if (this.isPaused) {
            return;
        }

        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = this.remainingTime % 60;
        this.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        
        if (this.remainingTime > 0) {
            this.remainingTime--;
            requestAnimationFrame(() => {
                if (!this.isPaused) {
                    setTimeout(() => this.updateTimer(), 1000);
                }
            });
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
        if (this.hasVibration && !this.isPaused) {
            navigator.vibrate(pattern);
        }
    }
}

// Start the exercise when the page loads
window.addEventListener('load', () => {
    const exercise = new BreathingExercise();
    exercise.start();
}); 