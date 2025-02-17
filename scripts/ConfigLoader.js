class ConfigLoader {
    static async loadGameConfig() {
        try {
            const response = await fetch('config/gameConfig.json');
            if (!response.ok) {
                throw new Error('Failed to load game config.');
            }
            const gameConfig = await response.json();
            return gameConfig;
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    }

    static async loadBonusConfig() {
        try {
            const response = await fetch('config/bonusConfig.json');
            if (!response.ok) {
                throw new Error('Failed to load bonus config.');
            }
            const data = await response.json();
            if (!data.basic) {
                throw new Error('Invalid bonus config: missing "basic" property.');
            }
            const bonusConfig = data;
            // Setup bonus hierarchy sorted by order.
            const bonusHierarchy = Object.entries(bonusConfig.basic)
                .map(([key, conf]) => ({
                    key,
                    order: conf.order,
                    threshold: conf.threshold,
                    reward: conf.reward,
                    display: conf.display
                }))
                .sort((a, b) => a.order - b.order);
            // Reset associated bonus globals.
            let currentTierIndex = 0;
            const bonusCounters = {};
            const bonusActive = {};
            bonusHierarchy.forEach(item => {
                bonusCounters[item.key] = 0;
                bonusActive[item.key] = null;
            });
            return { bonusConfig, bonusHierarchy, currentTierIndex, bonusCounters, bonusActive };
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    }

    static async loadLevelConfig() {
        try {
            console.log("Loading level config:");
            const response = await fetch('config/levelConfig.json');
            if (!response.ok) {
                throw new Error('Failed to load level config.');
            }
            const data = await response.json();
            console.log("Loaded level config:", data);
            if (!data.levels || !Array.isArray(data.levels)) {
                throw new Error("Invalid level config: 'levels' property is missing or not an array.");
            }
            return data;
        } catch (e) {
            console.error(e);
            alert(e.message);
        }
    }
}
export default ConfigLoader;
