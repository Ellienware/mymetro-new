export const calculatePointsBonus = (amount: number): number => {
  if (amount >= 301 && amount <= 700) return 0.125; // 12.5%
  if (amount >= 201 && amount <= 300) return 0.10;  // 10%
  if (amount >= 101 && amount <= 200) return 0.075; // 7.5%
  if (amount >= 51 && amount <= 100) return 0.05;   // 5%
  return 0;
};

export const getPointsBreakdown = (amount: number): { basePoints: number; bonusPoints: number; totalPoints: number } => {
  const basePoints = amount; // 1 point per Rand
  const bonusRate = calculatePointsBonus(amount);
  const bonusPoints = Math.floor(basePoints * bonusRate);
  return { basePoints, bonusPoints, totalPoints: basePoints + bonusPoints };
};