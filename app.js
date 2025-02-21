// app.js (actualizado)
const express = require('express');
const multer = require('multer');
const axios = require('axios');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const config = require('./config');

const app = express();
const port = config.server.port;

const uploadFolder = path.join(__dirname, config.server.uploadFolder);
if (!fs.existsSync(uploadFolder)) {
    fs.mkdirSync(uploadFolder, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadFolder);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ storage });
app.use(express.static('public'));

let logs = [];
let progress = 0;
let totalRequests = 0;

app.get('/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const sendLogs = () => {
        while (logs.length > 0) {
            res.write(`data: ${JSON.stringify(logs.shift())}\n\n`);
        }
    };

    const interval = setInterval(sendLogs, 500);
    req.on('close', () => clearInterval(interval));
});

app.post('/upload', upload.single('file'), async (req, res) => {
    const filePath = path.join(uploadFolder, req.file.filename);
    if (!fs.existsSync(filePath)) return res.status(400).json({ error: 'Error al subir el archivo' });

    const results = [];
    const rows = [];
    fs.createReadStream(filePath)
        .pipe(csv({ separator: ';' }))
        .on('data', (data) => rows.push(data))
        .on('end', async () => {
            totalRequests = rows.length;
            for (const row of rows) {
                progress++;
                const result = await makeRequest(row);
                results.push(result);
                logs.push({ log: `Procesado ${progress}/${totalRequests}: Código ${result.codigoRespuesta}, Descripción: ${result.descripcion}`, percent: Math.round((progress / totalRequests) * 100) });
            }

            const json2csvParser = new Parser({ delimiter: ';' });
            const csvDataString = json2csvParser.parse(results);
            fs.writeFileSync(path.join(uploadFolder, 'resultados.csv'), csvDataString);
            logs.push({ done: true, file: '/uploads/resultados.csv' });
        });

    res.json({ message: 'Procesando archivo...' });
});

async function makeRequest(row) {
    try {
        const response = await axios.post(config.api.url, {
            pasarela: row.pasarela,
            codigoUnico: row.codigoUnico,
            tipoComercio: 'NORMAL',
            cantidadTerminales: 1
        }, {
            headers: { 'Content-Type': 'application/json', 'Authorization': config.api.authorization }
        });
        return { ...row, codigoRespuesta: response.data.codigoRespuesta, descripcion: response.data.descripcion };
    } catch (error) {
        return { ...row, codigoRespuesta: 'ERROR', descripcion: error.message };
    }
}

app.listen(port, () => console.log(`Servidor en http://localhost:${port}`));
