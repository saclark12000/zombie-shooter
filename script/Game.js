class Game {
    // ...existing constructor and methods...

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        // Update only the mouse position
        this.mousePos = { x, y };
    }
    
    update() {
        // NEW: Move player towards mouse position at a constant rate.
        const speed = 5; // constant pixels per frame
        const dx = this.mousePos.x - this.player.x;
        const dy = this.mousePos.y - this.player.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 1) {
            this.player.x += (dx / distance) * speed;
            this.player.y += (dy / distance) * speed;
        }
        
        // ...existing update logic (zombie movement, collisions, etc.)...
    }

    // ...remaining methods...
}
export default Game;
