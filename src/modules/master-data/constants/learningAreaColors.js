export const LEARNING_AREA_COLOR_OPTIONS = [
  { value: 'river', label: 'River Blue', hex: '#2F6FED' },
  { value: 'orchard', label: 'Orchard Green', hex: '#2D8A60' },
  { value: 'sunrise', label: 'Sunrise Gold', hex: '#D9921B' },
  { value: 'lotus', label: 'Lotus Rose', hex: '#C94B7A' },
  { value: 'ink', label: 'Ink Navy', hex: '#39536C' },
  { value: 'terracotta', label: 'Terracotta', hex: '#C7643B' },
  { value: 'violet-slate', label: 'Violet Slate', hex: '#6B63B5' },
  { value: 'lagoon', label: 'Lagoon Teal', hex: '#188085' },
];

export const DEFAULT_LEARNING_AREA_COLOR_TOKEN = LEARNING_AREA_COLOR_OPTIONS[0].value;

export function getLearningAreaColor(colorToken) {
  return (
    LEARNING_AREA_COLOR_OPTIONS.find((option) => option.value === colorToken) ||
    LEARNING_AREA_COLOR_OPTIONS[0]
  );
}
