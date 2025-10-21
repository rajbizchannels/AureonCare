const express = require('express');
const router = express.Router();

// Helper function to convert snake_case to camelCase
const toCamelCase = (obj) => {
  const newObj = {};
  for (const key in obj) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

// Get all tasks
router.get('/', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(`
      SELECT * FROM tasks
      ORDER BY
        CASE
          WHEN priority = 'High' THEN 1
          WHEN priority = 'Medium' THEN 2
          WHEN priority = 'Low' THEN 3
        END,
        due_date ASC
    `);
    const tasks = result.rows.map(toCamelCase);
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Create new task
router.post('/', async (req, res) => {
  const { title, priority, dueDate, status, description } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `INSERT INTO tasks (title, priority, due_date, status, description, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [title, priority || 'Medium', dueDate, status || 'Pending', description]
    );
    res.status(201).json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Update task
router.put('/:id', async (req, res) => {
  const { title, priority, dueDate, status, description } = req.body;

  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      `UPDATE tasks
       SET title = COALESCE($1, title),
           priority = COALESCE($2, priority),
           due_date = COALESCE($3, due_date),
           status = COALESCE($4, status),
           description = COALESCE($5, description),
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [title, priority, dueDate, status, description, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(toCamelCase(result.rows[0]));
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/:id', async (req, res) => {
  try {
    const pool = req.app.locals.pool;
    const result = await pool.query(
      'DELETE FROM tasks WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

module.exports = router;
