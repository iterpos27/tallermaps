const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeEmail = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidCoordinate = (value, min, max) => {
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) return false;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
};

const normalizeDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
};

const businessDate = (value = new Date()) => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Guayaquil', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(value);

const isValidLatitude = (value) => isValidCoordinate(value, -90, 90);
const isValidLongitude = (value) => isValidCoordinate(value, -180, 180);

const MIN_OBSERVATION_LENGTH = 10;
const isValidObservation = (value) => (
  typeof value === 'string' && value.trim().length >= MIN_OBSERVATION_LENGTH
);

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir letras y números.';
  }
  return '';
};

module.exports = {
  normalizeDate,
  businessDate,
  isNonEmptyString,
  normalizeEmail,
  isValidEmail,
  isValidLatitude,
  isValidLongitude,
  isValidObservation,
  MIN_OBSERVATION_LENGTH,
  validatePassword
};
