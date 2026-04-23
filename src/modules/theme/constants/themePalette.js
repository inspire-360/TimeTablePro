export const GOOGLE_THEME_COLORS = [
  {
    id: 'google-blue',
    label: 'ฟ้า',
    value: '#4285F4',
  },
  {
    id: 'google-red',
    label: 'แดง',
    value: '#EA4335',
  },
  {
    id: 'google-yellow',
    label: 'เหลือง',
    value: '#FBBC05',
  },
  {
    id: 'google-green',
    label: 'เขียว',
    value: '#34A853',
  },
];

export const DEFAULT_SCHOOL_THEME = {
  primaryColor: '#4285F4',
  dangerColor: '#EA4335',
  warningColor: '#FBBC05',
  successColor: '#34A853',
};

export function isValidThemeColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || '').trim());
}

export function normalizeSchoolTheme(theme = {}) {
  return {
    primaryColor: isValidThemeColor(theme.primaryColor)
      ? theme.primaryColor
      : DEFAULT_SCHOOL_THEME.primaryColor,
    dangerColor: isValidThemeColor(theme.dangerColor)
      ? theme.dangerColor
      : DEFAULT_SCHOOL_THEME.dangerColor,
    warningColor: isValidThemeColor(theme.warningColor)
      ? theme.warningColor
      : DEFAULT_SCHOOL_THEME.warningColor,
    successColor: isValidThemeColor(theme.successColor)
      ? theme.successColor
      : DEFAULT_SCHOOL_THEME.successColor,
  };
}
