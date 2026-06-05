const router = require('express').Router();
const { db } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const notesCol = db.collection('notes');

// List notes
router.get('/', async (req, res) => {
  try {
    const snapshot = await notesCol
      .where('userId', '==', req.user.id)
      .orderBy('pinned', 'desc')
      .orderBy('updatedAt', 'desc')
      .get();

    const notes = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
});

// Create note
router.post('/', async (req, res) => {
  try {
    const { title, content, color, pinned } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const now = new Date().toISOString();
    const noteData = {
      title,
      content: content || '',
      color: color || '#ffffff',
      pinned: pinned || false,
      userId: req.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await notesCol.add(noteData);
    res.status(201).json({ id: ref.id, ...noteData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create note' });
  }
});

// Update note
router.put('/:id', async (req, res) => {
  try {
    const doc = await notesCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const { title, content, color, pinned } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (color !== undefined) updates.color = color;
    if (pinned !== undefined) updates.pinned = pinned;

    await notesCol.doc(req.params.id).update(updates);
    res.json({ id: req.params.id, ...doc.data(), ...updates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// Delete note
router.delete('/:id', async (req, res) => {
  try {
    const doc = await notesCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Note not found' });
    }
    await notesCol.doc(req.params.id).delete();
    res.json({ message: 'Note deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

module.exports = router;
