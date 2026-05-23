const patch = require('path');
const { Pool } = require('pg');

const app = express();
// Render nos asignará un puerto automático, si no, usamos el 3000 localmente
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a Neon usando la variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones seguras con Neon/Render
  }
});

// Ruta principal de prueba
app.get('/', (req, res) => {
  res.send('🌍 El servidor de mapas está en línea y conectado a Neon.');
});

// Servir los archivos estáticos de la carpeta 'public' (como el index.html)
app.use(express.static(path.join(__dirname, 'public')));

// Al entrar a la raíz, enviar el mapa interactivo
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

app.get('/api/municipios', async (req, res) => {
  try {
    // La función ST_AsGeoJSON hace la magia de convertir el GPKG de la base de datos a web
    const result = await pool.query(`
      SELECT nombre, ST_AsGeoJSON(geom)::json as geometry 
      FROM municipios
    `);

    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        properties: { nombre: row.nombre },
        geometry: row.geometry
      }))
    };

    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// CRUCIAL PARA VERCEL: Exportamos la aplicación
module.exports = app;