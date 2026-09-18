// Lean / reporting-type chip labels shared by the list screens (Search,
// Saved), so an article reads the same in both. The card and article page
// keep their own finer-grained wording.
export const getPoliticalLeanLabel = (value: number | null | undefined) => {
  if (value == null) return null;
  if (value < -0.3) return 'Left-leaning';
  if (value > 0.3) return 'Right-leaning';
  return 'Center';
};

export const getReportingLabel = (value: number | null | undefined) => {
  if (value == null) return null;
  if (value > 0.3) return 'High quality';
  if (value < -0.3) return 'Sensational';
  return 'Mixed';
};
