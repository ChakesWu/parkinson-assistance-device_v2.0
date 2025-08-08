/**
 * Background Gradient Animation Component
 * 為3D手部項目提供動態漸層背景效果
 */

class BackgroundGradientAnimation {
    constructor(options = {}) {
        this.options = {
            gradientBackgroundStart: options.gradientBackgroundStart || "rgb(108, 0, 162)",
            gradientBackgroundEnd: options.gradientBackgroundEnd || "rgb(0, 17, 82)",
            firstColor: options.firstColor || "18, 113, 255",
            secondColor: options.secondColor || "221, 74, 255",
            thirdColor: options.thirdColor || "100, 220, 255",
            fourthColor: options.fourthColor || "200, 50, 50",
            fifthColor: options.fifthColor || "180, 180, 50",
            pointerColor: options.pointerColor || "140, 100, 255",
            size: options.size || "80%",
            blendingValue: options.blendingValue || "hard-light",
            interactive: options.interactive !== false
        };

        this.container = null;
        this.interactiveRef = null;
        this.curX = 0;
        this.curY = 0;
        this.tgX = 0;
        this.tgY = 0;

        this.init();
    }

    init() {
        this.createContainer();
        this.setupEventListeners();
        this.startAnimation();
    }

    createContainer() {
        this.container = document.createElement('div');
        this.container.className = 'background-gradient-container';
        this.container.innerHTML = `
            <div class="gradients-container">
                <div class="gradient-1"></div>
                <div class="gradient-2"></div>
                <div class="gradient-3"></div>
                <div class="gradient-4"></div>
                <div class="gradient-5"></div>
                <div class="interactive-gradient"></div>
            </div>
        `;
        document.body.insertBefore(this.container, document.body.firstChild);
    }

    setupEventListeners() {
        if (this.options.interactive) {
            const interactiveGradient = this.container.querySelector('.interactive-gradient');
            document.addEventListener('mousemove', (e) => {
                this.tgX = e.clientX;
                this.tgY = e.clientY;
            });
        }
    }

    startAnimation() {
        const animate = () => {
            this.curX += (this.tgX - this.curX) / 20;
            this.curY += (this.tgY - this.curY) / 20;

            const interactiveGradient = this.container.querySelector('.interactive-gradient');
            if (interactiveGradient) {
                interactiveGradient.style.transform = `translate(${Math.round(this.curX)}px, ${Math.round(this.curY)}px)`;
            }

            requestAnimationFrame(animate);
        };
        animate();
    }

    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// 初始化背景動畫
document.addEventListener('DOMContentLoaded', () => {
    new BackgroundGradientAnimation();
});