const express = require("express");

const app = express();
const PORT = 5000;


// Middleware
app.use(express.json());


// Logger Middleware
app.use((req, res, next) => {
  console.log(
    `${req.method} ${req.url} ${new Date().toISOString()}`
  );
  next();
});


// Temporary Todo Database
let todos = [
  { id: 1, task: "Learn Express" },
  { id: 2, task: "Build Todo App" }
];


// GET All Todos
app.get("/todos", (req, res) => {
  res.status(200).json(todos);
});


// GET Single Todo
app.get("/todos/:id", (req, res) => {

  const id = Number(req.params.id);

  const todo = todos.find((t) => t.id === id);

  if (!todo) {
    return res.status(404).json({
      error: "Todo not found"
    });
  }

  res.status(200).json(todo);
});


// CREATE Todo
app.post("/todos", (req, res) => {

  const { task } = req.body;


  if (!task || task.trim() === "") {
    return res.status(400).json({
      error: "Task cannot be empty"
    });
  }


  const newTodo = {
    id: Date.now(),
    task: task.trim()
  };


  todos.push(newTodo);


  res.status(201).json(newTodo);
});


// UPDATE Todo
app.put("/todos/:id", (req, res) => {

  const id = Number(req.params.id);

  const todo = todos.find((t) => t.id === id);


  if (!todo) {
    return res.status(404).json({
      error: "Todo not found"
    });
  }


  const { task } = req.body;


  if (!task || task.trim() === "") {
    return res.status(400).json({
      error: "Task cannot be empty"
    });
  }


  todo.task = task.trim();


  res.status(200).json(todo);
});


// DELETE Todo
app.delete("/todos/:id", (req, res) => {

  const id = Number(req.params.id);


  const index = todos.findIndex(
    (t) => t.id === id
  );


  if (index === -1) {
    return res.status(404).json({
      error: "Todo not found"
    });
  }


  const deletedTodo = todos.splice(index, 1);


  res.status(200).json({
    message: "Todo deleted successfully",
    deleted: deletedTodo[0]
  });

});


// Invalid Route Handler
app.use((req, res) => {

  res.status(404).json({
    error: "Route not found"
  });

});


// Global Error Handler
app.use((err, req, res, next) => {

  console.error(err);

  res.status(500).json({
    error: "Internal Server Error"
  });

});


// Start Server
app.listen(PORT, () => {

  console.log(
    `Server running on http://localhost:${PORT}`
  );

});