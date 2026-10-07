(() => {
  function createStore(storageKey) {
    function normalizeName(value) {
      const name = String(value || "").trim().replace(/\s+/g, " ").slice(0, 16);
      return name || "PLAYER";
    }

    function rank(entries) {
      return entries.slice().sort((a, b) => (
        b.floor - a.floor ||
        b.level - a.level ||
        a.duration - b.duration ||
        b.createdAt - a.createdAt
      ));
    }

    function getEntries() {
      try {
        const parsed = JSON.parse(window.localStorage.getItem(storageKey) || "[]");
        if (!Array.isArray(parsed)) {
          return [];
        }

        return parsed
          .filter((entry) => entry && typeof entry.name === "string")
          .map((entry) => ({
            name: normalizeName(entry.name),
            floor: Number.isFinite(Number(entry.floor)) ? Number(entry.floor) : 0,
            level: Number.isFinite(Number(entry.level)) ? Number(entry.level) : 1,
            duration: Number.isFinite(Number(entry.duration)) ? Number(entry.duration) : 0,
            createdAt: Number.isFinite(Number(entry.createdAt)) ? Number(entry.createdAt) : 0
          }));
      } catch (error) {
        return [];
      }
    }

    function saveEntry(entry) {
      const ranked = rank([...getEntries(), entry]).slice(0, 10);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(ranked));
      } catch (error) {
        // localStorage may be disabled under some browser privacy settings.
      }
      return ranked;
    }

    return Object.freeze({
      normalizeName,
      rank,
      getEntries,
      saveEntry
    });
  }

  window.GogoLeaderboard = Object.freeze({ createStore });
})();
