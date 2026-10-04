import type { JournalEntry } from "./types";

export const demoEntries: JournalEntry[] = [
  {
    id: "2026-10-04",
    date: "2026-10-04",
    displayDate: "Sunday, 4 October",
    mood: { score: 4, label: "good", color: "#c9df9f" },
    moodArc: [
      { phase: "Morning", label: "slow", emoji: "😴" },
      { phase: "Afternoon", label: "focused", emoji: "🙂" },
      { phase: "Evening", label: "lighter", emoji: "😌" },
    ],
    people: ["Rahul", "Mom"],
    food: ["Poha", "Coffee", "Dal rice"],
    places: ["Home", "Lake road"],
    healthMentions: ["Mild headache"],
    highlights: ["Finished the demo flow", "Evening walk by the lake"],
    difficultMoments: ["The morning meeting felt tense"],
    thingsToRemember: ["Rahul's interview is on Tuesday"],
    summary:
      "The day began slowly after a tense meeting, then settled into a focused afternoon. Finishing the demo felt satisfying, and an evening walk made everything feel lighter.",
    transcript:
      "Haan, the morning meeting was a lot. I had poha and coffee, then worked on the demo with Rahul. By evening I went for a walk near the lake and felt much better.",
  },
  {
    id: "2026-10-02",
    date: "2026-10-02",
    displayDate: "Friday, 2 October",
    mood: { score: 3, label: "mixed", color: "#f1d58a" },
    moodArc: [
      { phase: "Morning", label: "hopeful", emoji: "🙂" },
      { phase: "Afternoon", label: "overwhelmed", emoji: "😣" },
      { phase: "Night", label: "calm", emoji: "😌" },
    ],
    people: ["Aditi"],
    food: ["Idli", "Tea"],
    places: ["Studio"],
    healthMentions: [],
    highlights: ["The first voice test finally worked"],
    difficultMoments: ["Too many ideas competing for attention"],
    thingsToRemember: ["Keep the demo small and human"],
    summary:
      "A mixed day: the project briefly felt too big, but the first working voice test brought the idea back into focus.",
  },
  {
    id: "2026-09-28",
    date: "2026-09-28",
    displayDate: "Monday, 28 September",
    mood: { score: 5, label: "bright", color: "#87c7a4" },
    moodArc: [
      { phase: "Morning", label: "energised", emoji: "😊" },
      { phase: "Evening", label: "grateful", emoji: "🥰" },
    ],
    people: ["Mom", "Aditi"],
    food: ["Aloo paratha"],
    places: ["Home"],
    healthMentions: [],
    highlights: ["A long, easy family dinner", "Shared the first VENT sketch"],
    difficultMoments: [],
    thingsToRemember: ["Mom liked the quiet call screen"],
    summary:
      "A warm day at home. Sharing the first VENT sketch made the idea feel real, especially when the quiet call screen immediately clicked.",
  },
];

export const calendarDays = Array.from({ length: 35 }, (_, index) => {
  const previousMonthDays = index < 3;
  const day = previousMonthDays ? 28 + index : index - 2;
  return { day, currentMonth: !previousMonthDays && day <= 31 };
});

export const suggestedQuestions = [
  "When did I last mention Rahul?",
  "What made me feel better this week?",
  "How have my evenings felt lately?",
];
