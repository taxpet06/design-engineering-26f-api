(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SideQuest = Object.assign(root.SideQuest || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ENDPOINTS = {
    clubs: "/clubs",
    workshops: "/workshops",
    events: "/events",
    intramuralTeams: "/intramural-teams",
    studyGroups: "/study-groups",
  };

  async function fetchResource(path, fetchImpl) {
    const response = await fetchImpl(path, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`${path} returned ${response.status}`);
    const body = await response.json();
    return Array.isArray(body) ? body : body.data || [];
  }

  async function loadQuestResources(fetchImpl) {
    const request = fetchImpl || fetch;
    const entries = await Promise.all(Object.entries(ENDPOINTS).map(async ([key, path]) => {
      try {
        return [key, await fetchResource(path, request), null];
      } catch (error) {
        return [key, [], error];
      }
    }));
    return {
      data: Object.fromEntries(entries.map(([key, value]) => [key, value])),
      errors: entries.filter(([, , error]) => error).map(([key, , error]) => ({ key, message: error.message })),
    };
  }

  return { ENDPOINTS, fetchResource, loadQuestResources };
});
