const router = require('express').Router();
const { db } = require('../models');
const { encrypt, decrypt } = require('../utils/crypto');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const credsCol = db.collection('credentials');

// List credentials (service names only, no secrets)
router.get('/', async (req, res) => {
  try {
    const snapshot = await credsCol
      .where('userId', '==', req.user.id)
      .orderBy('serviceName', 'asc')
      .get();

    const creds = snapshot.docs.map((doc) => {
      const d = doc.data();
      return {
        id: doc.id,
        serviceName: d.serviceName,
        serviceUrl: d.serviceUrl,
        notes: d.notes,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
    res.json(creds);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch credentials' });
  }
});

// Get single credential (decrypted)
router.get('/:id', async (req, res) => {
  try {
    const doc = await credsCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const d = doc.data();
    res.json({
      id: doc.id,
      serviceName: d.serviceName,
      serviceUrl: d.serviceUrl,
      username: decrypt(d.username, d.iv),
      password: decrypt(d.password, d.passwordIv),
      notes: d.notes,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to decrypt credential' });
  }
});

// Create credential
router.post('/', async (req, res) => {
  try {
    const { serviceName, serviceUrl, username, password, notes } = req.body;
    if (!serviceName || !username || !password) {
      return res.status(400).json({ error: 'serviceName, username, and password are required' });
    }

    const encUser = encrypt(username);
    const encPass = encrypt(password);
    const now = new Date().toISOString();

    const credData = {
      serviceName,
      serviceUrl: serviceUrl || null,
      username: encUser.encrypted,
      iv: encUser.iv,
      password: encPass.encrypted,
      passwordIv: encPass.iv,
      notes: notes || null,
      userId: req.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await credsCol.add(credData);
    res.status(201).json({ id: ref.id, serviceName });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save credential' });
  }
});

// Update credential
router.put('/:id', async (req, res) => {
  try {
    const doc = await credsCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    const { serviceName, serviceUrl, username, password, notes } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (serviceName !== undefined) updates.serviceName = serviceName;
    if (serviceUrl !== undefined) updates.serviceUrl = serviceUrl;
    if (notes !== undefined) updates.notes = notes;

    if (username) {
      const enc = encrypt(username);
      updates.username = enc.encrypted;
      updates.iv = enc.iv;
    }
    if (password) {
      const enc = encrypt(password);
      updates.password = enc.encrypted;
      updates.passwordIv = enc.iv;
    }

    await credsCol.doc(req.params.id).update(updates);
    res.json({ id: req.params.id, serviceName: serviceName || doc.data().serviceName });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update credential' });
  }
});

// Delete credential
router.delete('/:id', async (req, res) => {
  try {
    const doc = await credsCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Credential not found' });
    }
    await credsCol.doc(req.params.id).delete();
    res.json({ message: 'Credential deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete credential' });
  }
});

module.exports = router;
