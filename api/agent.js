module.exports = (req, res) => {
    const agents = [
        { name: 'لايان', letter: 'ل', emoji: '💜' },
        { name: 'نوران', letter: 'ن', emoji: '🌸' },
        { name: 'نور', letter: 'ن', emoji: '✨' },
    ];
    const index = Math.floor(Date.now() / (2 * 60 * 60 * 1000)) % agents.length;
    res.json(agents[index]);
};
