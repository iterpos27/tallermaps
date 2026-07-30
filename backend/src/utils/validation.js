const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

const normalizeEmail = (value) => (
  typeof value === 'string' ? value.trim().toLowerCase() : ''
);

const isValidEmail = (value) => {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

const isValidCoordinate = (value, min, max) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max;
};

const isValidLatitude = (value) => isValidCoordinate(value, -90, 90);
const isValidLongitude = (value) => isValidCoordinate(value, -180, 180);

const validatePassword = (password) => {
  if (typeof password !== 'string' || password.length < 10) {
    return 'La contraseña debe tener al menos 10 caracteres.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return 'La contraseña debe incluir letras y números.';
  }
  return '';
};

module.exports = {
  isNonEmptyString,
  normalizeEmail,
  isValidEmail,
  isValidLatitude,
  isValidLongitude,
  validatePassword
};
