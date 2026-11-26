export const formatCurrency = (val: number | undefined | null): string => {
  const n = Number(val) || 0;
  return n.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const todayIso = (): string => new Date().toISOString().slice(0, 10);

export const nowTimeHHMM = (): string => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

export const generateRefNo = (prefix: string): string => {
  const d = new Date();
  const ymd = d.toISOString().slice(2, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${ymd}-${rand}`;
};

/**
 * Generates an incrementing reference like SLIP-0001, SLIP-0002 based on existing refs.
 */
export const getNextIncrementRef = (prefix: string, existingRefs: (string | undefined)[]): string => {
  const regex = new RegExp(`^${prefix}-(\\d+)$`, 'i');
  let maxNum = 0;
  for (const ref of existingRefs) {
    if (!ref) continue;
    const match = ref.trim().match(regex);
    if (match) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxNum) maxNum = n;
    }
  }
  const next = String(maxNum + 1).padStart(4, '0');
  return `${prefix}-${next}`;
};
