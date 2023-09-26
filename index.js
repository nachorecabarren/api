const express = require("express");
const bodyParser = require("body-parser");
const sqlite3 = require("sqlite3").verbose();
// const db = new sqlite3.Database("comparti_go.db");
const cors = require("cors");
const mercadopago = require('mercadopago');
const http = require('http');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());

app.use(bodyParser.json());

const db = new sqlite3.Database('comparti_go.db', (err) => {
  if (err) {
    return console.error(err.message);
  }
  console.log('Conexión exitosa a la base de datos SQLite');
});


// Ruta para crear un usuario (conductor o pasajero)
app.post("/usuarios", (req, res) => {
  const { tipo, nombre, apellido, mail, telefono, dni, pass } = req.body;

  // Verificar si el correo electrónico o el DNI ya están registrados
  const queryVerificarExistencia = `
    SELECT COUNT(*) as count
    FROM usuarios
    WHERE mail = ? OR dni = ?
  `;
  const valuesVerificarExistencia = [mail, dni];

  db.get(queryVerificarExistencia, valuesVerificarExistencia, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const count = row.count;

    if (count > 0) {
      return res.status(204).json({ error: 'El correo electrónico o el DNI ya están registrados' });
    }

    // Si no hay duplicados, proceder con el registro
    const queryRegistrarUsuario = `
      INSERT INTO usuarios (tipo, nombre, apellido, mail, telefono, dni, pass)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    const valuesRegistrarUsuario = [tipo, nombre, apellido, mail, telefono, dni, pass];

    db.run(queryRegistrarUsuario, valuesRegistrarUsuario, (err) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ mensaje: 'Usuario registrado con éxito' });
      sendMail(mail,'Usuario registrado con éxito' )
    });
  });

});

// Ruta para obtener todos los usuarios (conductores o pasajeros)
app.get("/usuarios", (req, res) => {
  const query = `SELECT * FROM usuarios`;
  db.all(query, (err, usuarios) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(usuarios);
  });
});

app.get("/usuarios/login", (req, res) => {
  const mailUsuario = req.query.mail;
  const passUsuario = req.query.pass;

  const query = `SELECT * FROM usuarios WHERE mail = ? and pass = ?`;
  const values = [mailUsuario, passUsuario];

  db.get(query, values, (err, usuario) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(usuario);
  });
});

// Ruta para obtener un usuario por ID
app.get("/usuarios/:id", (req, res) => {
  const idUsuario = req.params.id;
  const query = "SELECT * FROM usuarios WHERE id = ?";
  const values = [idUsuario];

  db.get(query, values, (err, usuario) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!usuario) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }
    res.json(usuario);
  });
});

//Ruta para crear un nuevo vehiculo
app.post("/vehiculo", (req, res) => {
  const vehiculo = req.body;
  const { marca, modelo, color, patente, plazas, conductor_id } = vehiculo;
  const disponible = true;
  const query = `INSERT INTO vehiculos (marca, modelo, color, patente, capacidad_pasajeros, conductor_id, disponible) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const values = [
    marca,
    modelo,
    color,
    patente,
    plazas,
    conductor_id,
    disponible,
  ];

  db.run(query, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({
      mensaje: "Vehiculo creado con éxito",
      vehiculo: { id: this.lastID, ...vehiculo },
    });
  });
});

// Ruta para obtener un auto por user ID
app.get("/vehiculo/:id", (req, res) => {
  const idUsuario = req.params.id;
  const query = "SELECT * FROM vehiculos WHERE conductor_id = ?";
  const values = [idUsuario];

  db.get(query, values, (err, vehiculo) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!vehiculo) {
      return res.status(200).json({ error: "Vehiculo no encontrado" });
    }
    res.json(vehiculo);
  });
});

app.post("/viajes", (req, res) => {
  const viaje = req.body;
  const { origen, destino, fecha, hora, conductor_id, pasajeros, costo } =
    viaje;

  const query = `INSERT INTO viajes (origen, destino, fecha, hora, conductor_id, pasajeros, costo) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  const values = [
    origen,
    destino,
    fecha,
    hora,
    conductor_id,
    JSON.stringify(pasajeros),
    costo,
  ]; // Pasajeros como JSON

  db.run(query, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      mensaje: "Viaje creado con éxito",
      viaje: { id: this.lastID, ...viaje },
    });
  });
});

// Ruta para obtener todos los viajes
app.get("/viajes", (req, res) => {
  const query = "SELECT * FROM viajes";

  db.all(query, (err, viajes) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    // Convertir pasajeros de JSON a Array
    viajes.forEach((viaje) => {
      viaje.pasajeros = JSON.parse(viaje.pasajeros);
    });
    res.json(viajes);
  });
});

// Ruta para obtener un viaje por ID
app.get("/viajes/:id", (req, res) => {
  const idViaje = req.params.id;
  const query = "SELECT * FROM viajes WHERE id = ?";
  const values = [idViaje];

  db.get(query, values, (err, viaje) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!viaje) {
      return res.status(404).json({ error: "Viaje no encontrado" });
    }
    // Convertir pasajeros de JSON a Array
    viaje.pasajeros = JSON.parse(viaje.pasajeros);
    res.json(viaje);
  });
});

// Ruta para eliminar un viaje
app.delete("/viajes/:id", (req, res) => {
  const idViaje = req.params.id;
  const query = "DELETE FROM viajes WHERE id = ?";
  const values = [idViaje];

  db.run(query, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Viaje no encontrado" });
    }
    res.json({ mensaje: "Viaje eliminado con éxito" });
  });
});
// Ruta para obtener un viaje por userID
app.get("/viajeUsuario/:id", (req, res) => {
  const idViaje = req.params.id;
  const query = "SELECT * FROM viajes WHERE conductor_id = ?";
  const values = [idViaje];

  db.all(query, values, (err, viaje) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!viaje) {
      return res.status(204).json({ error: "Viaje no encontrado" });
    }
    // Convertir pasajeros de JSON a Array
    // viaje.pasajeros = JSON.parse(viaje.pasajeros);
    res.json(viaje);
  });
});

app.get("/viajePasajero/:id", (req, res) => {
  const idPasajero = req.params.id;
  const query = "SELECT * FROM viajes WHERE id IN (SELECT id FROM asociaciones_viaje WHERE id_pasajero = ?)";
  const values = [idPasajero];

  db.get(query, values, (err, viaje) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!viaje) {
      return res.status(204).json({ error: "Viaje no encontrado" });
    }
    // Convertir pasajeros de JSON a Array
    viaje.pasajeros = JSON.parse(viaje.pasajeros);
    res.json(viaje);
  });
});

// Ruta para obtener un viaje por origen y destino
app.get("/viajes/:origen/:destino/:fecha?", (req, res) => {
  const origen = req.params.origen;
  const destino = req.params.destino;
  const fecha = req.params.fecha;

  if (!fecha) {
    const query = "SELECT * FROM viajes WHERE origen = ? AND destino = ?";
    const values = [origen, destino];

    db.all(query, values, (err, viajes) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(viajes);
    });
  } else {
    const query =
      "SELECT * FROM viajes WHERE origen = ? AND destino = ? and FECHA = ?";
    const values = [origen, destino, fecha];

    db.all(query, values, (err, viajes) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(viajes);
    });
  }
});

// Ruta para actualizar un viaje
app.put("/viajes/:id", (req, res) => {
  const idViaje = req.params.id;
  const nuevoViaje = req.body;
  const { fecha, hora, conductor_id, pasajeros, costo } = nuevoViaje;

  const query = `
      UPDATE viajes
      SET fecha = ?, hora = ?, conductor_id = ?, pasajeros = ?, costo = ?
      WHERE id = ?
    `;
  const values = [
    fecha,
    hora,
    conductor_id,
    JSON.stringify(pasajeros),
    costo,
    idViaje,
  ]; // Pasajeros como JSON

  db.run(query, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Viaje no encontrado" });
    }
    res.json({ mensaje: "Viaje actualizado con éxito" });
  });
});

app.post('/asociar-viaje', (req, res) => {
  const { idTrip, idConductor, idPasajero, idVehiculo } = req.body;

  // Asociar el viaje con el conductor y el pasajero
  const queryAsociacion = `
    INSERT INTO asociaciones_viaje (id_viaje, id_conductor, id_pasajero, id_vehiculo, estado)
    VALUES (?, ?, ?, ?, ?);
  `;
  const valuesAsociacion = [idTrip, idConductor, idPasajero, idVehiculo, 'pendiente'];

  db.run(queryAsociacion, valuesAsociacion, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    const queryMail = `SELECT mail FROM usuarios WHERE id = ?`
    const valueId = [idConductor];
    db.get(queryMail, valueId, (err,row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const mailConductor = row.mail;
      res.json({ mensaje: 'Viaje asociado y plazas actualizadas con éxito' });
      sendMail(mailConductor,'Alguien quiere viajar con vos. Por favor revisa tu viaje!' )

    });
  });
});

// Ruta para obtener la cantidad de pasajeros de un vehículo y sus detalles
app.get('/vehiculos/:id/pasajeros', (req, res) => {
  const idVehiculo = req.params.id;

  const queryCantidadPasajeros = `
  SELECT COUNT(*) as cantidad
  FROM asociaciones_viaje
  WHERE id_vehiculo = ? AND (estado <> 'pendiente');
`;
const queryDetallePasajeros = `
  SELECT *
  FROM usuarios
  WHERE id IN (
    SELECT id_pasajero
    FROM asociaciones_viaje
    WHERE id_vehiculo = ?
  );
`;

db.get(queryCantidadPasajeros, [idVehiculo], (err, row) => {
  if (err) {
    return res.status(500).json({ error: err.message });
  }

  const cantidadPasajeros = row.cantidad;

  db.all(queryDetallePasajeros, [idVehiculo], (err, pasajeros) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      cantidadPasajeros: cantidadPasajeros,
      detallePasajeros: pasajeros
    });
  });
});
});

//Ruta para saber el estado de un usuario en un viaje
app.get('/usuarios/:idUsuario/viajes/:idViaje', (req, res) => {
  const idUsuario = req.params.idUsuario;
  const idViaje = req.params.idViaje;

  const queryEstadoUsuarioEnViaje = `
    SELECT estado
    FROM asociaciones_viaje
    WHERE id_pasajero = ? AND id_viaje = ? AND estado <> 'rechazado';
  `;

  const valuesEstadoUsuarioEnViaje = [idUsuario, idViaje];

  db.get(queryEstadoUsuarioEnViaje, valuesEstadoUsuarioEnViaje, (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      return res.status(404).json({ error: 'No se encontró una asociación entre el usuario y el viaje' });
    }

    const estadoUsuarioEnViaje = row.estado;

    res.json({ estado: estadoUsuarioEnViaje });
  });
});


//Ruta para eliminar un pasajero(usuario) de un viaje
app.delete('/viajes/:idViaje/pasajeros/:idPasajero', (req, res) => {
  const idViaje = req.params.idViaje;
  const idPasajero = req.params.idPasajero;

  // Aquí implementarás la lógica para eliminar al pasajero del viaje.

  // Luego, enviarás una respuesta.
});


//Ruta para actualizar el estado del viaje de un usuario (confirmado o no)
app.put('/asociar-viaje', (req, res) => {
  const { estado, idViaje, idPasajero } = req.body;
  const nombreConductor = '';
  // Asociar el viaje con el conductor y el pasajero
  const queryAsociacion = `
    UPDATE asociaciones_viaje
    SET estado = ?
    WHERE id_viaje = ? AND id_pasajero = ?
  `;
  const valuesAsociacion = [estado, idViaje, idPasajero];

  db.run(queryAsociacion, valuesAsociacion, (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const queryDataConductor = `SELECT nombre, apellido FROM USUARIOS WHERE id IN (SELECT id_conductor FROM sociaciones_viaje WHERE id_viaje = ?)`
    const valueIdViaje = [idViaje];
    db.get(queryDataConductor, valueIdViaje, (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      else {
        nombreConductor = row.nombre + ' ' + row.apellido;
      }
    })


    const queryMail = `SELECT mail FROM usuarios WHERE id = ?`
    const valueId = [idPasajero];
    db.get(queryMail, valueId, (err,row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const mailUsuario = row.mail;
      if (estado == 'confirmado') {
        sendMail(mailUsuario,'Tu viaje ha sido confirmado! Ponte en contacto con ' + nombreConductor + ' para mas detalles')
      }
      if (estado == 'rechazado') {
        sendMail(mailUsuario,'Tu viaje ha sido rechazado!' )
      }
    });
    res.json({ mensaje: 'Viaje actualizado' });
  });
});

app.post("/tarjeta", (req, res) => {
  const tarjeta = req.body;
  const { numero, codigo, idTitular, titular, dniTitular, tipo} = tarjeta;

  const query = `INSERT INTO tarjeta_usuario (numero, codigo, id_titular, titular, dni, tipo) VALUES (?, ?, ?, ?, ?, ?)`;
  const values = [
    numero,
    codigo,
    idTitular,
    titular,
    dniTitular,
    tipo
  ]; 

  db.run(query, values, function (err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    res.json({
      mensaje: "Tarjeta creada con éxito",
      tarjeta: { id: this.lastID, ...tarjeta },
    });
  });
});

app.get("/tarjeta/:id", (req, res) => {
  const idTitular = req.params.id;
  const query = "SELECT * FROM tarjeta_usuario WHERE id_titular = ?";
  const values = [idTitular];

  db.get(query, values, (err, tarjeta) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!tarjeta) {
      return res.status(204).json({ error: "tarjeta no encontrada" });
    }
    // Convertir pasajeros de JSON a Array
    res.json(tarjeta);
  });
});

app.get("/ruta/:origen/:destino", (req, res) => {
  const apiKey = 'AIzaSyDy7zcPDnAYYv9xiIJPEz2g9jae7WhU2u8';

  const origen = req.params.origen;
  const destino = req.params.destino;
  
  const options = {
    hostname: 'maps.google.com',
    path: `/maps/api/directions/json?origin=${origen}&destination=${destino}&key=${apiKey}`,
    method: 'GET'
  };

  const req2 = http.request(options, (res) => {
    let data = '';
  
    // Recibe los datos en chunks
    res.on('data', (chunk) => {
      data += chunk;
    });
  
    // Una vez que se han recibido todos los datos
    res.on('end', () => {
      const jsonData = JSON.parse(data);
      return jsonData
    });
  });
  
  req2.on('error', (e) => {
    console.error(`Error en la solicitud: ${e.message}`);
  });
  req2.end();
})


function sendMail(to, text) {
  // Configura el transporte
  let transporter = nodemailer.createTransport({
    service: 'hotmail',
    auth: {
        user: 'compartigoapp@hotmail.com', 
        pass: 'VamoLocoVamo123'
    }
  });
  
  // Configura el contenido del correo
  let mailOptions = {
    from: 'compartigoapp@hotmail.com',
    to: to,
    subject: 'CompartiGo',
    text: text
  }
  
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
        return console.log(error);
    }
    console.log('Correo enviado: ' + info.response);
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
