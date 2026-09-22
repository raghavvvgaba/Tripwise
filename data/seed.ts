import type { Group, Member } from "@/types/models";

export const currentUserId = "member-raghav";

export const seedMembers: Member[] = [
  { id: currentUserId, name: "Raghav", initials: "RG", color: "#DFF7EC" },
  { id: "member-aman", name: "Aman", initials: "AK", color: "#FEECD9" },
  { id: "member-priya", name: "Priya", initials: "PS", color: "#E8E5FF" },
  { id: "member-neha", name: "Neha", initials: "NM", color: "#FFE3EA" },
];

export const seedGroups: Group[] = [
  {
    id: "goa-trip",
    name: "Goa Trip",
    emoji: "🌴",
    currency: "INR",
    members: seedMembers,
    inviteCode: "GOA24",
    expenses: [
      {
        id: "expense-hotel",
        description: "Hotel advance",
        amount: 7200,
        paidById: currentUserId,
        shares: seedMembers.map((member) => ({ memberId: member.id, amount: 1800 })),
        date: "2026-08-10T10:30:00.000Z",
        note: "Two nights near Baga beach",
        splitMode: "equal",
        addedById: currentUserId,
      },
      {
        id: "expense-cab",
        description: "Cab to hotel",
        amount: 800,
        paidById: "member-aman",
        shares: seedMembers.map((member) => ({ memberId: member.id, amount: 200 })),
        date: "2026-08-11T08:45:00.000Z",
        splitMode: "equal",
        addedById: "member-aman",
      },
      {
        id: "expense-dinner",
        description: "Dinner at Britto's",
        amount: 2640,
        paidById: "member-neha",
        shares: [
          { memberId: currentUserId, amount: 720 },
          { memberId: "member-aman", amount: 640 },
          { memberId: "member-priya", amount: 580 },
          { memberId: "member-neha", amount: 700 },
        ],
        date: "2026-08-11T15:15:00.000Z",
        splitMode: "exact",
        addedById: "member-priya",
        editedAt: "2026-08-11T15:30:00.000Z",
        editedById: "member-priya",
      },
      {
        id: "expense-scooters",
        description: "Scooter rental",
        amount: 1200,
        paidById: "member-priya",
        shares: [
          { memberId: currentUserId, amount: 400 },
          { memberId: "member-priya", amount: 400 },
          { memberId: "member-neha", amount: 400 },
        ],
        date: "2026-08-12T05:20:00.000Z",
        note: "Aman rented separately",
        splitMode: "equal",
        addedById: "member-priya",
      },
    ],
  },
  {
    id: "flat-expenses",
    name: "Flat expenses",
    emoji: "🏠",
    currency: "INR",
    inviteCode: "FLAT7",
    members: [
      seedMembers[0],
      seedMembers[1],
      { id: "member-kabir", name: "Kabir", initials: "KS", color: "#E1F0FF", isPlaceholder: true },
    ],
    expenses: [
      {
        id: "expense-groceries",
        description: "Monthly groceries",
        amount: 3150,
        paidById: "member-aman",
        shares: [
          { memberId: currentUserId, amount: 1050 },
          { memberId: "member-aman", amount: 1050 },
          { memberId: "member-kabir", amount: 1050 },
        ],
        date: "2026-08-08T12:00:00.000Z",
        splitMode: "equal",
        addedById: "member-aman",
      },
    ],
  },
];
