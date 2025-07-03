export const extractHost = (raw: string): string => {
  const match = raw.match(/\nHost:\s*(.*)/i);
  return match ? match[1].trim() : "";
};

export const extractStatusCode = (raw: string | undefined): number | null => {
  if (!raw) return null;
  const first = raw.split(/\r?\n/)[0];
  const m = first.match(/\b(\d{3})\b/);
  return m ? parseInt(m[1], 10) : null;
};

export const extractDate = (raw: string): string | null => {
  const match = raw.match(/\nDate:\s*(.*)/i);
  return match ? match[1].trim() : null;
};
