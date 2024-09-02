const express = require("express");
const mysql = require("mysql");
const bcrypt = require("bcrypt");
const app = express();
const session = require("express-session");
const cors = require("cors");

app.use(express.json());
app.use(cors());

app.use(express.json());
app.use(cors());
app.use(
  session({
    secret: "quizmaster",
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false },
  })
);

const db = mysql.createConnection({
  host: "sql5.freesqldatabase.com",
  user: "sql5729021",
  password: "pxYn6xceaF",
  database: "sql5729021",
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connectado a la base de datos MySQL");
});

app.post("/signup", async (req, res) => {
  const { nombre, apellido, username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);

  const query =
    "INSERT INTO usuarios (Nombre, Apellido, UserName, Contrasena) VALUES (?, ?, ?, ?)";
  db.query(
    query,
    [nombre, apellido, username, hashedPassword],
    (err, result) => {
      if (err) {
        res.json({ success: false, message: "El usuario ya existe" });
      } else {
        res.json({ success: true, message: "Te has registrado correctamente" });
      }
    }
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;

  const query = "SELECT * FROM usuarios WHERE UserName = ?";
  db.query(query, [username], async (err, results) => {
    if (err) {
      console.error("Error en la consulta:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error interno del servidor" });
    }

    if (results.length > 0) {
      try {
        const match = await bcrypt.compare(password, results[0].Contrasena);
        if (match) {
          // Guardra el usuario en la sesion
          req.session.userId = results[0].IdUsuario;
          res.json({
            success: true,
            message: "Éxito en el login",
            userId: results[0].IdUsuario, // Enviar el usuairo a la aplicacion
          });
        } else {
          res.json({ success: false, message: "Credenciales invalidas" });
        }
      } catch (error) {
        console.error("Error al comparar contraseñas:", error);
        res
          .status(500)
          .json({ success: false, message: "Error interno del servidor" });
      }
    } else {
      res.json({ success: false, message: "Usuario no encontrado" });
    }
  });
});

app.get("/preguntasFacil", (req, res) => {
  const query = `
    SELECT p.IdPregunta, p.Pregunta, 
           r.IdRespuesta, r.Respuesta, r.BuenaMala
    FROM preguntas p
    JOIN respuestas r ON p.IdPregunta = r.IdPregunta
    WHERE p.IdCategoria = 1
    ORDER BY p.IdPregunta, RAND()
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error con el SQL Query: ", err);
      res.status(500).json({ error: "Error de Servidor" });
      return;
    }

    const questions = [];
    let currentQuestion = null;

    results.forEach((row) => {
      if (!currentQuestion || currentQuestion.IdPregunta !== row.IdPregunta) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          IdPregunta: row.IdPregunta,
          Pregunta: row.Pregunta,
          Respuestas: [],
        };
      }
      currentQuestion.Respuestas.push({
        IdRespuesta: row.IdRespuesta,
        Respuesta: row.Respuesta,
        BuenaMala: row.BuenaMala,
      });
    });

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    res.json(questions);
  });
});

app.get("/preguntasMedio", (req, res) => {
  const query = `
    SELECT p.IdPregunta, p.Pregunta, 
           r.IdRespuesta, r.Respuesta, r.BuenaMala
    FROM preguntas p
    JOIN respuestas r ON p.IdPregunta = r.IdPregunta
    WHERE p.IdCategoria = 2
    ORDER BY p.IdPregunta, RAND()
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error con el SQL Query: ", err);
      res.status(500).json({ error: "Error de Servidor" });
      return;
    }

    const questions = [];
    let currentQuestion = null;

    results.forEach((row) => {
      if (!currentQuestion || currentQuestion.IdPregunta !== row.IdPregunta) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          IdPregunta: row.IdPregunta,
          Pregunta: row.Pregunta,
          Respuestas: [],
        };
      }
      currentQuestion.Respuestas.push({
        IdRespuesta: row.IdRespuesta,
        Respuesta: row.Respuesta,
        BuenaMala: row.BuenaMala,
      });
    });

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    res.json(questions);
  });
});

app.get("/preguntasDificil", (req, res) => {
  const query = `
    SELECT p.IdPregunta, p.Pregunta, 
           r.IdRespuesta, r.Respuesta, r.BuenaMala
    FROM preguntas p
    JOIN respuestas r ON p.IdPregunta = r.IdPregunta
    WHERE p.IdCategoria = 3
    ORDER BY p.IdPregunta, RAND()
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error con el SQL Query: ", err);
      res.status(500).json({ error: "Error de Servidor" });
      return;
    }

    const questions = [];
    let currentQuestion = null;

    results.forEach((row) => {
      if (!currentQuestion || currentQuestion.IdPregunta !== row.IdPregunta) {
        if (currentQuestion) {
          questions.push(currentQuestion);
        }
        currentQuestion = {
          IdPregunta: row.IdPregunta,
          Pregunta: row.Pregunta,
          Respuestas: [],
        };
      }
      currentQuestion.Respuestas.push({
        IdRespuesta: row.IdRespuesta,
        Respuesta: row.Respuesta,
        BuenaMala: row.BuenaMala,
      });
    });

    if (currentQuestion) {
      questions.push(currentQuestion);
    }

    res.json(questions);
  });
});

app.post("/guardarScore", (req, res) => {
  const { userId, categoryId, score } = req.body;
  const currentDate = new Date().toISOString().slice(0, 10); // Obtener la fecha

  const getUserIdQuery = "SELECT IdUsuario FROM usuarios WHERE IdUsuario = ?";

  db.query(getUserIdQuery, [userId], (err, results) => {
    if (err) {
      console.error("Error al obtener el IdUsuario:", err);
      return res
        .status(500)
        .json({ success: false, message: "Error al obtener el IdUsuario" });
    }

    if (results.length > 0) {
      const userId = results[0].IdUsuario;

      const insertScoreQuery = `
        INSERT INTO total (IdUsuario, IdCategoria, Fecha, PuntajeFinal)
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        insertScoreQuery,
        [userId, categoryId, currentDate, score],
        (err, result) => {
          if (err) {
            console.error("Error guardando el score:", err);
            res
              .status(500)
              .json({ success: false, message: "Error al guardar el puntaje" });
          } else {
            res.json({
              success: true,
              message: "Puntaje guardado correctamente",
            });
          }
        }
      );
    } else {
      res.json({ success: false, message: "Usuario no encontrado" });
    }
  });
});

app.get("/scoresFacil", (req, res) => {
  const query = `
    SELECT t.IdTotal, CONCAT(u.Nombre, ' ', u.Apellido) AS Nombre, t.Fecha, t.PuntajeFinal, t.IdCategoria, c.Categoria AS Categoria 
    FROM total t
    JOIN usuarios u ON t.IdUsuario = u.IdUsuario JOIN categorias c ON t.IdCategoria = c.IdCategoria
    WHERE t.IdCategoria = 1 ORDER BY Categoria ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error obteniendo los scores:", err);
      res.status(500).json({ error: "Error en el server" });
      return;
    }
    res.json(results);
  });
});

app.get("/scoresMedio", (req, res) => {
  const query = `
    SELECT t.IdTotal, CONCAT(u.Nombre, ' ', u.Apellido) AS Nombre, t.Fecha, t.PuntajeFinal, t.IdCategoria, c.Categoria AS Categoria 
    FROM total t
    JOIN usuarios u ON t.IdUsuario = u.IdUsuario JOIN categorias c ON t.IdCategoria = c.IdCategoria
    WHERE t.IdCategoria = 2 ORDER BY Categoria ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error obteniendo los scores:", err);
      res.status(500).json({ error: "Error en el server" });
      return;
    }
    res.json(results);
  });
});

app.get("/scoresDificil", (req, res) => {
  const query = `
    SELECT t.IdTotal, CONCAT(u.Nombre, ' ', u.Apellido) AS Nombre, t.Fecha, t.PuntajeFinal, t.IdCategoria, c.Categoria AS Categoria 
    FROM total t
    JOIN usuarios u ON t.IdUsuario = u.IdUsuario JOIN categorias c ON t.IdCategoria = c.IdCategoria
    WHERE t.IdCategoria = 3 ORDER BY Categoria ASC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error obteniendo los scores:", err);
      res.status(500).json({ error: "Error en el server" });
      return;
    }
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log("Server iniciado en el puerto 3000");
});
