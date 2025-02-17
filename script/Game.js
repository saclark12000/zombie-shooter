class Game {
    constructor(canvas, ctx) {
        this.canvas = canvas;
        this.ctx = ctx;
        // ...existing variables...
        this.player = { x: canvas.width / 2, y: canvas.height / 2, radius: 20, life: 3, bullets: 10, emoji: null };
        // NEW: Dynamic player move speed (adjustable externally)
        this.playerMoveSpeed = 5; 
        // ...existing code...
        // Use only Game's own mouse event listeners.
        this.mousePos = { x: canvas.width / 2, y: canvas.height / 2 };
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Only update mouse position; do not modify player position directly.
        this.mousePos = { x, y };
    }
    
    update() {
        // NEW: Gradually move player toward mouse cursor using dynamic speed.
        const speed = this.playerMoveSpeed; 
        const dx = this.mousePos.x - this.player.x;
        const dy = this.mousePos.y - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 1) {
            this.player.x += (dx / distance) * speed;
            this.player.y += (dy / distance) * speed;
        }
        // ...existing update logic...
    }

    // ...remaining methods...
}
export default Game;
