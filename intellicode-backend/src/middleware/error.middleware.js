const errorHandler = (err, req, res, next) => {
  console.error(err.stack || err);

  let message = err.message || 'Server error';
  let statusCode = err.statusCode || 500;

  if (err.name === 'ValidationError') {
    const errors = Object.values(err.errors).map((error) => error.message);
    message = errors.join(', ');
    statusCode = 400;
  }

  if (err.code === 11000) {
    message = 'Duplicate field value';
    statusCode = 400;
  }

  if (err.name === 'CastError') {
    message = 'Invalid ID format';
    statusCode = 400;
  }

  res.status(statusCode).json({ success: false, error: message });
};

module.exports = errorHandler;
