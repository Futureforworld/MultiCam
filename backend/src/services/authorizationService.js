
export function getAuthenticatedUser(db, userId) {
  const parsedUserId = Number(userId);

  if (!Number.isSafeInteger(parsedUserId) || parsedUserId <= 0) {
    return null;
  }

  const user = db.prepare(`
    SELECT
      id,
      email,
      role,
      status
    FROM users
    WHERE id = ?
  `).get(parsedUserId);

  if (!user || user.status !== 'active') {
    return null;
  }

  const clients = db.prepare(`
    SELECT clientId
    FROM user_clients
    WHERE userId = ?
    ORDER BY clientId
  `).all(user.id).map(item => item.clientId);

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    clientIds: user.role === 'superadmin' ? null : clients
  };
}

export function canAccessClient(user, clientId) {
  const parsedClientId = Number(clientId);

  if (!user || !Number.isSafeInteger(parsedClientId) || parsedClientId <= 0) {
    return false;
  }

  if (user.role === 'superadmin') {
    return true;
  }

  return Array.isArray(user.clientIds) &&
    user.clientIds.includes(parsedClientId);
}

export function canManageClients(user) {
  return Boolean(user && user.role === 'superadmin');
}
