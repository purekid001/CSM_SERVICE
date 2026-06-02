const SAMUT_SAKHON = {
  label: 'สมุทรสาคร',
  latitude: 13.54753,
  longitude: 100.27362,
  timezone: 'Asia/Bangkok',
};

const WEATHER_CACHE_KEY = 'loginWeatherSamutSakhon';
const WEATHER_CACHE_TTL_MS = 20 * 60 * 1000;

function mapWeatherTheme(weatherCode) {
  if ([95, 96, 99].includes(weatherCode)) return 'storm';
  if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) return 'rain';
  if ([45, 48].includes(weatherCode)) return 'fog';
  if ([1, 2, 3].includes(weatherCode)) return 'cloudy';
  return 'clear';
}

function describeWeather(weatherCode, isDay) {
  if (weatherCode === 0) return isDay ? 'ฟ้าโปร่ง' : 'ฟ้าใสยามคืน';
  if ([1, 2].includes(weatherCode)) return isDay ? 'มีเมฆบางส่วน' : 'เมฆบางส่วนยามคืน';
  if (weatherCode === 3) return 'เมฆมาก';
  if ([45, 48].includes(weatherCode)) return 'มีหมอก';
  if ([51, 53, 55, 56, 57].includes(weatherCode)) return 'ฝนละออง';
  if ([61, 63, 65, 66, 67].includes(weatherCode)) return 'ฝนกำลังตก';
  if ([71, 73, 75, 77, 85, 86].includes(weatherCode)) return 'อากาศเย็นจัด';
  if ([80, 81, 82].includes(weatherCode)) return 'ฝนเป็นช่วง';
  if ([95, 96, 99].includes(weatherCode)) return 'ฝนฟ้าคะนอง';
  return 'อากาศเปลี่ยนแปลง';
}

function getWeatherIcon(theme, phase) {
  if (theme === 'storm') return 'fa-cloud-bolt';
  if (theme === 'rain') return 'fa-cloud-rain';
  if (theme === 'fog') return 'fa-smog';
  if (theme === 'cloudy') return phase === 'night' ? 'fa-cloud-moon' : 'fa-cloud-sun';
  return phase === 'night' ? 'fa-moon' : 'fa-sun';
}

function formatObservedTime(value) {
  if (!value || typeof value !== 'string' || !value.includes('T')) return '';
  return value.split('T')[1].slice(0, 5);
}

function readWeatherCache() {
  try {
    const raw = localStorage.getItem(WEATHER_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.payload || !parsed.cachedAt) return null;
    return parsed;
  } catch (error) {
    console.warn('Weather cache read error:', error);
    return null;
  }
}

function writeWeatherCache(payload) {
  try {
    localStorage.setItem(
      WEATHER_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        payload,
      })
    );
  } catch (error) {
    console.warn('Weather cache write error:', error);
  }
}

function applyWeatherTheme(payload) {
  const weatherPill = document.getElementById('login-weather-pill');
  const weatherIcon = document.getElementById('login-weather-icon');
  const weatherValue = document.getElementById('login-weather-value');
  const weatherCaption = document.getElementById('login-weather-caption');

  document.body.dataset.loginWeather = payload.theme;
  document.body.dataset.loginPhase = payload.phase;
  document.body.dataset.loginWind = payload.windSpeed >= 24 ? 'breezy' : 'calm';

  if (weatherPill) {
    weatherPill.dataset.weatherTheme = payload.theme;
  }

  if (weatherIcon) {
    weatherIcon.className = `fa-solid ${payload.iconClass}`;
  }

  if (weatherValue) {
    weatherValue.textContent = `${payload.temperatureC}°C • ${payload.description}`;
  }

  if (weatherCaption) {
    const observedAt = formatObservedTime(payload.observedAt);
    weatherCaption.textContent = observedAt
      ? `อัปเดต ${observedAt} น. และปรับฉากตามสภาพอากาศจริงของสมุทรสาคร`
      : 'ปรับฉากตามสภาพอากาศจริงของสมุทรสาคร';
  }
}

function buildWeatherPayload(current) {
  const weatherCode = Number(current?.weather_code ?? 0);
  const isDay = Number(current?.is_day ?? 1) === 1;
  const phase = isDay ? 'day' : 'night';
  const theme = mapWeatherTheme(weatherCode);
  const description = describeWeather(weatherCode, isDay);

  return {
    location: SAMUT_SAKHON.label,
    temperatureC: Math.round(Number(current?.temperature_2m ?? 0)),
    weatherCode,
    phase,
    theme,
    description,
    iconClass: getWeatherIcon(theme, phase),
    windSpeed: Math.round(Number(current?.wind_speed_10m ?? 0)),
    observedAt: String(current?.time ?? ''),
  };
}

async function fetchSamutSakhonWeather() {
  const params = new URLSearchParams({
    latitude: String(SAMUT_SAKHON.latitude),
    longitude: String(SAMUT_SAKHON.longitude),
    current: 'temperature_2m,weather_code,is_day,wind_speed_10m',
    timezone: SAMUT_SAKHON.timezone,
    forecast_days: '1',
  });

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 7000);

  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Weather request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (!data?.current) {
      throw new Error('Weather response missing current data');
    }

    return buildWeatherPayload(data.current);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function initLoginWeatherTheme() {
  const cached = readWeatherCache();

  if (cached?.payload) {
    applyWeatherTheme(cached.payload);
  }

  if (cached?.cachedAt && Date.now() - cached.cachedAt < WEATHER_CACHE_TTL_MS) {
    return;
  }

  try {
    const payload = await fetchSamutSakhonWeather();
    writeWeatherCache(payload);
    applyWeatherTheme(payload);
  } catch (error) {
    console.error('Login weather load error:', error);

    if (!cached?.payload) {
      applyWeatherTheme({
        location: SAMUT_SAKHON.label,
        temperatureC: 30,
        weatherCode: 1,
        phase: 'day',
        theme: 'clear',
        description: 'บรรยากาศชายฝั่ง',
        iconClass: 'fa-cloud-sun',
        windSpeed: 12,
        observedAt: '',
      });
    }
  }
}
