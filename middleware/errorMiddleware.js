function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  res.status(404);
  next(error);
}

function errorHandler(err, req, res, _next) {
  let statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  let message = err.message || "Internal Server Error";
  if (err.name === "ValidationError") statusCode = 400;
  if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for ${Object.keys(err.keyValue || {}).join(", ")}`;
  }
  if (err.name === "CastError") statusCode = 400;
  res.status(statusCode).json({ success: false, message });
}

module.exports = { notFound, errorHandler };
