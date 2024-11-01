const express = require('express');
const multer = require('multer');
const axios = require('axios');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv'); // Importamos json2csv

const app = express();
const port = 3001;

const upload = multer({ dest: 'uploads/' });

app.use(express.static('public')); // Para servir archivos estáticos

let progress = 0;
let totalRequests = 0;

app.get('/progress', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const interval = setInterval(() => {
    res.write(`data: ${JSON.stringify({ progress, total: totalRequests })}\n\n`);
  }, 350); // Enviar actualizaciones cada segundo

  req.on('close', () => {
    clearInterval(interval);
  });
});

// Función para hacer un delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/upload', upload.single('file'), async (req, res) => {
  const filePath = path.join(__dirname, 'uploads', req.file.filename);
  const results = [];

  try {
    if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || req.file.mimetype === 'application/vnd.ms-excel') {
      // Leer archivo Excel
      const workbook = XLSX.readFile(filePath);
      const sheet_name_list = workbook.SheetNames;
      const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheet_name_list[0]]);

      totalRequests = data.length;
      await processRows(data, results);
    } else if (req.file.mimetype === 'text/csv') {
      // Leer archivo CSV
      const csvData = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          csvData.push(data);
        })
        .on('end', async () => {
          totalRequests = csvData.length; // Asignamos el totalRequests después de leer el archivo CSV
          await processRows(csvData, results);

          // Convertir los resultados a CSV
          const json2csvParser = new Parser();
          const csvDataString = json2csvParser.parse(results);

          // Devolver el archivo CSV generado al cliente
          res.header('Content-Type', 'text/csv');
          res.attachment('resultados.csv');
          res.send(csvDataString);
        });
    } else {
      return res.status(400).json({ message: 'Formato de archivo no soportado' });
    }

    // Limpiar archivos temporales si es necesario
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function processRows(rows, results) {
  let index = 0;
  for (const row of rows) {
    console.log(`Procesando registro ${index + 1} de ${rows.length}`);
    await makeRequest(row, results);
    await delay(350); // Delay de 500 ms
    index++;
  }
}

async function makeRequest(row, results) {
  const options = {
    method: 'POST',
    url: 'https://orquestador-pasarelas-gateway-alcance.crediservices.credibanco.com/credibanco/api/pasarelas/orquestador/v1/externo/notificaciones/terminales',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Basic Y3JlZGliYW5jb3BydWViYXM6Q29sb21iaWEyMyo='
    },
    data: {
      "pasarela": row.pasarela,
      "codigoUnico": row.codigoUnico,
      "tipoComercio": "NORMAL",
      "cantidadTerminales": 1
    }
  };

  try {
    const response = await axios(options);
    let ahora = new Date();
    let fecha = ahora.getDate() + '/' + (ahora.getMonth() + 1) + '/' + ahora.getFullYear();
    let hora = ahora.getHours() + ':' +  (ahora.getMinutes() < 10 ? '0' : '') + ahora.getMinutes() + ':' + (ahora.getSeconds() < 10 ? '0' : '') + ahora.getSeconds();
    results.push({
      pasarela: row.pasarela,
      codigoUnico: row.codigoUnico,
      terminalesCreadas: response.data.terminalesCreadas ? response.data.terminalesCreadas.join(', ') : '',
      codigoRespuesta: response.data.codigoRespuesta || '',
      descripcion: response.data.descripcion || '',
      fecha: fecha || '',
      hora: hora || ''
    });
    console.log(`Respuesta para ${row.pasarela} - ${row.codigoUnico}:`, response.data);
  } catch (error) {
    results.push({
      pasarela: row.pasarela,
      codigoUnico: row.codigoUnico,
      terminalesCreadas: '',
      codigoRespuesta: '',
      descripcion: `Error: ${error.message}`
    });
    console.error(`Error para ${row.pasarela} - ${row.codigoUnico}:`, error.message);
  }
  progress++;
}

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
