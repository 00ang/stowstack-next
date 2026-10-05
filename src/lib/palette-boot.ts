/**
 * Runs in <head> before paint so a stored theme does not flash the default.
 * Keep the id list in sync with normalizePaletteId in components/mono.
 */
export const PALETTE_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem("storageads.palette");if(p==="bw")p="white";if(p==="dark")p="black";if(p==="cool"||p==="black"||p==="white"){document.documentElement.setAttribute("data-palette",p);}}catch(e){}})();`;
