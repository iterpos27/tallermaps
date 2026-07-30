const reportClientError = (req, res) => {
  const { message, stack, componentStack, path } = req.body || {};
  console.error(JSON.stringify({
    level: 'error',
    event: 'client_error',
    requestId: req.requestId,
    userId: req.user?.id,
    path: String(path || '').slice(0, 500),
    message: String(message || 'Error desconocido').slice(0, 1000),
    stack: String(stack || '').slice(0, 5000),
    componentStack: String(componentStack || '').slice(0, 5000)
  }));
  return res.status(202).json({ message: 'Incidente registrado.' });
};

module.exports = { reportClientError };
