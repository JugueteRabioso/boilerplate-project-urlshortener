require('dotenv').config();
const express = require('express');
const cors = require('cors');
const dns = require('dns');
const urlparser = require('url');
const {MongoClient} = require('mongodb');


// Basic Configuration
const app = express();
app.use(cors());
app.use('/public', express.static(`${process.cwd()}/public`));
app.use(express.urlencoded({ extended: true }));
const port = process.env.PORT || 3000;

//Conexión a la base de datos

const client = new MongoClient(process.env.DB_URI);
const db = client.db('url_shortener');
const urls = db.collection('urls');

// Conectar al cliente
async function connect() {
  try {
    await client.connect();
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('Error connecting to MongoDB:', err);
  }
}
connect();
console.log('DB_URI:', process.env.DB_URI);
// ENRUTAMIENTO main

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});



app.post('/api/shorturl', async (req, res) => {
  console.log('Solicitud POST recibida en /api/shorturl');
  console.log('Datos recibidos:', req.body);

  try {
    const url = req.body.url;
    console.log('URL recibida:', url);

    // Validar el formato de la URL
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      console.log('URL inválida (falta protocolo):', url);
      return res.json({ error: 'invalid url' });
    }

    // Extraer el hostname de la URL
    let hostname;
    try {
      const urlObj = new URL(url);
      hostname = urlObj.hostname;
      console.log('Hostname extraído:', hostname);
    } catch (error) {
      console.log('URL inválida (formato incorrecto):', url);
      return res.json({ error: 'invalid url' });
    }

    // Verificar si el hostname es válido usando DNS
    dns.lookup(hostname, async (err, address) => {
      if (err || !address) {
        console.log('Error en DNS lookup:', err);
        return res.json({ error: 'invalid url' });
      }

      console.log('DNS lookup exitoso. Dirección IP:', address);

      // Verificar si la URL ya existe en la base de datos
      const existingUrl = await urls.findOne({ original_url: url });
      if (existingUrl) {
        console.log('URL ya existe en la base de datos:', existingUrl);
        return res.json({
          original_url: existingUrl.original_url,
          short_url: existingUrl.short_url,
        });
      }

      // Obtener el siguiente short_url
      const urlCount = await urls.countDocuments({});
      const shortUrl = urlCount + 1;

      // Insertar la nueva URL en la base de datos
      const urlDoc = {
        original_url: url,
        short_url: shortUrl,
      };

      console.log('Insertando documento en la base de datos:', urlDoc);
      await urls.insertOne(urlDoc);

      console.log('Documento insertado exitosamente');
      res.json({ original_url: url, short_url: shortUrl });
    });
  } catch (error) {
    console.error('Error en POST /api/shorturl:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
app.get('/api/shorturl/:short_url', async (req, res) => {
  console.log('Solicitud GET recibida en /api/shorturl/:short_url');
  console.log('Parámetro short_url:', req.params.short_url);

  try {
    const shortUrl = parseInt(req.params.short_url);
    console.log('short_url convertido a número:', shortUrl);

    const urlDoc = await urls.findOne({ short_url: shortUrl });
    console.log('Documento encontrado en la base de datos:', urlDoc);

    if (!urlDoc) {
      console.log('short_url no encontrado en la base de datos');
      return res.json({ error: 'short url not found' });
    }

    console.log('Redirigiendo a:', urlDoc.original_url);
    res.redirect(urlDoc.original_url);
  } catch (error) {
    console.error('Error en GET /api/shorturl/:short_url:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});

