const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const writes = [];
let passwordHash;
const mock = {
  user: {
    findUnique: async ({ where }) => ({ id: where.id, organizationId: 'test-org', role: where.id, isActive: true, email: 'account@example.com', passwordHash }),
    update: async args => { writes.push(args); return { id: args.where.id, email: 'account@example.com', role: args.where.id, ...args.data }; },
  },
  passwordResetToken: { updateMany: async args => { writes.push({ resets: args }); return { count: 1 }; } },
  $transaction: async operations => Promise.all(operations),
};
const configPath = require.resolve('../dist/config/prisma');
require.cache[configPath] = { id: configPath, filename: configPath, loaded: true, exports: { prisma: mock } };
process.env.JWT_SECRET = 'test-profile-secret';
const app = express(); app.use(express.json());
app.use('/auth', require('../dist/routes/auth').default);
test('account profile and password access for all three roles', async () => {
  passwordHash = await bcrypt.hash('OldPassword1!', 4);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const request = (route, role, method, body) => fetch(`http://127.0.0.1:${server.address().port}/auth${route}`, {
    method, headers: { 'Content-Type': 'application/json', ...(role ? { Authorization: `Bearer ${jwt.sign({ id: role, organizationId: 'test-org', role }, process.env.JWT_SECRET)}` } : {}) }, body: JSON.stringify(body),
  });
  try {
    assert.equal((await request('/me', null, 'PUT', {})).status, 401);
    assert.equal((await request('/change-password', null, 'POST', {})).status, 401);
    for (const role of ['EMPLOYEE', 'ASSESSOR', 'HR']) {
      const response = await request('/me', role, 'PUT', { firstName: ' Ada ', lastName: ' Okafor ', email: 'changed@example.com', role: 'HR', id: 'other-user' });
      assert.equal(response.status, 200);
      const saved = await response.json();
      assert.equal(saved.email, 'account@example.com');
      assert.equal(saved.role, role);
      assert.deepEqual(writes.at(-1).data, { firstName: 'Ada', lastName: 'Okafor' });
      assert.equal(writes.at(-1).where.id, role);
      assert.equal((await request('/me', role, 'PUT', { firstName: ' ', lastName: 'Okafor' })).status, 400);
      const before = writes.length;
      assert.equal((await request('/change-password', role, 'POST', { currentPassword: 'wrong', newPassword: 'NewPassword2!' })).status, 400);
      assert.equal((await request('/change-password', role, 'POST', { currentPassword: 'OldPassword1!', newPassword: 'weak' })).status, 400);
      assert.equal((await request('/change-password', role, 'POST', { currentPassword: 'OldPassword1!', newPassword: 'OldPassword1!' })).status, 400);
      assert.equal(writes.length, before);
      assert.equal((await request('/change-password', role, 'POST', { currentPassword: 'OldPassword1!', newPassword: 'NewPassword2!' })).status, 200);
      const update = writes.findLast(write => write.data?.passwordHash);
      assert.equal(update.where.id, role);
      assert.equal(await bcrypt.compare('NewPassword2!', update.data.passwordHash), true);
      assert.equal(writes.at(-1).resets.where.userId, role);
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});
