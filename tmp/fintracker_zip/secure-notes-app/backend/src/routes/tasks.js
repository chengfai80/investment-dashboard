const router = require('express').Router();
const { db } = require('../models');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

const tasksCol = db.collection('tasks');

// List tasks (optional ?date=YYYY-MM-DD, ?completed=true/false)
router.get('/', async (req, res) => {
  try {
    let query = tasksCol.where('userId', '==', req.user.id);

    if (req.query.date) {
      query = query.where('dueDate', '==', req.query.date);
    }
    if (req.query.completed !== undefined) {
      query = query.where('completed', '==', req.query.completed === 'true');
    }

    const snapshot = await query.orderBy('dueDate', 'asc').get();
    const tasks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create task
router.post('/', async (req, res) => {
  try {
    const { title, description, dueDate, priority, subtasks } = req.body;
    if (!title) return res.status(400).json({ error: 'Title is required' });

    const now = new Date().toISOString();
    const taskData = {
      title,
      description: description || '',
      completed: false,
      dueDate: dueDate || null,
      priority: priority || 'medium',
      subtasks: (subtasks || []).map((s, i) => ({
        id: `sub_${Date.now()}_${i}`,
        title: s.title || s,
        completed: false,
      })),
      userId: req.user.id,
      createdAt: now,
      updatedAt: now,
    };

    const ref = await tasksCol.add(taskData);
    res.status(201).json({ id: ref.id, ...taskData });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  try {
    const doc = await tasksCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, completed, dueDate, priority, subtasks } = req.body;
    const updates = { updatedAt: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (completed !== undefined) updates.completed = completed;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (priority !== undefined) updates.priority = priority;
    if (subtasks !== undefined) updates.subtasks = subtasks;

    await tasksCol.doc(req.params.id).update(updates);
    res.json({ id: req.params.id, ...doc.data(), ...updates });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Toggle task complete
router.patch('/:id/toggle', async (req, res) => {
  try {
    const doc = await tasksCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const newCompleted = !doc.data().completed;
    await tasksCol.doc(req.params.id).update({
      completed: newCompleted,
      updatedAt: new Date().toISOString(),
    });
    res.json({ id: req.params.id, ...doc.data(), completed: newCompleted });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle task' });
  }
});

// Toggle subtask complete
router.patch('/:id/subtask/:subtaskId/toggle', async (req, res) => {
  try {
    const doc = await tasksCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const data = doc.data();
    const subtasks = (data.subtasks || []).map((s) => {
      if (s.id === req.params.subtaskId) {
        return { ...s, completed: !s.completed };
      }
      return s;
    });

    await tasksCol.doc(req.params.id).update({
      subtasks,
      updatedAt: new Date().toISOString(),
    });
    res.json({ id: req.params.id, ...data, subtasks });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle subtask' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const doc = await tasksCol.doc(req.params.id).get();
    if (!doc.exists || doc.data().userId !== req.user.id) {
      return res.status(404).json({ error: 'Task not found' });
    }
    await tasksCol.doc(req.params.id).delete();
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
