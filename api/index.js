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

const rooms = {};

function fetchQuestionsForRoom(roomCode) {
  return new Promise((resolve, reject) => {
    const query = `

         SELECT p.IdPregunta, p.Pregunta, 
             r.IdRespuesta, r.Respuesta, r.BuenaMala
      FROM preguntas p
      JOIN respuestas r ON p.IdPregunta = r.IdPregunta
      WHERE p.IdCategoria = 2
      ORDER BY p.IdPregunta, RAND()
      LIMIT 40
    `;

    db.query(query, (err, results) => {
      if (err) {
        console.error("Error obteniendo las preguntas:", err);
        reject(err);
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

      rooms[roomCode].questions = questions.slice(0, 10);  // Tomar solo 10 preguntas
      rooms[roomCode].currentQuestionIndex = 0;
      resolve();
    });
  });
}

app.post("/createRoom", (req, res) => {
  const { playerName } = req.body;
  const roomCode = Math.random().toString(36).substring(7).toUpperCase();
  rooms[roomCode] = {
    name: `Sala de ${playerName}`,
    players: [{name: playerName, score: 0, ready: false}],
    state: 'waiting',
    questions: [],
    currentQuestionIndex: 0
  };
  res.json({ success: true, roomCode });
});

app.get("/availableRooms", (req, res) => {
  const availableRooms = Object.entries(rooms)
    .filter(([_, room]) => room.state === 'waiting')
    .map(([code, room]) => ({
      id: code,
      codigo: code,
      nombre: room.name,
      jugadores: JSON.stringify(room.players)
    }));
  res.json(availableRooms);
});

app.post("/joinRoom", (req, res) => {
  const { roomCode, playerName } = req.body;
  if (rooms[roomCode] && rooms[roomCode].state === 'waiting') {
    rooms[roomCode].players.push({name: playerName, score: 0, ready: false});
    res.json({ success: true, roomCode });
  } else {
    res.json({ success: false, message: "Sala no encontrada o juego ya iniciado" });
  }
});

app.post("/playerReady", (req, res) => {
  const { roomCode, playerName } = req.body;
  if (rooms[roomCode]) {
    const player = rooms[roomCode].players.find(p => p.name === playerName);
    if (player) {
      player.ready = true;
      res.json({ success: true });
    } else {
      res.json({ success: false, message: "Jugador no encontrado" });
    }
  } else {
    res.json({ success: false, message: "Sala no encontrada" });
  }
});

app.get("/roomStatus", (req, res) => {
  const { roomCode } = req.query;
  if (rooms[roomCode]) {
    res.json({
      success: true,
      players: rooms[roomCode].players,
      state: rooms[roomCode].state,
      currentQuestionIndex: rooms[roomCode].currentQuestionIndex
    });
  } else {
    res.json({ success: false, message: "Sala no encontrada" });
  }
});

app.post("/startGame", async (req, res) => {
  const { roomCode } = req.body;
  if (rooms[roomCode] && rooms[roomCode].players.every(p => p.ready)) {
    try {
      await fetchQuestionsForRoom(roomCode);
      rooms[roomCode].state = 'playing';
      res.json({ success: true });
    } catch (error) {
      console.error("Error starting game:", error);
      res.json({ success: false, message: "Error al iniciar el juego" });
    }
  } else {
    res.json({ success: false, message: "No todos los jugadores están listos" });
  }
});

app.get("/getQuestion", (req, res) => {
  const { roomCode } = req.query;
  if (rooms[roomCode] && rooms[roomCode].state === 'playing') {
    const currentQuestion = rooms[roomCode].questions[rooms[roomCode].currentQuestionIndex];
    if (currentQuestion) {
      // Asegúrate de que todas las propiedades necesarias estén presentes
      const questionToSend = {
        IdPregunta: currentQuestion.IdPregunta,
        Pregunta: currentQuestion.Pregunta,
        Respuestas: currentQuestion.Respuestas.map(r => ({
          IdRespuesta: r.IdRespuesta,
          Respuesta: r.Respuesta,
          // No enviamos BuenaMala al cliente para evitar trampas
        }))
      };
      res.json({
        success: true,
        question: questionToSend
      });
    } else {
      res.json({ success: false, message: "No hay más preguntas" });
    }
  } else {
    res.json({ success: false, message: "Sala no encontrada o juego no iniciado" });
  }
});

app.post("/submitAnswer", (req, res) => {
  const { roomCode, playerName, answerId } = req.body;
  if (rooms[roomCode] && rooms[roomCode].state === 'playing') {
    const currentQuestion = rooms[roomCode].questions[rooms[roomCode].currentQuestionIndex];
    const answer = currentQuestion.Respuestas.find(a => a.IdRespuesta === answerId);
    const player = rooms[roomCode].players.find(p => p.name === playerName);
    
    if (answer && player) {
      const isCorrect = answer.BuenaMala;
      if (isCorrect) {
        player.score += 75;
      }
      player.answered = true;
      
      // Verificar si todos los jugadores han respondido
      const allAnswered = rooms[roomCode].players.every(p => p.answered);
      
      if (allAnswered) {
        rooms[roomCode].currentQuestionIndex++;
        rooms[roomCode].players.forEach(p => p.answered = false);
        
        if (rooms[roomCode].currentQuestionIndex >= rooms[roomCode].questions.length) {
          rooms[roomCode].state = 'finished';
        }
      }
      
      res.json({ success: true, correct: isCorrect });
    } else {
      res.json({ success: false, message: "Respuesta o jugador no encontrado" });
    }
  } else {
    res.json({ success: false, message: "Sala no encontrada o juego no iniciado" });
  }
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
