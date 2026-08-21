const MAPS = {
    'map1': window.map1,
    'map2': window.map2
};

function getMapConfig(mapId) {
    return MAPS[mapId] || MAPS['map1'];
}
window.getMapConfig = getMapConfig; // 전역 등록