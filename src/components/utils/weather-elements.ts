import type { WeatherElement } from '@/models/Issue';

export const WEATHER_ELEMENT_META: Record<WeatherElement, { icon: string; fallbackLabel: string }> =
  {
    snow_ice: { icon: '❄️', fallbackLabel: 'Neige & Glace' },
    rain_flooding: { icon: '🌧️', fallbackLabel: 'Pluie & Inondation' },
    high_wind: { icon: '💨', fallbackLabel: 'Vents forts' },
    freezing_rain: { icon: '🧊', fallbackLabel: 'Pluie verglaçante' },
    extreme_heat: { icon: '☀️', fallbackLabel: 'Chaleur extrême' },
  };
