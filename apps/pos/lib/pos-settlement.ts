import { PosStoredItem } from "./pos-store";

export type PosParticipant = {
  id: number;
  name: string;
  type: "PLAY" | "ORDER" | "BOTH";
};

export type PosSettlementLine = {
  personId: number;
  name: string;
  personalOrder: number;
  sharedOrder: number;
  payable: number;
  paid: number;
  remaining: number;
};

export type PosSettlementSummary = {
  grandTotal: number;
  totalPaid: number;
  totalRemaining: number;
};

export type PosSettlementSnapshot = {
  people: PosSettlementLine[];
  summary: PosSettlementSummary;
};

function isOrderType(type: PosParticipant["type"]): boolean {
  return type === "ORDER" || type === "BOTH";
}

export function buildPosSettlement(
  participants: PosParticipant[],
  items: PosStoredItem[],
  paidByPerson: Record<number, number>,
): PosSettlementSnapshot {
  const participantById = new Map(participants.map((person) => [person.id, person]));
  const orderEligible = participants.filter((person) => isOrderType(person.type));

  const personalByPerson = new Map<number, number>();
  let sharedPool = 0;

  for (const item of items) {
    if (item.ownerType === "PERSON" && item.ownerPersonId) {
      const target = participantById.get(item.ownerPersonId);
      if (!target || !isOrderType(target.type)) {
        throw new Error("Invalid owner assignment in local order items");
      }
      personalByPerson.set(
        item.ownerPersonId,
        (personalByPerson.get(item.ownerPersonId) ?? 0) + item.lineTotal,
      );
      continue;
    }
    sharedPool += item.lineTotal;
  }

  if (sharedPool > 0 && orderEligible.length === 0) {
    throw new Error("No ORDER/BOTH participant available for shared split");
  }

  const sharedByPerson = new Map<number, number>();
  const sharedBase =
    orderEligible.length > 0 ? Math.floor(sharedPool / orderEligible.length) : 0;
  const sharedRemain = orderEligible.length > 0 ? sharedPool % orderEligible.length : 0;

  orderEligible.forEach((person, index) => {
    sharedByPerson.set(
      person.id,
      sharedBase + (index < sharedRemain ? 1 : 0),
    );
  });

  const people = participants.map<PosSettlementLine>((person) => {
    const personalOrder = isOrderType(person.type)
      ? (personalByPerson.get(person.id) ?? 0)
      : 0;
    const sharedOrder = isOrderType(person.type)
      ? (sharedByPerson.get(person.id) ?? 0)
      : 0;
    const payable = personalOrder + sharedOrder;
    const paid = paidByPerson[person.id] ?? 0;
    const remaining = Math.max(payable - paid, 0);

    return {
      personId: person.id,
      name: person.name,
      personalOrder,
      sharedOrder,
      payable,
      paid,
      remaining,
    };
  });

  const grandTotal = people.reduce((sum, person) => sum + person.payable, 0);
  const totalPaid = people.reduce((sum, person) => sum + person.paid, 0);
  const totalRemaining = people.reduce((sum, person) => sum + person.remaining, 0);

  return {
    people,
    summary: {
      grandTotal,
      totalPaid,
      totalRemaining,
    },
  };
}
