(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.SideQuest = Object.assign(root.SideQuest || {}, api);
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const INTERESTS = [
    { id: "academics", label: "Academics" },
    { id: "arts-culture", label: "Arts & Culture" },
    { id: "athletics", label: "Athletics & Intramurals" },
    { id: "clubs", label: "Clubs & Organizations" },
    { id: "outdoors", label: "Outdoors & Adventure" },
    { id: "social", label: "Social & Community" },
    { id: "volunteering", label: "Volunteering" },
    { id: "traditions", label: "Campus Traditions" },
    { id: "food", label: "Food & Dining" },
    { id: "personal", label: "Personal Challenges" },
  ];

  const CURATED_TASKS = [
    {
      id: "dartmouth:hood-slow-look",
      title: "Pick one work at the Hood and look for five full minutes",
      description: "Admission is free. Leave with one detail you would not have noticed at a glance.",
      category: "Arts & Culture",
      tags: ["arts-culture", "personal"],
      source: { type: "dartmouth", label: "Dartmouth", url: "https://hoodmuseum.dartmouth.edu/visit/plan-your-visit" },
      effort: "30–60 min",
    },
    {
      id: "dartmouth:green-pause",
      title: "Spend ten phone-free minutes on the Green",
      description: "Sit, walk, or people-watch at the center of campus without turning it into another errand.",
      category: "Social & Community",
      tags: ["social", "personal", "outdoors"],
      source: { type: "dartmouth", label: "Dartmouth", url: "https://admissions.dartmouth.edu/dartmouth-values/campus" },
      effort: "10 min",
    },
    {
      id: "dartmouth:appalachian-trail",
      title: "Walk a stretch of the Appalachian Trail through Hanover",
      description: "The trail passes through downtown. Pick a comfortable stretch and bring a friend.",
      category: "Outdoors & Adventure",
      tags: ["outdoors", "social"],
      source: { type: "dartmouth", label: "Dartmouth", url: "https://admissions.dartmouth.edu/dartmouth-values/history-traditions" },
      effort: "1–2 hr",
    },
    {
      id: "dartmouth:winter-carnival",
      title: "Try one Winter Carnival event you have never done",
      description: "Check the official program when carnival season arrives and choose one unfamiliar event.",
      category: "Campus Traditions",
      tags: ["traditions", "social", "outdoors"],
      source: { type: "dartmouth", label: "Dartmouth", url: "https://home.dartmouth.edu/about/winter-carnival" },
      effort: "Seasonal",
    },
    {
      id: "dartmouth:hop-performance",
      title: "See a performance at the Hop outside your usual genre",
      description: "Browse the official calendar and pick something you would not normally choose.",
      category: "Arts & Culture",
      tags: ["arts-culture", "personal"],
      source: { type: "dartmouth", label: "Dartmouth", url: "https://hop.dartmouth.edu/events/listing" },
      effort: "One evening",
    },
    {
      id: "curated:meal-new-person",
      title: "Invite someone you only sort of know to share a meal",
      description: "A classmate, hallmate, or teammate counts. Make the invitation specific.",
      category: "Social & Community",
      tags: ["social", "food", "personal"],
      source: { type: "curated", label: "Side Quest" },
      effort: "1 hr",
    },
    {
      id: "curated:office-hours-curiosity",
      title: "Go to office hours with a curiosity, not a crisis",
      description: "Ask about an idea from class that you genuinely want to understand better.",
      category: "Academics",
      tags: ["academics", "personal"],
      source: { type: "curated", label: "Side Quest" },
      effort: "30 min",
    },
    {
      id: "curated:volunteer-hour",
      title: "Give one hour to a local cause",
      description: "Find a legitimate community organization and ask what help is actually useful.",
      category: "Volunteering",
      tags: ["volunteering", "social"],
      source: { type: "curated", label: "Side Quest" },
      effort: "1–2 hr",
    },
    {
      id: "curated:friend-hobby",
      title: "Let a friend teach you their oddly specific hobby",
      description: "Give them one uninterrupted hour to show you why they care about it.",
      category: "Personal Challenge",
      tags: ["personal", "social"],
      source: { type: "curated", label: "Side Quest" },
      effort: "1 hr",
    },
    {
      id: "curated:campus-sunrise",
      title: "Watch one campus sunrise from start to finish",
      description: "Choose a safe spot, check the weather, and bring something warm.",
      category: "Outdoors & Adventure",
      tags: ["outdoors", "personal"],
      source: { type: "curated", label: "Side Quest" },
      effort: "45 min",
    },
    {
      id: "curated:no-phone-walk",
      title: "Take a twenty-minute walk without headphones or your phone",
      description: "Notice three places you usually pass without seeing.",
      category: "Personal Challenge",
      tags: ["personal", "outdoors"],
      source: { type: "curated", label: "Side Quest" },
      effort: "20 min",
    },
    {
      id: "curated:dining-switch",
      title: "Order something you have never tried at a familiar dining spot",
      category: "Food & Dining",
      tags: ["food", "personal"],
      source: { type: "curated", label: "Side Quest" },
      effort: "One meal",
    },
    {
      id: "curated:club-guest",
      title: "Attend one open club meeting where you know nobody",
      description: "Confirm that visitors are welcome, then stay long enough to learn what the group actually does.",
      category: "Clubs & Organizations",
      tags: ["clubs", "social", "personal"],
      source: { type: "curated", label: "Side Quest" },
      effort: "1 hr",
    },
  ];

  const CATEGORY_TAGS = {
    Academic: ["academics", "clubs"],
    Arts: ["arts-culture", "clubs"],
    Cultural: ["arts-culture", "social"],
    Creative: ["arts-culture", "personal"],
    Recreation: ["outdoors", "athletics", "clubs"],
    Service: ["volunteering", "clubs", "social"],
    Social: ["social"],
    Speaker: ["academics", "social"],
    Career: ["academics", "personal"],
    Leadership: ["personal", "clubs"],
    Technical: ["academics", "personal"],
    Wellness: ["personal"],
  };

  function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function uniqueById(tasks) {
    const seen = new Set();
    return tasks.filter((task) => task && task.id && task.title && !seen.has(task.id) && seen.add(task.id));
  }

  function prototypeSource(resource, id) {
    return { type: "prototype", label: "Prototype", resource, recordId: id };
  }

  function normalizeClub(item) {
    if (!item || item.id == null || !cleanText(item.name)) return null;
    const category = cleanText(item.category) || "Clubs & Organizations";
    const schedule = item.meeting_day && item.meeting_time ? `Sample schedule: ${item.meeting_day}, ${item.meeting_time}. Confirm details before going.` : "Confirm that visitors are welcome before going.";
    return {
      id: `prototype:club:${item.id}`,
      title: `Drop into a ${cleanText(item.name)} meeting`,
      description: schedule,
      category: "Clubs & Organizations",
      tags: CATEGORY_TAGS[category] || ["clubs", "social"],
      source: prototypeSource("clubs", item.id),
      effort: "One meeting",
    };
  }

  function normalizeWorkshop(item, now) {
    if (!item || item.id == null || !cleanText(item.title)) return null;
    if (item.date && new Date(`${item.date}T23:59:59`).getTime() < now.getTime()) return null;
    const place = cleanText(item.location);
    const when = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "an upcoming date";
    return {
      id: `prototype:workshop:${item.id}`,
      title: `Try the “${cleanText(item.title)}” workshop`,
      description: `${when}${place ? ` · ${place}` : ""}. Check current details before attending.`,
      category: cleanText(item.category) === "Creative" ? "Arts & Culture" : "Personal Challenge",
      tags: CATEGORY_TAGS[cleanText(item.category)] || ["personal", "academics"],
      source: prototypeSource("workshops", item.id),
      effort: "One session",
    };
  }

  function normalizeEvent(item, now) {
    if (!item || item.id == null || !cleanText(item.title)) return null;
    if (item.date && new Date(`${item.date}T23:59:59`).getTime() < now.getTime()) return null;
    const place = cleanText(item.location);
    const when = item.date ? new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Coming up";
    return {
      id: `prototype:event:${item.id}`,
      title: `Show up for ${cleanText(item.title)}`,
      description: `${when}${place ? ` · ${place}` : ""}. Verify the event before making plans.`,
      category: cleanText(item.category) === "Cultural" ? "Arts & Culture" : "Social & Community",
      tags: CATEGORY_TAGS[cleanText(item.category)] || ["social"],
      source: prototypeSource("events", item.id),
      effort: "One event",
    };
  }

  function normalizeTeam(item) {
    if (!item || item.id == null || !cleanText(item.name) || !cleanText(item.sport)) return null;
    return {
      id: `prototype:intramural:${item.id}`,
      title: `Ask to try a ${cleanText(item.sport)} practice with ${cleanText(item.name)}`,
      description: "Use the sample listing as inspiration and confirm whether the team and an open practice exist.",
      category: "Athletics & Intramurals",
      tags: ["athletics", "social"],
      source: prototypeSource("intramural-teams", item.id),
      effort: "One practice",
    };
  }

  function normalizeStudyGroup(item) {
    if (!item || item.id == null || !cleanText(item.name)) return null;
    return {
      id: `prototype:study-group:${item.id}`,
      title: `Try a session with ${cleanText(item.name)}`,
      description: `${cleanText(item.meeting_location) || "Sample campus study group"}. Confirm the group is active before attending.`,
      category: "Academics",
      tags: ["academics", "social"],
      source: prototypeSource("study-groups", item.id),
      effort: "One session",
    };
  }

  function normalizeResources(resources, options) {
    const data = resources || {};
    const now = (options && options.now) || new Date();
    return uniqueById([
      ...(data.clubs || []).map(normalizeClub),
      ...(data.workshops || []).map((item) => normalizeWorkshop(item, now)),
      ...(data.events || []).map((item) => normalizeEvent(item, now)),
      ...(data.intramuralTeams || []).map(normalizeTeam),
      ...(data.studyGroups || []).map(normalizeStudyGroup),
    ]);
  }

  return { INTERESTS, CURATED_TASKS, normalizeResources, uniqueById };
});
