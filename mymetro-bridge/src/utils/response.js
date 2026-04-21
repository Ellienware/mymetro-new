export function success(res, data, status = 200) {
  return res.json({ success: true, data }, status);
}

export function error(res, message, status = 400) {
  return res.json({ success: false, error: message }, status);
}

export function notFound(res, message = 'Not found') {
  return res.json({ success: false, error: message }, 404);
}

export function unauthorized(res, message = 'Unauthorized') {
  return res.json({ success: false, error: message }, 401);
}