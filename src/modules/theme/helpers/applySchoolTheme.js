import { normalizeSchoolTheme } from '../constants/themePalette';

function hexToRgb(hexColor) {
  const normalizedHex = String(hexColor || '').replace('#', '');

  return {
    r: parseInt(normalizedHex.slice(0, 2), 16),
    g: parseInt(normalizedHex.slice(2, 4), 16),
    b: parseInt(normalizedHex.slice(4, 6), 16),
  };
}

function mixWithBlack(hexColor, ratio = 0.18) {
  const { r, g, b } = hexToRgb(hexColor);

  const mix = (channel) => Math.max(0, Math.round(channel * (1 - ratio)));

  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}

function rgba(hexColor, alpha) {
  const { r, g, b } = hexToRgb(hexColor);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function applySchoolTheme(theme) {
  const normalizedTheme = normalizeSchoolTheme(theme);
  const root = document.documentElement;

  root.style.setProperty('--accent', normalizedTheme.primaryColor);
  root.style.setProperty('--accent-strong', mixWithBlack(normalizedTheme.primaryColor));
  root.style.setProperty('--accent-soft', rgba(normalizedTheme.primaryColor, 0.12));
  root.style.setProperty('--info', normalizedTheme.primaryColor);
  root.style.setProperty('--error', normalizedTheme.dangerColor);
  root.style.setProperty('--warning', normalizedTheme.warningColor);
  root.style.setProperty('--success', normalizedTheme.successColor);
}
