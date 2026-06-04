export interface PaletteColors {
  primary: string;
  primaryLight: string;
  onPrimary: string;
  primaryContainer: string;
  secondary: string;
  secondaryLight: string;
  onSecondary: string;
  secondaryContainer: string;
}

export const PALETTES: Record<string, PaletteColors> = {
  default: {
    primary: '#6a1b9a',
    primaryLight: '#ba68c8',
    onPrimary: '#ffffff',
    primaryContainer: '#8e24aa',
    secondary: '#c2185b',
    secondaryLight: '#f48fb1',
    onSecondary: '#ffffff',
    secondaryContainer: '#a7005e',
  },
  shounen: {
    primary: '#FF6B00',
    primaryLight: '#FFA726',
    onPrimary: '#ffffff',
    primaryContainer: '#1A237E',
    secondary: '#0D47A1',
    secondaryLight: '#42A5F5',
    onSecondary: '#ffffff',
    secondaryContainer: '#1565C0',
  },
  akatsuki: {
    primary: '#990000',
    primaryLight: '#EF5350',
    onPrimary: '#ffffff',
    primaryContainer: '#16171B',
    secondary: '#5E5E5E',
    secondaryLight: '#E0E0E0',
    onSecondary: '#ffffff',
    secondaryContainer: '#333333',
  },
  mutsu: {
    primary: '#2E7D32',
    primaryLight: '#81C784',
    onPrimary: '#ffffff',
    primaryContainer: '#1B5E20',
    secondary: '#009688',
    secondaryLight: '#4DB6AC',
    onSecondary: '#ffffff',
    secondaryContainer: '#005C4F',
  },
  sololeveling: {
    primary: '#0091EA',
    primaryLight: '#80D8FF',
    onPrimary: '#ffffff',
    primaryContainer: '#01579B',
    secondary: '#8E24AA',
    secondaryLight: '#CE93D8',
    onSecondary: '#ffffff',
    secondaryContainer: '#4A148C',
  },
  visionario: {
    primary: '#3DB4F2',
    primaryLight: '#3DB4F2',
    onPrimary: '#ffffff',
    primaryContainer: '#0A192F',
    secondary: '#0066CC',
    secondaryLight: '#B3E5FC',
    onSecondary: '#ffffff',
    secondaryContainer: '#0D47A1',
  }
};

export const applyPalette = (paletteName: string) => {
  const colors = PALETTES[paletteName] || PALETTES.default;
  const root = document.documentElement;
  root.style.setProperty('--primary', colors.primary);
  root.style.setProperty('--primary-light', colors.primaryLight);
  root.style.setProperty('--on-primary', colors.onPrimary);
  root.style.setProperty('--primary-container', colors.primaryContainer);
  root.style.setProperty('--secondary', colors.secondary);
  root.style.setProperty('--secondary-light', colors.secondaryLight);
  root.style.setProperty('--on-secondary', colors.onSecondary);
  root.style.setProperty('--secondary-container', colors.secondaryContainer);
};

export const getCurrentPalette = (): string => {
  return localStorage.getItem('otaku_color_palette') || 'default';
};

export const savePalette = (paletteName: string) => {
  localStorage.setItem('otaku_color_palette', paletteName);
  applyPalette(paletteName);
};
