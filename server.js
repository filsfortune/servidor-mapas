const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la conexión a Neon usando la variable de entorno
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones seguras con Neon/Render
  }
});

// Servir los archivos estáticos de la carpeta principal (raíz) o public si tienes estilos
app.use(express.static(path.join(__dirname, './')));

// 1. Ruta principal de prueba
app.get('/', (req, res) => {
  res.send('🌍 El servidor de mapas está en línea y conectado a Neon.');
});

// 2. RUTA DE LA PROVINCIA (La que ya te funciona)
app.get('/api/mapa', async (req, res) => {
  try {
    const result = await pool.query('SELECT ST_AsGeoJSON(geom)::json as geometry FROM provincia');
    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {}
      }))
    };
    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// 3. NUEVA RUTA: MUNICIPIOS (Para leer La Lisa y los que agregues)
app.get('/api/municipios', async (req, res) => {
  try {
    // Consultamos el nombre y la geometría convertida a GeoJSON
    const result = await pool.query('SELECT nombre, ST_AsGeoJSON(geom)::json as geometry FROM municipios');
    
    const geojson = {
      type: "FeatureCollection",
      features: result.rows.map(row => ({
        type: "Feature",
        geometry: row.geometry,
        properties: {
          nombre: row.nombre // Guardamos el nombre para que Leaflet lo lea
        }
      }))
    };
    res.json(geojson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Levantar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// Exportamos la aplicación para compatibilidad
module.exports = app;