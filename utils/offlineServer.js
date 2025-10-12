// utils/offlineServer.js
const express = require('express');
const {
  loadCache,
  getCache,
  getGuildCache,
  setAutoRoles,
  addPending,
  clearPending,
  saveCache
} = require('./cacheManager');

const app = express();
app.use(express.json());

const PORT = process.env.OFFLINE_PORT || 3000;
const SECRET = process.env.OFFLINE_SECRET || 'changeme';

function auth(req, res, next) {
  const s = req.headers['x-offline-secret'];
  if (!s || s !== SECRET) return res.status(401).json({ ok: false, message: 'Unauthorized' });
  next();
}

loadCache();

// xem toàn bộ cache
app.get('/cache', auth, (req, res) => res.json({ ok: true, cache: getCache() }));

// xem cache theo guild
app.get('/guild/:id', auth, (req, res) => {
  const g = getGuildCache(req.params.id);
  res.json({ ok: true, guild: g });
});

// cập nhật auto role
app.post('/guild/:id/autoroles', auth, (req, res) => {
  const config = req.body || {};
  setAutoRoles(req.params.id, config);
  res.json({ ok: true, saved: config });
});

// thêm lệnh hoặc hành động pending khi bot off
app.post('/command', auth, (req, res) => {
  const { type, payload } = req.body;
  if (!type) return res.status(400).json({ ok: false, message: 'type required' });
  addPending({ type, payload });
  res.json({ ok: true, saved: { type, payload } });
});

// xem danh sách pending
app.get('/pending', auth, (req, res) => res.json({ ok: true, pending: getCache().pending }));

// xóa pending
app.post('/pending/clear', auth, (req, res) => {
  clearPending();
  res.json({ ok: true });
});

// lưu cache thủ công
app.post('/save', auth, (req, res) => {
  saveCache();
  res.json({ ok: true });
});

app.listen(PORT, () => console.log(`[OfflineServer] Listening on port ${PORT}`));
